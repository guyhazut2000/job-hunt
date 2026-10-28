"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { guardedLLM } from "@/lib/ai";
import { aiConfig } from "@/lib/ai/config";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import type { AiLimitReason } from "@/lib/ai/errors";
import { canUseLearningAi } from "@/lib/learning/ai";
import {
  ANSWER_MAX,
  ANSWER_MIN,
  FEEDBACK_KINDS,
  type AnswerFeedback,
  type FeedbackSource,
} from "@/lib/learning/feedback";
import { findFeedbackItem, gradeAnswer } from "@/lib/learning/feedback-server";
import { GRAPH } from "@/lib/learning/graph";
import { generateStageContent, REGEN_PER_STAGE, regenUsedThisMonth } from "@/lib/learning/hub";
import { allStagesDone, nextReview, parsePractice } from "@/lib/learning/progress";
import { applySkillStatus, revalidateLearning } from "@/lib/learning/status";
import { STAGES } from "@/lib/learning/types";
import { requireUser } from "@/lib/session";

const skillStage = { skill: z.string().min(1).max(60), stage: z.enum(STAGES) };

function validNode(skill: string) {
  return GRAPH.byId.get(skill) ?? null;
}

/** Make sure a skill the user works on is at least LEARNING (never downgrades DONE). */
async function ensureLearning(userId: string, skill: string) {
  const p = await db.skillProgress.findUnique({ where: { userId_skill: { userId, skill } } });
  if (!p) await applySkillStatus(userId, skill, "LEARNING");
}

async function touchStage(userId: string, skill: string, stage: string, data: Prisma.StageProgressUpdateInput = {}) {
  return db.stageProgress.upsert({
    where: { userId_skill_stage: { userId, skill, stage } },
    create: { userId, skill, stage, ...(data as object) },
    update: data,
  });
}

export type HubResult = { ok: true; skillDone?: boolean; added?: boolean } | { ok: false; error: string };

const topicInput = z.object({ ...skillStage, topic: z.string().min(1).max(200), done: z.boolean() });

export async function toggleTopic(raw: z.input<typeof topicInput>): Promise<HubResult> {
  const user = await requireUser();
  const p = topicInput.safeParse(raw);
  const node = p.success ? validNode(p.data.skill) : null;
  if (!p.success || !node || !node.stages[p.data.stage].includes(p.data.topic)) return { ok: false, error: "invalid" };
  const { skill, stage, topic, done } = p.data;
  const row = await db.stageProgress.findUnique({ where: { userId_skill_stage: { userId: user.id, skill, stage } } });
  const set = new Set(row?.topicsDone ?? []);
  if (done) set.add(topic);
  else set.delete(topic);
  await touchStage(user.id, skill, stage, { topicsDone: [...set] });
  await ensureLearning(user.id, skill);
  revalidateLearning(skill);
  return { ok: true };
}

const stageInput = z.object({ ...skillStage, done: z.boolean() });

/** Mark a stage done/undone. All three done → the skill becomes DONE (added to profile, match recalculates). */
export async function setStageDone(raw: z.input<typeof stageInput>): Promise<HubResult> {
  const user = await requireUser();
  const p = stageInput.safeParse(raw);
  if (!p.success || !validNode(p.data.skill)) return { ok: false, error: "invalid" };
  const { skill, stage, done } = p.data;
  await touchStage(user.id, skill, stage, { status: done ? "DONE" : "LEARNING" });
  const rows = await db.stageProgress.findMany({
    where: { userId: user.id, skill },
    select: { skill: true, stage: true, status: true },
  });
  const prog = await db.skillProgress.findUnique({ where: { userId_skill: { userId: user.id, skill } } });
  let skillDone = false;
  let added = false;
  if (allStagesDone(skill, rows)) {
    skillDone = true;
    if (prog?.status !== "DONE") added = await applySkillStatus(user.id, skill, "DONE");
  } else if (prog?.status === "DONE" && !done) {
    await applySkillStatus(user.id, skill, "LEARNING");
  } else if (!prog) {
    await applySkillStatus(user.id, skill, "LEARNING");
  }
  revalidateLearning(skill);
  return { ok: true, skillDone, added };
}

