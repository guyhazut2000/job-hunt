import { z } from "zod";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import type { LLMMessage } from "@/lib/ai/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { CoachData } from "./build";
import { recText } from "./text";

const MAX_TOKENS = 600;

export type CoachAiSource = "ai" | "offline" | "limited";
export interface CoachAi {
  /** One or two sentences about the week. */
  summary: string;
  /** Rephrased text per recommendation id (title + detail). */
  recs: Record<string, { title: string; detail: string }>;
}

export const coachAiSchema = z.object({
  summary: z.string(),
  recs: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string() })).min(1).max(3),
});

/** Digits in a string (to check the AI didn't invent numbers). */
const numbersIn = (s: string) => s.match(/\d+/g) ?? [];

/**
 * Accept the AI output only if it covers exactly the rule-based recommendations (same ids) and every
 * number it mentions appears in the facts it was given. Otherwise null (the rule-based text is used).
 */
export function normalizeCoachAi(raw: unknown, d: CoachData): CoachAi | null {
  const parsed = coachAiSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ids = d.recommendations.map((r) => r.id);
  const got = parsed.data.recs.map((r) => r.id);
  if (got.length !== ids.length || !ids.every((id) => got.includes(id))) return null;
  const allowed = new Set(numbersIn(JSON.stringify([coachFacts(d), d.recommendations.map((r) => r.basis)])));
  const ok = (s: string) => numbersIn(s).every((n) => allowed.has(n));
  const summary = parsed.data.summary.trim().slice(0, 300);
  if (!ok(summary)) return null;
  const recs: CoachAi["recs"] = {};
  for (const r of parsed.data.recs) {
    const title = r.title.trim().slice(0, 100);
    const detail = r.detail.trim().slice(0, 300);
    if (!title || !detail || !ok(title) || !ok(detail)) return null;
    recs[r.id] = { title, detail };
  }
  return { summary, recs };
}

/** Counts only (no names, companies, notes or contacts). */
export function coachFacts(d: CoachData) {
  return {
    week: d.week,
    lastWeek: d.activity,
    weekBefore: d.prevWeek,
    totals: d.totals,
    responseRatePercent: d.responseRate === null ? null : Math.round(d.responseRate * 100),
    biggestDropOff: d.bottleneck
      ? { from: d.bottleneck.from, to: d.bottleneck.to, ratePercent: Math.round((d.bottleneck.rate ?? 0) * 100) }
      : null,
    stuck: { total: d.stuck.total, byStage: d.stuck.byStage },
    outreach: d.outreach,
    hasProfile: d.hasProfile,
  };
}

export function coachPrompt(d: CoachData, locale: Locale): LLMMessage[] {
  const lang = locale === "he" ? "Hebrew" : "English";
  return [
    {
      role: "system",
      content:
        "You are a pragmatic weekly job-search coach inside a job-hunting app (Israel tech market). " +
        "You get last week's facts for one candidate and exactly three recommendations already chosen by rules. " +
        "Rephrase them to be direct and motivating, keep each recommendation's meaning and id, and write a 1–2 sentence " +
        "summary of the week. Use only numbers that appear in the facts; never invent data, names or companies. " +
        `Titles max 8 words, details one sentence. Write in ${lang}. ` +
        'Return JSON: {"summary":"…","recs":[{"id":"…","title":"…","detail":"…"}]}',
    },
    {
      role: "user",
      content: JSON.stringify({
        facts: coachFacts(d),
        recommendations: d.recommendations.map((r) => ({ id: r.id, basis: r.basis, ...recText(locale, r) })),
      }),
    },
  ];
}

/** Optional Gemini phrasing (guarded: per-user daily limit + response cache); null on mock/limit/invalid. */
export async function coachAi(
  userId: string,
  d: CoachData,
  locale: Locale,
): Promise<{ ai: CoachAi | null; source: CoachAiSource }> {
  const llm = await guardedLLM("coach", userId);
  if (llm.name === "mock") return { ai: null, source: "offline" };
  try {
    const raw = await llm.complete(coachPrompt(d, locale), { schema: coachAiSchema, maxTokens: MAX_TOKENS });
    const ai = normalizeCoachAi(JSON.parse(raw), d);
    if (ai) return { ai, source: "ai" };
  } catch (e) {
    if (e instanceof AiLimitError) return { ai: null, source: "limited" };
  }
  return { ai: null, source: "offline" };
}
