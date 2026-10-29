"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { cleanAnswers, type GuideAnswers } from "@/lib/algo/checklist";
import { checkKeys, cleanPicks, gradePick, optionLabel, type AttemptResult } from "@/lib/algo/engine";
import {
  PROBLEM_TEXT_MAX,
  PROBLEM_TEXT_MIN,
  REASONING_MAX,
  type AlgoSource,
  type ReasoningFeedback,
  type Walkthrough,
} from "@/lib/algo/feedback";
import { reasoningFeedback, walkthrough } from "@/lib/algo/feedback-server";
import { PROBLEM_BY_ID } from "@/lib/algo/problems";
import { ATTEMPTS_PER_DAY, attemptsToday } from "@/lib/algo/server";
import { tr, type PatternId } from "@/lib/algo/types";
import { requireUser } from "@/lib/session";

const attemptInput = z.object({
  problemId: z.string().min(1).max(60),
  picked: z.array(z.string().max(40)).max(5),
  answers: z.record(z.string(), z.string().max(40).optional()).optional(),
  reasoning: z.string().max(REASONING_MAX).optional(),
});

export type AttemptResponse =
  | {
      ok: true;
      result: AttemptResult;
      answers: GuideAnswers;
      feedback: ReasoningFeedback;
      source: AlgoSource;
      reveal: Reveal;
    }
  | { ok: false; error: "invalid" | "no_pick" | "limit" };

/** What the problem expected; only sent after an attempt so the answer isn't in the page. */
export interface Reveal {
  patterns: PatternId[];
  alsoOk: PatternId[];
  why: string;
  leetcode: string | null;
  keys: { question: string; expected: string; given: string; ok: boolean }[];
}

function revalidate() {
  revalidatePath("/learn/problem-solving", "layout");
  revalidatePath("/learn/me");
}

/** Grade a pattern pick deterministically, then get feedback on the reasoning (AI or offline) and store it. */
export async function submitAttempt(raw: z.input<typeof attemptInput>): Promise<AttemptResponse> {
  const user = await requireUser();
  const p = attemptInput.safeParse(raw);
  const problem = p.success ? PROBLEM_BY_ID.get(p.data.problemId) : undefined;
  if (!p.success || !problem) return { ok: false, error: "invalid" };
  const picked = cleanPicks(p.data.picked);
  if (!picked.length) return { ok: false, error: "no_pick" };
  if ((await attemptsToday(user.id)) >= ATTEMPTS_PER_DAY) return { ok: false, error: "limit" };
  const answers = cleanAnswers(p.data.answers ?? {});
  const reasoning = (p.data.reasoning ?? "").trim();
  const result = gradePick(problem, picked);
  const locale = await getLocale();
  const fb = await reasoningFeedback(user.id, problem, picked, result, answers, reasoning, locale);
  await db.patternAttempt.create({
    data: {
      userId: user.id,
      mode: "practice",
      problemId: problem.id,
      answers: answers as Prisma.InputJsonValue,
      picked,
      expected: problem.patterns,
      result,
      reasoning,
      feedback: fb.value as unknown as Prisma.InputJsonValue,
      source: fb.source,
      model: fb.model,
    },
  });
  revalidate();
  const reveal: Reveal = {
    patterns: problem.patterns,
    alsoOk: problem.alsoOk ?? [],
    why: tr(problem.why, locale),
    leetcode: problem.leetcode ?? null,
    keys: checkKeys(problem, answers).map((k) => ({
      question: k.question,
      expected: optionLabel(k.question, k.expected, locale),
      given: optionLabel(k.question, k.given, locale),
      ok: k.ok,
    })),
  };
  return { ok: true, result, answers, feedback: fb.value, source: fb.source, reveal };
}

const analyzeInput = z.object({ text: z.string().trim().min(PROBLEM_TEXT_MIN).max(PROBLEM_TEXT_MAX) });

export type AnalyzeResponse =
  { ok: true; walkthrough: Walkthrough; source: AlgoSource } | { ok: false; error: "invalid" | "too_short" | "limit" };

/** Paste mode: walk the checklist on any problem text (AI with offline fallback). Stored for history. */
export async function analyzeProblem(raw: z.input<typeof analyzeInput>): Promise<AnalyzeResponse> {
  const user = await requireUser();
  const p = analyzeInput.safeParse(raw);
  if (!p.success) {
    const short = typeof raw?.text === "string" && raw.text.trim().length < PROBLEM_TEXT_MIN;
    return { ok: false, error: short ? "too_short" : "invalid" };
  }
  if ((await attemptsToday(user.id)) >= ATTEMPTS_PER_DAY) return { ok: false, error: "limit" };
  const locale = await getLocale();
  const w = await walkthrough(user.id, p.data.text, locale);
  await db.patternAttempt.create({
    data: {
      userId: user.id,
      mode: "paste",
      problemText: p.data.text,
      answers: w.value.answers as Prisma.InputJsonValue,
      picked: w.value.candidates.map((c) => c.pattern),
      expected: [],
      result: "analysis",
      feedback: w.value as unknown as Prisma.InputJsonValue,
      source: w.source,
      model: w.model,
    },
  });
  revalidate();
  return { ok: true, walkthrough: w.value, source: w.source };
}
