import type { Prisma } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import type { LLMProvider } from "@/lib/ai/types";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { hasScorableProfile, toCandidate } from "@/lib/profile/score";
import {
  genericStageContent,
  normalizeStageContent,
  stageContentPrompt,
  stageContentSchema,
  type ContentSource,
  type StageContentData,
} from "./content";
import { staticStageContent } from "./content-static";
import { GRAPH, knownSkillIds } from "./graph";
import { learningStats, reviewQueue, skillRollup, type StageRow } from "./progress";
import { impactMap, recommend } from "./recommend";
import { demandMap, getProgress } from "./server";
import { STAGES, type SkillNode, type Stage } from "./types";

/** Server-side data for the learning hub (dashboard + stage workspace). */

/** Regenerations allowed per shared (skill, stage, locale) row, on top of the per-user monthly limit. */
export const REGEN_PER_STAGE = 3;
const CONTENT_MAX_TOKENS = 3500;

export interface LoadedContent {
  content: StageContentData;
  source: ContentSource;
  model: string | null;
  regenCount: number;
  stored: boolean;
  limited: AiLimitReason | null;
}

export function fallbackContent(
  node: SkillNode,
  stage: Stage,
  locale: Locale,
): { content: StageContentData; source: ContentSource } {
  const curated = staticStageContent(node.id, stage, locale);
  return curated
    ? { content: curated, source: "static" }
    : { content: genericStageContent(node, stage, locale), source: "generic" };
}

/**
 * Ask the LLM for one stage's content. Returns null content on mock/invalid output, and the
 * limit reason when our limits or the provider's quota stopped the call.
 */
export async function generateStageContent(
  llm: LLMProvider,
  node: SkillNode,
  stage: Stage,
  locale: Locale,
  variation = 0,
): Promise<{ content: StageContentData | null; limited: AiLimitReason | null }> {
  if (llm.name === "mock") return { content: null, limited: null };
  const messages = stageContentPrompt(node, stage, locale);
  if (variation > 0)
    messages[1] = {
      ...messages[1],
      content: `${messages[1].content}\nVariation #${variation}: write different exercises and questions than before.`,
    };
  try {
    const raw = await llm.complete(messages, { schema: stageContentSchema, maxTokens: CONTENT_MAX_TOKENS });
    return { content: normalizeStageContent(JSON.parse(raw)), limited: null };
  } catch (e) {
    if (e instanceof AiLimitError) return { content: null, limited: e.reason };
    return { content: null, limited: null };
  }
}

