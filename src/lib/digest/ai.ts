import { z } from "zod";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import type { LLMMessage } from "@/lib/ai/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fallbackSuggestions, type DigestData, type Suggestion, type SuggestionSource } from "./build";

const MAX_TOKENS = 700;

export const suggestionsSchema = z.object({
  suggestions: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .min(1)
    .max(4),
});

/** Keep 1–4 non-empty, length-capped suggestions; null when nothing usable came back. */
export function normalizeSuggestions(raw: unknown): Suggestion[] | null {
  const parsed = suggestionsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const out = parsed.data.suggestions
    .map((x) => ({ title: x.title.trim().slice(0, 100), detail: x.detail.trim().slice(0, 300) }))
    .filter((x) => x.title && x.detail);
  return out.length ? out : null;
}

/** Compact facts for the prompt — counts and job titles/companies only (no emails, notes or contacts). */
export function digestFacts(d: DigestData) {
  return {
    newJobs: Math.max(d.newJobs.fromSearches, d.newJobs.matchCount),
    topNewJobs: d.newJobs.top.slice(0, 3).map((j) => `${j.title} @ ${j.company}`),
    statusChanges: d.statusChanges.slice(0, 5).map((a) => `${a.company}: ${a.status}`),
    followUpsDue: d.followUps.length,
    upcomingInterviews: d.interviews.slice(0, 3).map((i) => ({ company: i.company, at: i.at })),
    interviewsWithoutDate: d.interviewsMissingDate,
    pipeline: d.pipeline,
    savedSearches: d.savedSearches,
    learning: d.learning
      ? {
          minutesThisWeek: d.learning.minutesThisWeek,
          weeklyGoalMinutes: d.learning.goalHours * 60,
          streakDays: d.learning.streak,
          reviewsDue: d.learning.reviewsDue,
          nextTopic: d.learning.next?.label ?? null,
        }
      : null,
  };
}

export function suggestionsPrompt(d: DigestData, locale: Locale): LLMMessage[] {
  const lang = locale === "he" ? "Hebrew" : "English";
  return [
    {
      role: "system",
      content:
        "You are a pragmatic job-search coach inside a job-hunting app (Israel tech market). " +
        "Given today's facts about one candidate's search, give 2–4 concrete actions that make their process " +
        "more efficient today (prioritize, batch, follow up, prepare, prune). Each: a short imperative title " +
        `(max 8 words) and one sentence of detail grounded in the numbers. No generic advice, no invented facts. Write in ${lang}. ` +
        'Return JSON: {"suggestions":[{"title":"…","detail":"…"}]}',
    },
    { role: "user", content: JSON.stringify(digestFacts(d)) },
  ];
}

/** Gemini (guarded: per-user daily limit + cache) → rule-based tips on mock, limits or invalid output. */
export async function digestSuggestions(
  userId: string,
  d: DigestData,
  locale: Locale,
): Promise<{ suggestions: Suggestion[]; source: SuggestionSource }> {
  const offline = fallbackSuggestions(d, locale);
  const llm = await guardedLLM("digest", userId);
  if (llm.name === "mock") return { suggestions: offline, source: "offline" };
  try {
    const raw = await llm.complete(suggestionsPrompt(d, locale), { schema: suggestionsSchema, maxTokens: MAX_TOKENS });
    const ai = normalizeSuggestions(JSON.parse(raw));
    if (ai) return { suggestions: ai, source: "ai" };
  } catch (e) {
    if (e instanceof AiLimitError) return { suggestions: offline, source: "limited" };
  }
  return { suggestions: offline, source: "offline" };
}