const practiceInput = z.object({
  ...skillStage,
  exerciseId: z.string().min(1).max(40),
  done: z.boolean(),
  notes: z.string().max(4000).optional(),
});

export async function savePractice(raw: z.input<typeof practiceInput>): Promise<HubResult> {
  const user = await requireUser();
  const p = practiceInput.safeParse(raw);
  if (!p.success || !validNode(p.data.skill)) return { ok: false, error: "invalid" };
  const { skill, stage, exerciseId, done, notes } = p.data;
  const row = await db.stageProgress.findUnique({ where: { userId_skill_stage: { userId: user.id, skill, stage } } });
  const practice = parsePractice(row?.practice);
  practice[exerciseId] = {
    done,
    ...(notes !== undefined
      ? { notes: notes.trim() }
      : practice[exerciseId]?.notes
        ? { notes: practice[exerciseId].notes }
        : {}),
  };
  // Bound the map so one row can't grow without limit.
  const entries = Object.entries(practice).slice(-30);
  await touchStage(user.id, skill, stage, { practice: Object.fromEntries(entries) as Prisma.InputJsonValue });
  await ensureLearning(user.id, skill);
  revalidateLearning(skill);
  return { ok: true };
}

const sessionInput = z.object({
  skill: z.string().min(1).max(60),
  stage: z.enum(STAGES).optional(),
  minutes: z.coerce.number().int().min(5).max(600),
  note: z.string().trim().max(500).optional(),
});

export async function logStudySession(raw: z.input<typeof sessionInput>): Promise<HubResult> {
  const user = await requireUser();
  const p = sessionInput.safeParse(raw);
  if (!p.success || !validNode(p.data.skill)) return { ok: false, error: "invalid" };
  const today = await db.studySession.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (today >= 30) return { ok: false, error: "limit" };
  await db.studySession.create({ data: { userId: user.id, ...p.data, note: p.data.note || null } });
  await ensureLearning(user.id, p.data.skill);
  revalidateLearning(p.data.skill);
  return { ok: true };
}

const goalInput = z.object({ hours: z.coerce.number().int().min(1).max(60) });

export async function setWeeklyGoal(raw: z.input<typeof goalInput>): Promise<HubResult> {
  const user = await requireUser();
  const p = goalInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  await db.learningPrefs.upsert({
    where: { userId: user.id },
    create: { userId: user.id, weeklyGoalHours: p.data.hours },
    update: { weeklyGoalHours: p.data.hours },
  });
  revalidateLearning("");
  return { ok: true };
}

const rateInput = z.object({
  ...skillStage,
  questionId: z.string().min(1).max(40),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1800),
  rating: z.enum(["KNEW", "PARTLY", "MISSED"]),
});

export async function rateQuestion(raw: z.input<typeof rateInput>): Promise<HubResult & { dueAt?: string }> {
  const user = await requireUser();
  const p = rateInput.safeParse(raw);
  if (!p.success || !validNode(p.data.skill)) return { ok: false, error: "invalid" };
  const { skill, stage, questionId, question, answer, rating } = p.data;
  const key = { userId_skill_stage_questionId: { userId: user.id, skill, stage, questionId } };
  const prev = await db.questionReview.findUnique({ where: key });
  const next = nextReview(rating, prev?.reps ?? 0, new Date());
  await db.questionReview.upsert({
    where: key,
    create: { userId: user.id, skill, stage, questionId, question, answer, rating, ...next },
    update: { rating, question, answer, ...next },
  });
  await touchStage(user.id, skill, stage);
  await ensureLearning(user.id, skill);
  revalidateLearning(skill);
  return { ok: true, dueAt: next.dueAt.toISOString() };
}

export type RegenResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "monthly_cap" | "stage_cap" | "ai_off" | "limited" | "failed"; reason?: string };

