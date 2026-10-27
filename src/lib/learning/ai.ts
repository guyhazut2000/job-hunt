/**
 * v2 hooks for AI-assisted learning. Not wired to UI yet; see docs/learning.md.
 *
 * Every hook must:
 *  - go through `guardedLLM("study_plan", userId)` (src/lib/ai) so the AiCache + per-user/global
 *    free-tier limits apply, and respect the plan gate below;
 *  - use structured output (zod) and fall back to the deterministic result in this file when the
 *    provider is mock, limited, or returns invalid JSON;
 *  - answer in the user's locale (Hebrew by default), technical terms in English.
 */
import type { Plan } from "@prisma/client";
import type { Locale } from "@/lib/i18n";
import type { GapPlan } from "./graph";
import type { SkillNode } from "./types";

/** Monthly AI learning generations per plan (null = unlimited, still subject to the AI_* guard). */
export const LEARNING_AI_LIMITS: Record<Plan, number | null> = { FREE: 3, PRO: null };

export function canUseLearningAi(plan: Plan, usedThisMonth: number): boolean {
  const limit = LEARNING_AI_LIMITS[plan];
  return limit === null || usedThisMonth < limit;
}

export interface StudyWeek {
  week: number;
  skillIds: string[];
  goals: string[];
  hours: number;
}

/** Deterministic fallback: pack the ordered gap plan into weeks of `hoursPerWeek`. */
export function heuristicStudyPlan(plan: GapPlan, hoursPerWeek = 8): StudyWeek[] {
  const weeks: StudyWeek[] = [];
  let cur: StudyWeek = { week: 1, skillIds: [], goals: [], hours: 0 };
  for (const step of plan.steps) {
    if (cur.hours > 0 && cur.hours + step.hours > hoursPerWeek * 1.5) {
      weeks.push(cur);
      cur = { week: cur.week + 1, skillIds: [], goals: [], hours: 0 };
    }
    cur.skillIds.push(step.node.id);
    cur.goals.push(...step.node.stages.fundamentals.slice(0, 2));
    cur.hours += step.hours;
  }
  if (cur.skillIds.length) weeks.push(cur);
  return weeks;
}

// TODO(v2-ai): personalised plan. Input: GapPlan + profile summary + hours/week. Prompt the model
// to re-pace `heuristicStudyPlan` and pick stage topics the user lacks, never inventing resources
// (only node.docs / node.course URLs may appear). Output zod: StudyWeek[].
export interface PersonalPlanInput {
  userId: string;
  plan: GapPlan;
  hoursPerWeek: number;
  locale: Locale;
}

// TODO(v2-ai): interview questions per skill and stage, for self-check before marking DONE.
// Output zod: { question: string; level: Stage; answerHints: string[] }[] (5–8 items).
export interface InterviewQuestionsInput {
  userId: string;
  node: SkillNode;
  locale: Locale;
}

// TODO(v2-ai): CV bullet from the finished project + proof URL, e.g. after DONE. Output zod:
// { bullet: string } (≤ 180 chars, past tense, measurable). Offer it on /profile, never auto-save.
export interface CvBulletInput {
  userId: string;
  node: SkillNode;
  proofUrl: string | null;
  locale: Locale;
}
