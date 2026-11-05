/**
 * Deterministic learning helpers. The personalised plan (weeks, interview questions, CV bullet)
 * lives in `./study-plan.ts` and goes through `guardedLLM("study_plan")`; this file packs weeks
 * and applies the shared monthly regeneration cap.
 */
import type { GapPlan } from "./graph";

/**
 * Whether a user may trigger another AI learning generation this month. The limit is the same for
 * everyone (AI_USER_MONTHLY_REGEN_LIMIT, see src/lib/ai/config.ts) and protects the free Gemini quota;
 * the AI_* guard's daily/global caps still apply on top.
 */
export function canUseLearningAi(usedThisMonth: number, monthlyLimit: number): boolean {
  return usedThisMonth < monthlyLimit;
}

export interface StudyWeek {
  week: number;
  skillIds: string[];
  goals: string[];
  hours: number;
}

/** Pack ordered steps into weeks. A step stays whole; a new week starts when it would pass 1.5× the budget. */
export function packStudyWeeks(steps: { id: string; hours: number; goals: string[] }[], hoursPerWeek = 8): StudyWeek[] {
  const weeks: StudyWeek[] = [];
  let cur: StudyWeek = { week: 1, skillIds: [], goals: [], hours: 0 };
  for (const step of steps) {
    if (cur.hours > 0 && cur.hours + step.hours > hoursPerWeek * 1.5) {
      weeks.push(cur);
      cur = { week: cur.week + 1, skillIds: [], goals: [], hours: 0 };
    }
    cur.skillIds.push(step.id);
    cur.goals.push(...step.goals);
    cur.hours += step.hours;
  }
  if (cur.skillIds.length) weeks.push(cur);
  return weeks;
}

/** Deterministic fallback: pack the ordered gap plan into weeks of `hoursPerWeek`. */
export function heuristicStudyPlan(plan: GapPlan, hoursPerWeek = 8): StudyWeek[] {
  return packStudyWeeks(
    plan.steps.map((step) => ({
      id: step.node.id,
      hours: step.hours,
      goals: step.node.stages.fundamentals.slice(0, 2),
    })),
    hoursPerWeek,
  );
}
