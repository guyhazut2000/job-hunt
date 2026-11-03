import "server-only";
import type { Prisma } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { db } from "@/lib/db";
import { isStageKind, STAGE_LABELS } from "@/lib/hiring/kinds";
import { loadHiringProcess } from "@/lib/hiring/server";
import {
  debriefStats,
  defaultQuestions,
  defaultStages,
  parseQuestions,
  parseStages,
  parseSummary,
  suggestStories,
  suggestTopics,
  summaryPrompt,
  summaryAiSchema,
  templateSummary,
  validateAiSummary,
  type PrepFacts,
  type PrepLang,
  type PrepQuestion,
  type PrepStage,
  type PrepSummary,
} from "./plan";

export const labelFor = (lang: PrepLang) => (kind: string) => (isStageKind(kind) ? STAGE_LABELS[lang][kind] : kind);

export interface PrepView {
  app: {
    id: string;
    title: string;
    company: string;
    status: string;
    url: string | null;
    jobId: string | null;
    companySlug: string | null;
    interviewAt: string | null;
    interviewNote: string | null;
    techStack: string[];
  };
  saved: boolean;
  stages: PrepStage[];
  stagesSource: "saved" | "mine" | "official" | "default";
  storyIds: string[];
  topics: string[];
  suggestedTopics: string[];
  suggestedStoryIds: string[];
  questions: PrepQuestion[];
  summary: PrepSummary | null;
  stories: Array<{ id: string; kind: string; itemId: string; situation: string; built: string }>;
  debriefs: Array<{
    id: string;
    stageKind: string;
    happenedAt: string;
    rating: number;
    asked: string;
    wentWell: string;
    improve: string;
    outcome: string;
  }>;
}

/** Everything the /prep/[id] page needs; null when the application isn't the user's. */
export async function loadPrep(userId: string, applicationId: string, lang: PrepLang): Promise<PrepView | null> {
  const app = await db.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: {
        select: {
          title: true,
          description: true,
          techStack: true,
          companyId: true,
          company: { select: { slug: true } },
        },
      },
      interviewPrep: true,
      debriefs: { orderBy: { happenedAt: "desc" }, take: 20 },
    },
  });
  if (!app) return null;
  const [hiring, stories] = await Promise.all([
    app.job?.companyId ? loadHiringProcess({ companyId: app.job.companyId, jobId: app.jobId, userId }) : null,
    db.workStory.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, kind: true, itemId: true, situation: true, built: true },
      take: 200,
    }),
  ]);
  const prep = app.interviewPrep;
  const mine = hiring?.mine?.stages ?? [];
  const official = hiring?.official?.stages ?? [];
  const savedStages = prep ? parseStages(prep.stages) : [];
  const stagesSource: PrepView["stagesSource"] = savedStages.length
    ? "saved"
    : mine.length
      ? "mine"
      : official.length
        ? "official"
        : "default";
  const stages = savedStages.length
    ? savedStages
    : defaultStages(mine.length ? mine : official, labelFor(lang), app.interviewAt);
  const techStack = app.job?.techStack ?? [];
  const suggestedTopics = suggestTopics(
    { title: app.title, description: app.job?.description, techStack },
    stages.map((s) => s.kind),
  );
  const suggestedStoryIds = suggestStories(stories, suggestedTopics, techStack);
  const savedQuestions = prep ? parseQuestions(prep.questions) : [];
  return {
    app: {
      id: app.id,
      title: app.title,
      company: app.company,
      status: app.status,
      url: app.url,
      jobId: app.jobId,
      companySlug: app.job?.company?.slug ?? null,
      interviewAt: app.interviewAt?.toISOString() ?? null,
      interviewNote: app.interviewNote,
      techStack,
    },
    saved: !!prep,
    stages,
    stagesSource,
    storyIds: prep ? prep.storyIds.filter((id) => stories.some((s) => s.id === id)) : suggestedStoryIds,
    topics: prep ? prep.topics : suggestedTopics,
    suggestedTopics,
    suggestedStoryIds,
    questions:
      savedQuestions.length || prep
        ? savedQuestions
        : defaultQuestions(
            stages.map((s) => s.kind),
            lang,
          ),
    summary: prep ? parseSummary(prep.summary) : null,
    stories,
    debriefs: app.debriefs.map((d) => ({
      id: d.id,
      stageKind: d.stageKind,
      happenedAt: d.happenedAt.toISOString(),
      rating: d.rating,
      asked: d.asked,
      wentWell: d.wentWell,
      improve: d.improve,
      outcome: d.outcome,
    })),
  };
}

/** AI overview (feature "interview_prep") with a template fallback. Never throws. */
export async function generatePrepSummary(userId: string, facts: PrepFacts, lang: PrepLang): Promise<PrepSummary> {
  const template = templateSummary(facts, lang);
  const llm = await guardedLLM("interview_prep", userId);
  if (llm.name === "mock") return template;
  try {
    const raw = await llm.complete(summaryPrompt(facts, lang), { schema: summaryAiSchema, maxTokens: 700 });
    return validateAiSummary(JSON.parse(raw), facts) ?? template;
  } catch (e) {
    if (e instanceof AiLimitError) return { ...template, source: "limited" };
    return template;
  }
}

/** Debrief numbers for /stats. */
export async function loadDebriefStats(userId: string) {
  const rows = await db.interviewDebrief.findMany({
    where: { userId },
    orderBy: { happenedAt: "desc" },
    select: { stageKind: true, rating: true, outcome: true, improve: true },
    take: 500,
  });
  return debriefStats(rows);
}

export type PrepUpsert = Prisma.InterviewPrepUncheckedCreateInput;
