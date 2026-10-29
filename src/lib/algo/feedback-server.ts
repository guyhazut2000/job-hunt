import { guardedLLM } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { GuideAnswers } from "./checklist";
import type { AttemptResult } from "./engine";
import {
  heuristicReasoning,
  heuristicWalkthrough,
  normalizeReasoning,
  normalizeWalkthrough,
  reasoningFeedbackSchema,
  reasoningPrompt,
  walkthroughPrompt,
  walkthroughSchema,
  type AlgoSource,
  type ReasoningFeedback,
  type Walkthrough,
} from "./feedback";
import type { PatternId, Problem } from "./types";

export interface WithSource<T> {
  value: T;
  source: AlgoSource;
  model: string | null;
  reason?: AiLimitReason;
}

/** Gemini (guarded: cache + per-user daily limit) → offline heuristic on mock, limits or invalid output. */
export async function reasoningFeedback(
  userId: string,
  problem: Problem,
  picked: PatternId[],
  result: AttemptResult,
  answers: GuideAnswers,
  reasoning: string,
  locale: Locale,
): Promise<WithSource<ReasoningFeedback>> {
  const offline = () => heuristicReasoning(problem, picked, result, answers, reasoning, locale);
  const llm = await guardedLLM("algo_feedback", userId);
  if (llm.name === "mock") return { value: offline(), source: "offline", model: null };
  try {
    const raw = await llm.complete(reasoningPrompt(problem, picked, result, answers, reasoning, locale), {
      schema: reasoningFeedbackSchema,
      maxTokens: 700,
    });
    const fb = normalizeReasoning(JSON.parse(raw));
    if (fb) return { value: fb, source: "ai", model: llm.name };
  } catch (e) {
    if (e instanceof AiLimitError) return { value: offline(), source: "limited", model: null, reason: e.reason };
  }
  return { value: offline(), source: "offline", model: null };
}

export async function walkthrough(userId: string, text: string, locale: Locale): Promise<WithSource<Walkthrough>> {
  const offline = () => heuristicWalkthrough(text, locale);
  const llm = await guardedLLM("algo_walkthrough", userId);
  if (llm.name === "mock") return { value: offline(), source: "offline", model: null };
  try {
    const raw = await llm.complete(walkthroughPrompt(text, locale), { schema: walkthroughSchema, maxTokens: 1200 });
    const w = normalizeWalkthrough(JSON.parse(raw));
    if (w) return { value: w, source: "ai", model: llm.name };
  } catch (e) {
    if (e instanceof AiLimitError) return { value: offline(), source: "limited", model: null, reason: e.reason };
  }
  return { value: offline(), source: "offline", model: null };
}
