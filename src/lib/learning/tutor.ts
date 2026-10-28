import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import type { AiConfig } from "@/lib/ai/config";
import { isRateLimitError, type AiLimitReason } from "@/lib/ai/errors";
import { checkAiLimits, type AiStore } from "@/lib/ai/guard";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { StageContentData } from "./content";
import type { SkillNode, Stage } from "./types";
import { TUTOR_MAX_CHARS } from "./tutor-limits";
import { STAGES } from "./types";

/** AI tutor for one (skill, stage): Socratic, stage-aware, streamed, persisted per user. */

export { TUTOR_MAX_CHARS };
/** Messages of history sent to the model (older ones stay in the DB, not in the prompt). */
export const TUTOR_HISTORY = 16;
export const TUTOR_MAX_OUTPUT_TOKENS = 700;
/** Per-user burst limit on top of the daily AI limits. */
export const TUTOR_PER_MINUTE = 5;

export const tutorRequestSchema = z.object({
  threadId: z.string().max(40).nullish(),
  skill: z.string().min(1).max(60),
  stage: z.enum(STAGES),
  text: z.string().trim().min(1).max(TUTOR_MAX_CHARS),
});
export type TutorRequest = z.infer<typeof tutorRequestSchema>;

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]{3,}@/i,
  /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{8,}/i,
];

/** True when the text looks like it contains a credential; such messages are never sent to the model. */
export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export type TutorLevel = "beginner" | "intermediate" | "advanced";

export function tutorLevel(stage: Stage, prereqsKnown: number, prereqsTotal: number): TutorLevel {
  if (stage === "applied") return "advanced";
  if (stage === "intermediate") return "intermediate";
  return prereqsTotal > 0 && prereqsKnown === prereqsTotal ? "intermediate" : "beginner";
}

export function tutorSystemPrompt(opts: {
  node: SkillNode;
  stage: Stage;
  locale: Locale;
  level: TutorLevel;
  content: StageContentData;
}): string {
  const { node, stage, locale, level, content } = opts;
  const lang =
    locale === "he"
      ? "Always reply in Hebrew. Keep commands, code and technical terms in English inside `code`."
      : "Always reply in English.";
  return [
    `You are a patient, Socratic tutor on a job-seeker learning platform. ${lang}`,
    `The student is learning ${node.label}, stage "${stage}". Their level: ${level}.`,
    `Stage topics: ${node.stages[stage].join("; ")}.`,
    `Practice exercises on their screen: ${content.exercises.map((e) => `"${e.title}" (${e.goal})`).join(" | ")}.`,
    `Review questions they may be asked: ${content.questions.map((q) => q.q).join(" | ")}.`,
    "Rules:",
    "- Teach by asking. Give a hint or a guiding question before a full answer; give the full answer if they ask for it or are stuck after two hints.",
    "- When asked to quiz them, ask ONE question at a time, wait for the answer, then give short feedback.",
    "- When they paste a solution or code, review it: what is correct, what is missing or risky, one concrete improvement.",
    "- Keep replies short (under ~180 words) unless they ask for depth. Use Markdown lists and fenced code blocks.",
    "- Stay on learning this skill and related engineering topics; briefly decline unrelated requests.",
    "- Never ask for, store or repeat passwords, API keys, tokens or private data. If they paste one, tell them to revoke it.",
  ].join("\n");
}

export interface TutorRepo {
  /** Thread owned by the user, or a new one when `threadId` is missing/foreign. */
  thread(userId: string, skill: string, stage: Stage, threadId?: string | null): Promise<{ id: string }>;
  history(threadId: string, limit: number): Promise<{ role: string; content: string }[]>;
  add(threadId: string, role: "user" | "assistant", content: string): Promise<void>;
}

export type TutorError =
  | { status: 400; error: "invalid" | "secret" }
  | { status: 401; error: "auth" }
  | { status: 429; error: "limit"; reason: AiLimitReason | "burst" };

