"use server";

import { guardedLLM } from "@/lib/ai";
import { db } from "@/lib/db";
import { loadGapReport } from "@/lib/gaps/server";
import { getLocale, type Locale } from "@/lib/i18n";
import { getProgress } from "@/lib/learning/server";
import { buildStudySkills, generateStudyPlan, type PersonalStudyPlan } from "@/lib/learning/study-plan";
import { requireUser } from "@/lib/session";

export type StudyPlanActionState = { ok: true; plan: PersonalStudyPlan } | { ok: false; error: "empty" | "no-roadmap" };

/** One study_plan call for the signed-in user. Skills are recomputed here; the form sends nothing. */
export async function generatePersonalStudyPlan(
  prev: StudyPlanActionState | null,
  form: FormData,
): Promise<StudyPlanActionState> {
  void prev;
  void form;
  const user = await requireUser("/learn/gaps");
  const locale = await getLocale();
  const [{ report }, progress, prefs] = await Promise.all([
    loadGapReport(user.id),
    getProgress(user.id),
    db.learningPrefs.findUnique({ where: { userId: user.id }, select: { weeklyGoalHours: true } }),
  ]);
  if (!report || report.gaps.length === 0) return { ok: false, error: "empty" };
  const lang: Locale = locale === "en" ? "en" : "he";
  const skills = buildStudySkills(
    report.gaps,
    new Set(progress.filter((p) => p.status === "DONE").map((p) => p.skill)),
    lang,
  );
  if (skills.length === 0) return { ok: false, error: "no-roadmap" };
  const llm = await guardedLLM("study_plan", user.id);
  const plan = await generateStudyPlan({ skills, hoursPerWeek: prefs?.weeklyGoalHours ?? 5, locale: lang }, llm);
  return { ok: true, plan };
}