/** Shared content for (skill, stage, locale): DB row → generate once with the LLM → curated/generic fallback. */
export async function loadStageContent(
  node: SkillNode,
  stage: Stage,
  locale: Locale,
  userId: string | null,
): Promise<LoadedContent> {
  const where = { skill_stage_locale: { skill: node.id, stage, locale } };
  const row = await db.stageContent.findUnique({ where });
  const fromRow = row && normalizeStageContent(row.content);
  if (row && fromRow)
    return {
      content: fromRow,
      source: row.source as ContentSource,
      model: row.model,
      regenCount: row.regenCount,
      stored: true,
      limited: null,
    };

  const llm = await guardedLLM("learn_content", userId);
  const gen = await generateStageContent(llm, node, stage, locale);
  if (gen.content) {
    const data = { source: "ai", model: llm.name, content: gen.content as unknown as Prisma.InputJsonValue };
    await db.stageContent
      .upsert({ where, create: { skill: node.id, stage, locale, ...data }, update: data })
      .catch(() => {}); // a concurrent first-open may have written it; either copy is fine
    return { content: gen.content, source: "ai", model: llm.name, regenCount: 0, stored: true, limited: null };
  }
  const fb = fallbackContent(node, stage, locale);
  return { ...fb, model: null, regenCount: 0, stored: false, limited: gen.limited };
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Successful content regenerations by this user this calendar month (the monthly-limited action). */
export function regenUsedThisMonth(userId: string): Promise<number> {
  return db.aiUsage.count({
    where: { userId, feature: "learn_regen", outcome: "ok", createdAt: { gte: monthStart() } },
  });
}

export async function stageRows(userId: string, skill?: string): Promise<StageRow[]> {
  const rows = await db.stageProgress.findMany({
    where: { userId, ...(skill ? { skill } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({ ...r, status: r.status }));
}

const SCORE_SELECT = { techStack: true, roleCategory: true, seniority: true, location: true, workMode: true } as const;
const IMPACT_SAMPLE = 300;

export async function getHubData(userId: string) {
  const now = new Date();
  const since60 = new Date(now.getTime() - 60 * 86_400_000);
  const [demand, progress, rows, profile, prefs, total, recentSessions, reviewsDue, reviewCount, recentReviews] =
    await Promise.all([
      demandMap(),
      getProgress(userId),
      stageRows(userId),
      db.profile.findUnique({ where: { userId } }),
      db.learningPrefs.findUnique({ where: { userId } }),
      db.studySession.aggregate({ where: { userId }, _sum: { minutes: true } }),
      db.studySession.findMany({
        where: { userId, createdAt: { gte: since60 } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.questionReview.findMany({ where: { userId, dueAt: { lte: now } }, orderBy: { dueAt: "asc" }, take: 30 }),
      db.questionReview.count({ where: { userId } }),
      db.questionReview.findMany({
        where: { userId, updatedAt: { gte: since60 } },
        select: { updatedAt: true },
        take: 500,
      }),
    ]);

  const statusOf = new Map(progress.map((p) => [p.skill, p.status]));
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const doneIds = progress.filter((p) => p.status === "DONE").map((p) => p.skill);
  const known = knownSkillIds(candidate?.skills ?? [], doneIds);

  // Active skills: LEARNING progress or any stage activity on a not-done skill.
  const activeIds = [
    ...new Set([...rows.map((r) => r.skill), ...progress.filter((p) => p.status === "LEARNING").map((p) => p.skill)]),
  ].filter((id) => GRAPH.byId.has(id) && statusOf.get(id) !== "DONE" && !known.has(id));
  const active = activeIds.map((id) => {
    const node = GRAPH.byId.get(id)!;
    const roll = skillRollup(node, rows, statusOf.get(id));
    const last = rows.find((r) => r.skill === id)?.updatedAt ?? progress.find((p) => p.skill === id)?.updatedAt ?? null;
    return { node, roll, last };
  });
  active.sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));

  // Impact over recent jobs in the user's target roles (widened when too few), for unknown skills only.
  let impact = new Map<string, { jobs: number; avgGain: number }>();
  if (candidate) {
    const sample = (roles?: string[]) =>
      db.job.findMany({
        where: { isActive: true, ...(roles?.length ? { roleCategory: { in: roles } } : {}) },
        select: SCORE_SELECT,
        orderBy: { postedAt: "desc" },
        take: IMPACT_SAMPLE,
      });
    let jobs = await sample(candidate.targetRoles);
    if (jobs.length < 20 && candidate.targetRoles.length) jobs = await sample();
    const ids = GRAPH.nodes
      .filter((n) => !known.has(n.id) && ((demand.get(n.id) ?? 0) > 0 || activeIds.includes(n.id)))
      .map((n) => n.id);
    impact = impactMap(candidate, jobs, ids);
  }
  const inProgress = new Map(active.map((a) => [a.node.id, a.roll.pct / 100]));
  const recs = recommend(
    {
      known,
      inProgress,
      impact,
      demand,
      targetRoles: candidate?.targetRoles ?? [],
    },
    6,
  );

  const stats = learningStats(
    recentSessions,
    [...rows.map((r) => r.updatedAt), ...recentReviews.map((r) => r.updatedAt)],
    now,
  );
  stats.totalMinutes = total._sum.minutes ?? 0;

  // Continue where you left off: the most recently touched stage that is not done.
  const lastRow = rows.find((r) => r.status !== "DONE" && activeIds.includes(r.skill));
  const resume = lastRow
    ? { skill: lastRow.skill, stage: lastRow.stage as Stage }
    : active[0]
      ? { skill: active[0].node.id, stage: active[0].roll.nextStage ?? STAGES[0] }
      : null;

  return {
    active,
    recs,
    stats,
    goalHours: prefs?.weeklyGoalHours ?? 5,
    hasGoal: !!prefs,
    reviews: reviewQueue(reviewsDue, now, 5),
    reviewsDueCount: reviewsDue.length,
    reviewCount,
    skillsDone: doneIds.filter((id) => GRAPH.byId.has(id)).length,
    resume,
    hasProfile: !!candidate,
    sessions: recentSessions.slice(0, 5),
    known,
    inProgress,
    targetRoles: candidate?.targetRoles ?? profile?.targetRoles ?? [],
  };
}

/** The tutor streams from Gemini only when a key is set and no other provider is forced (mock → offline replies). */
export function tutorIsLive(): boolean {
  const p = process.env.LLM_PROVIDER;
  return !!process.env.GEMINI_API_KEY?.trim() && (!p || p === "gemini");
}