export interface TutorDeps {
  userId: string;
  node: SkillNode;
  locale: Locale;
  system: string;
  /** null → offline mode (no API key / LLM_PROVIDER=mock): a canned, clearly-labelled reply. */
  model: LanguageModel | null;
  modelName: string;
  store: AiStore;
  cfg: Pick<AiConfig, "userDailyLimit" | "globalDailyCap" | "globalPerMinute">;
  repo: TutorRepo;
  /** Calls by this user to the tutor in the last minute (burst limit). */
  recentTutorCalls: () => Promise<number>;
  offlineReply: string;
  now?: () => Date;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Validates, rate-limits, persists, and streams one tutor turn. Returns a Response (UI message stream or JSON error). */
export async function handleTutorTurn(req: TutorRequest, deps: TutorDeps): Promise<Response> {
  const { userId, store, cfg, repo } = deps;
  if (looksLikeSecret(req.text)) return json({ error: "secret" }, 400);

  const live = deps.model !== null;
  if (live) {
    if ((await deps.recentTutorCalls()) >= TUTOR_PER_MINUTE) return json({ error: "limit", reason: "burst" }, 429);
    const reason = await checkAiLimits(store, cfg, userId, deps.now?.());
    if (reason) {
      await store.record({ userId, feature: "tutor_chat", model: deps.modelName, outcome: "limited" }).catch(() => {});
      return json({ error: "limit", reason }, 429);
    }
  }

  const thread = await repo.thread(userId, req.skill, req.stage, req.threadId);
  const past = await repo.history(thread.id, TUTOR_HISTORY);
  await repo.add(thread.id, "user", req.text);
  const used = live ? await store.countCalls(new Date((deps.now?.() ?? new Date()).getTime() - 86_400_000), userId) : 0;
  const remaining = live ? Math.max(0, cfg.userDailyLimit - used - 1) : null;
  const metadata = { threadId: thread.id, remaining };

  if (!deps.model) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start", messageMetadata: metadata });
        writer.write({ type: "text-start", id: "t" });
        for (const chunk of deps.offlineReply.match(/[\s\S]{1,40}/g) ?? [])
          writer.write({ type: "text-delta", id: "t", delta: chunk });
        writer.write({ type: "text-end", id: "t" });
        writer.write({ type: "finish" });
        await repo.add(thread.id, "assistant", deps.offlineReply);
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const messages: ModelMessage[] = [
    ...past
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: req.text },
  ];
  let recorded = false;
  const record = (outcome: "ok" | "error" | "rate_limited") => {
    if (recorded) return;
    recorded = true;
    void store.record({ userId, feature: "tutor_chat", model: deps.modelName, outcome }).catch(() => {});
  };
  const result = streamText({
    model: deps.model,
    system: deps.system,
    messages,
    maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    temperature: 0.5,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    onFinish: async ({ text }) => {
      record("ok");
      if (text.trim()) await repo.add(thread.id, "assistant", text).catch(() => {});
    },
    onError: ({ error }) => {
      record(isRateLimitError(error) ? "rate_limited" : "error");
      console.warn("[tutor] stream failed:", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    },
  });
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => (part.type === "start" ? metadata : undefined),
    onError: (error) => (isRateLimitError(error) ? "provider_quota" : "error"),
  });
}

/** Offline (no API key) reply: honest about being offline, still useful — nudges with a stage question. */
export function offlineTutorReply(locale: Locale, content: StageContentData, turn: number): string {
  const q = content.questions[turn % Math.max(1, content.questions.length)];
  return locale === "he"
    ? `מורה ה-AI לא מחובר בסביבה הזו, אז הנה תרגול במקום: **${q?.q ?? ""}**\n\nנסה לענות לעצמך, ואז פתח את הלשונית "שאלות ותשובות" כדי להשוות.`
    : `The AI tutor isn't connected in this environment, so here's practice instead: **${q?.q ?? ""}**\n\nTry answering, then open the "Q&A" tab to compare.`;
}