/** Regenerate the shared content of one stage. Limited per user per month (same limit for everyone) and capped per stage. */
export async function regenerateStage(raw: { skill: string; stage: string }): Promise<RegenResult> {
  const user = await requireUser();
  const p = z.object(skillStage).safeParse(raw);
  const node = p.success ? validNode(p.data.skill) : null;
  if (!p.success || !node) return { ok: false, error: "invalid" };
  const { stage } = p.data;
  const locale = await getLocale();
  const where = { skill_stage_locale: { skill: node.id, stage, locale } };
  const row = await db.stageContent.findUnique({ where });
  if ((row?.regenCount ?? 0) >= REGEN_PER_STAGE) return { ok: false, error: "stage_cap" };
  if (!canUseLearningAi(await regenUsedThisMonth(user.id), aiConfig().userMonthlyRegenLimit))
    return { ok: false, error: "monthly_cap" };
  const llm = await guardedLLM("learn_regen", user.id);
  if (llm.name === "mock") return { ok: false, error: "ai_off" };
  const gen = await generateStageContent(llm, node, stage, locale, (row?.regenCount ?? 0) + 1);
  if (!gen.content)
    return gen.limited ? { ok: false, error: "limited", reason: gen.limited } : { ok: false, error: "failed" };
  const data = { source: "ai", model: llm.name, content: gen.content as unknown as Prisma.InputJsonValue };
  await db.stageContent.upsert({
    where,
    create: { skill: node.id, stage, locale, ...data, regenCount: 1 },
    update: { ...data, regenCount: { increment: 1 } },
  });
  revalidateLearning(node.id);
  return { ok: true };
}

const feedbackInput = z.object({
  ...skillStage,
  kind: z.enum(FEEDBACK_KINDS),
  itemId: z.string().min(1).max(40),
  answer: z.string().trim().min(ANSWER_MIN).max(ANSWER_MAX),
});

export type FeedbackResult =
  | { ok: true; feedback: AnswerFeedback; source: FeedbackSource; reason?: AiLimitReason }
  | { ok: false; error: "invalid" | "not_found" | "too_short" };

/**
 * Feedback on the user's own answer to one exercise or question of a stage. Goes through the
 * shared AI guard (DB cache + per-user/global free-tier limits); falls back to an offline
 * key-term check when the AI is off or limited. The latest result per item is stored.
 */
export async function reviewAnswer(raw: z.input<typeof feedbackInput>): Promise<FeedbackResult> {
  const user = await requireUser();
  const p = feedbackInput.safeParse(raw);
  if (!p.success) {
    const short = typeof raw?.answer === "string" && raw.answer.trim().length < ANSWER_MIN;
    return { ok: false, error: short ? "too_short" : "invalid" };
  }
  const node = validNode(p.data.skill);
  if (!node) return { ok: false, error: "invalid" };
  const { skill, stage, kind, itemId, answer } = p.data;
  const locale = await getLocale();
  const item = await findFeedbackItem(node, stage, locale, kind, itemId);
  if (!item) return { ok: false, error: "not_found" };

  const r = await gradeAnswer(user.id, node, stage, item, answer, locale);
  const data = {
    kind,
    answer,
    result: r.feedback as unknown as Prisma.InputJsonValue,
    source: r.source,
    model: r.model,
  };
  await db.answerFeedback.upsert({
    where: { userId_skill_stage_itemId: { userId: user.id, skill, stage, itemId } },
    create: { userId: user.id, skill, stage, itemId, ...data },
    update: data,
  });
  if (kind === "exercise") {
    // The answer is the exercise's "my work" notes: keep them in sync.
    const row = await db.stageProgress.findUnique({ where: { userId_skill_stage: { userId: user.id, skill, stage } } });
    const practice = parsePractice(row?.practice);
    practice[itemId] = { done: practice[itemId]?.done ?? false, notes: answer };
    const entries = Object.entries(practice).slice(-30);
    await touchStage(user.id, skill, stage, { practice: Object.fromEntries(entries) as Prisma.InputJsonValue });
  } else {
    await touchStage(user.id, skill, stage);
  }
  await ensureLearning(user.id, skill);
  return { ok: true, feedback: r.feedback, source: r.source, ...(r.reason ? { reason: r.reason } : {}) };
}
