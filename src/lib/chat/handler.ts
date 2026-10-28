import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type { AiConfig } from "@/lib/ai/config";
import { isRateLimitError, type AiLimitReason } from "@/lib/ai/errors";
import { checkAiLimits, type AiStore } from "@/lib/ai/guard";
import type { Locale } from "@/lib/i18n/dictionaries";
import { looksLikeSecret } from "@/lib/learning/tutor";
import type { Intent } from "./intent";
import { CHAT_MAX_CHARS } from "./limits";
import type { ChatToolOutput } from "./types";

/** One assistant turn: validate → limits → persist → stream (model with tools, or the offline router). */

export { CHAT_MAX_CHARS };
export const CHAT_HISTORY = 12;
/** Model steps per turn (each step is one provider call); the last one is forced to answer in text. */
export const CHAT_MAX_STEPS = 4;
export const CHAT_MAX_OUTPUT_TOKENS = 800;
/** Turns per user per minute, on top of the daily AI limits. */
export const CHAT_PER_MINUTE = 6;

export const chatRequestSchema = z.object({
  threadId: z.string().max(40).nullish(),
  text: z.string().trim().min(1).max(CHAT_MAX_CHARS),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ChatRepo {
  /** Thread owned by the user, or a new one (titled from the first message) when missing/foreign. */
  thread(userId: string, title: string, threadId?: string | null): Promise<{ id: string; created: boolean }>;
  history(threadId: string, limit: number): Promise<{ role: string; content: string }[]>;
  add(threadId: string, role: "user" | "assistant", content: string, parts?: unknown): Promise<void>;
}

export interface ChatDeps {
  userId: string;
  locale: Locale;
  system: string;
  /** null → offline mode (no API key / LLM_PROVIDER=mock): deterministic intent router, no AI usage. */
  model: LanguageModel | null;
  modelName: string;
  tools: ToolSet;
  /** Offline mode: parse the message into one tool call and run it. */
  route: (text: string, history: { role: string; content: string }[]) => Promise<Intent>;
  run: (intent: Intent) => Promise<ChatToolOutput>;
  store: AiStore;
  cfg: Pick<AiConfig, "userDailyLimit" | "globalDailyCap" | "globalPerMinute">;
  repo: ChatRepo;
  /** Chat turns by this user in the last minute (burst limit). */
  recentTurns: () => Promise<number>;
  now?: () => Date;
}

export interface ChatMetadata {
  threadId: string;
  /** AI turns left today; null in offline mode. */
  remaining: number | null;
  offline: boolean;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function threadTitle(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

/** Short text form of a tool output, stored with the assistant message so follow-ups ("the second one") work. */
export function outputMemo(out: ChatToolOutput): string {
  if (out.kind === "jobs")
    return `[search_jobs: ${out.total} found; shown: ${out.jobs.map((j, i) => `${i + 1}) ${j.title} @ ${j.company.name} id=${j.id}`).join("; ") || "none"}]`;
  if (out.kind === "match")
    return out.job
      ? `[explain_match: ${out.job.title} @ ${out.job.company.name} id=${out.job.id} score=${out.score ?? "?"}]`
      : `[explain_match: ${out.error}]`;
  return out.company ? `[company_info: ${out.company.name} slug=${out.company.slug}]` : `[company_info: ${out.error}]`;
}

/** Text + memos of tool results from UI message parts. */
export function contentFromParts(parts: UIMessage["parts"]): string {
  const text: string[] = [];
  const memos: string[] = [];
  for (const p of parts) {
    if (p.type === "text") text.push(p.text);
    else if (p.type.startsWith("tool-") && "state" in p && p.state === "output-available" && "output" in p) {
      const o = p.output as ChatToolOutput | undefined;
      if (o && typeof o === "object" && "kind" in o) memos.push(outputMemo(o));
    }
  }
  return [text.join("").trim(), ...memos].filter(Boolean).join("\n");
}

/** Deterministic reply text for offline mode (the cards carry the details). */
export function offlineText(out: ChatToolOutput, locale: Locale, opts: { offline?: boolean } = {}): string {
  const he = locale === "he";
  const note = opts.offline === false
    ? ""
    : he
    ? "\n\n_העוזר החכם לא מחובר כאן, אז זו תשובה אוטומטית לפי מילות מפתח._"
    : "\n\n_The AI assistant isn't connected here, so this is a keyword-based answer._";
  if (out.kind === "jobs") {
    if (out.unknownCompany)
      return (
        (he
          ? `לא מצאתי חברה בשם "${out.unknownCompany}".`
          : `I couldn't find a company called "${out.unknownCompany}".`) + note
      );
    if (!out.total) {
      const c = out.applied.commute;
      const hint = c?.maxMinutes
        ? he
          ? ` ייתכן שמגבלת הנסיעה (עד ${c.maxMinutes} דק׳ מ${c.from}) מצמצמת מדי, אפשר להגדיל אותה או לנסות אמצעי נסיעה אחר.`
          : ` The commute limit (up to ${c.maxMinutes} min from ${c.from}) may be too tight. Try raising it or another way of getting there.`
        : he
          ? " אפשר לנסח אחרת או להסיר סינון."
          : " Try rephrasing or dropping a filter.";
      return (he ? "לא מצאתי משרות שמתאימות לחיפוש." : "No jobs match that search.") + hint + note;
    }
    const c = out.applied.commute;
    const commute = c
      ? he
        ? ` עד ${c.maxMinutes} דקות ${c.mode === "transit" ? "בתחבורה ציבורית" : "ברכב"}${c.estimated ? " (הערכה)" : ""}`
        : ` within ${c.maxMinutes} min by ${c.mode === "transit" ? "transit" : "car"}${c.estimated ? " (estimated)" : ""}`
      : "";
    const origin = out.needsOrigin
      ? he
        ? "\n\nכדי לסנן לפי זמן נסיעה, ספר לי מאיפה אתה יוצא או שמור מקום ברירת מחדל."
        : "\n\nTo filter by commute, tell me where you start from or save a default place."
      : "";
    return (
      (he
        ? `מצאתי ${out.total} משרות${commute}. הנה ${out.shown} הראשונות:`
        : `Found ${out.total} jobs${commute}. Here are the top ${out.shown}:`) +
      origin +
      note
    );
  }
  if (out.kind === "match") {
    if (out.error === "no_profile")
      return (
        (he
          ? "כדי להסביר התאמה צריך פרופיל עם תפקידים וכישורים. מלא אותו ב-/profile."
          : "To explain a match I need your profile (roles and skills). Fill it in at /profile.") + note
      );
    if (!out.job)
      return (
        (he ? "לא מצאתי את המשרה. נסה לציין שם תפקיד וחברה." : "I couldn't find that job. Try its title and company.") +
        note
      );
    const miss = (out.missingSkills ?? []).slice(0, 4).join(", ");
    return (
      (he
        ? `**${out.job.title}** ב-${out.job.company.name}: התאמה של ${out.score}%. ${(out.reasonText ?? []).slice(0, 2).join(" · ")}${miss ? `\n\nחסר לך: ${miss}.` : ""}`
        : `**${out.job.title}** at ${out.job.company.name}: ${out.score}% match. ${(out.reasonText ?? []).slice(0, 2).join(" · ")}${miss ? `\n\nMissing: ${miss}.` : ""}`) +
      note
    );
  }
  if (!out.company) return (he ? "לא מצאתי את החברה." : "I couldn't find that company.") + note;
  const hp =
    out.hiring?.status === "found"
      ? he
        ? `תהליך הגיוס שפורסם: ${out.hiring.stages.length} שלבים.`
        : `Published hiring process: ${out.hiring.stages.length} stages.`
      : he
        ? "החברה לא פרסמה תהליך גיוס שמצאנו."
        : "We found no published hiring process.";
  return (
    (he
      ? `**${out.company.name}**: ${out.activeJobs} משרות פתוחות. ${hp}`
      : `**${out.company.name}**: ${out.activeJobs} open jobs. ${hp}`) + note
  );
}

/** Validates, rate-limits, persists, and streams one chat turn. Returns a Response (UI message stream or JSON error). */
export async function handleChatTurn(req: ChatRequest, deps: ChatDeps): Promise<Response> {
  const { userId, store, cfg, repo } = deps;
  if (looksLikeSecret(req.text)) return json({ error: "secret" }, 400);
  const now = deps.now?.() ?? new Date();

  const live = deps.model !== null;
  if (live) {
    if ((await deps.recentTurns()) >= CHAT_PER_MINUTE) return json({ error: "limit", reason: "burst" }, 429);
    const reason: AiLimitReason | null = await checkAiLimits(store, cfg, userId, now);
    if (reason) {
      await store.record({ userId, feature: "chat", model: deps.modelName, outcome: "limited" }).catch(() => {});
      return json({ error: "limit", reason }, 429);
    }
  }

  const thread = await repo.thread(userId, threadTitle(req.text), req.threadId);
  const past = thread.created ? [] : await repo.history(thread.id, CHAT_HISTORY);
  await repo.add(thread.id, "user", req.text);
  const used = live ? await store.countCalls(new Date(now.getTime() - 86_400_000), userId) : 0;
  const metadata: ChatMetadata = {
    threadId: thread.id,
    remaining: live ? Math.max(0, cfg.userDailyLimit - used - 1) : null,
    offline: !live,
  };
  const save = (msg: UIMessage) =>
    repo.add(thread.id, "assistant", contentFromParts(msg.parts) || "…", msg.parts).catch(() => {});

  if (!deps.model) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start", messageMetadata: metadata });
        const intent = await deps.route(req.text, past);
        const toolCallId = `offline-${now.getTime()}`;
        writer.write({ type: "start-step" });
        writer.write({ type: "tool-input-available", toolCallId, toolName: intent.tool, input: intent.input });
        const output = await deps.run(intent);
        writer.write({ type: "tool-output-available", toolCallId, output });
        writer.write({ type: "finish-step" });
        writer.write({ type: "start-step" });
        const text = offlineText(output, deps.locale);
        writer.write({ type: "text-start", id: "t" });
        for (const chunk of text.match(/[\s\S]{1,60}/g) ?? [])
          writer.write({ type: "text-delta", id: "t", delta: chunk });
        writer.write({ type: "text-end", id: "t" });
        writer.write({ type: "finish-step" });
        writer.write({ type: "finish" });
      },
      onFinish: async ({ responseMessage }) => {
        await save(responseMessage);
      },
      onError: () => "error",
    });
    return createUIMessageStreamResponse({ stream });
  }

  const messages: ModelMessage[] = [
    ...past
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: req.text },
  ];
  // AI usage: one row per provider call (= step). The first carries the userId (→ 1 per turn against the
  // user's daily limit); follow-up steps are recorded without it so they still count toward the global caps.
  let steps = 0;
  let failed = false;
  const record = (outcome: "ok" | "error" | "rate_limited") => {
    const first = steps === 0;
    steps++;
    void store
      .record({ userId: first ? userId : null, feature: "chat", model: deps.modelName, outcome })
      .catch(() => {});
  };
  const result = streamText({
    model: deps.model,
    system: deps.system,
    messages,
    tools: deps.tools,
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    prepareStep: ({ stepNumber }) => (stepNumber >= CHAT_MAX_STEPS - 1 ? { toolChoice: "none" } : undefined),
    maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    temperature: 0.3,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(55_000),
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    onStepFinish: () => record("ok"),
    onError: ({ error }) => {
      if (failed) return;
      failed = true;
      record(isRateLimitError(error) ? "rate_limited" : "error");
      console.warn("[chat] stream failed:", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    },
  });
  // The model sometimes ends a turn right after a tool call with no text (seen with Gemini on 0-result
  // searches). Relay the stream as-is, and if no text came out, append the deterministic summary of the
  // last tool output so the user never gets a blank bubble.
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let sawText = false;
      let sawError = false;
      let lastOutput: ChatToolOutput | undefined;
      for await (const chunk of result.toUIMessageStream({
        messageMetadata: ({ part }) => (part.type === "start" ? metadata : undefined),
        onError: (error) => (isRateLimitError(error) ? "provider_quota" : "error"),
        sendFinish: false,
      })) {
        if (chunk.type === "text-delta" && chunk.delta.trim()) sawText = true;
        if (chunk.type === "error") sawError = true;
        if (chunk.type === "tool-output-available") lastOutput = chunk.output as ChatToolOutput;
        writer.write(chunk);
      }
      if (!sawText && !failed && !sawError) {
        const text = lastOutput
          ? offlineText(lastOutput, deps.locale, { offline: false })
          : deps.locale === "he"
            ? "לא הצלחתי לנסח תשובה הפעם. אפשר לנסות לשאול שוב במילים אחרות."
            : "I couldn't put an answer together this time. Try asking again in different words.";
        writer.write({ type: "start-step" });
        writer.write({ type: "text-start", id: "fallback" });
        writer.write({ type: "text-delta", id: "fallback", delta: text });
        writer.write({ type: "text-end", id: "fallback" });
        writer.write({ type: "finish-step" });
      }
      writer.write({ type: "finish" });
    },
    onFinish: async ({ responseMessage }) => {
      if (responseMessage.parts.length) await save(responseMessage);
    },
    onError: (error) => (isRateLimitError(error) ? "provider_quota" : "error"),
  });
  return createUIMessageStreamResponse({ stream });
}
