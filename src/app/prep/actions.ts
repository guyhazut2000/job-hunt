"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  debriefSchema,
  prepQuestionsSchema,
  prepStagesSchema,
  type DebriefInput,
  type PrepLang,
  type PrepQuestion,
  type PrepStage,
  type PrepSummary,
} from "@/lib/prep/plan";
import { generatePrepSummary, labelFor } from "@/lib/prep/server";
import { requireUser } from "@/lib/session";

const TOPIC = /^(ds|pattern):[a-z0-9-]{1,40}$/;

const saveSchema = z.object({
  applicationId: z.string().min(1),
  stages: prepStagesSchema,
  storyIds: z.array(z.string().min(1).max(40)).max(20),
  topics: z.array(z.string().regex(TOPIC)).max(20),
  questions: prepQuestionsSchema,
});

export interface PrepSaveInput {
  applicationId: string;
  stages: PrepStage[];
  storyIds: string[];
  topics: string[];
  questions: PrepQuestion[];
}

async function ownedApp(userId: string, applicationId: string) {
  return db.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
}

export async function savePrep(input: PrepSaveInput): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const p = saveSchema.safeParse(input);
  if (!p.success) return { error: "invalid" };
  if (!(await ownedApp(user.id, p.data.applicationId))) return { error: "not_found" };
  const stories = await db.workStory.findMany({
    where: { userId: user.id, id: { in: p.data.storyIds } },
    select: { id: true },
  });
  const data = {
    stages: p.data.stages,
    storyIds: stories.map((s) => s.id),
    topics: [...new Set(p.data.topics)],
    questions: p.data.questions,
  };
  await db.interviewPrep.upsert({
    where: { applicationId: p.data.applicationId },
    create: { userId: user.id, applicationId: p.data.applicationId, ...data },
    update: data,
  });
  track("prep_saved", { stages: data.stages.length, stories: data.storyIds.length, topics: data.topics.length });
  revalidatePath(`/prep/${p.data.applicationId}`);
  return { ok: true };
}

export async function generateSummary(
  applicationId: string,
  lang: PrepLang,
): Promise<{ ok: true; summary: PrepSummary } | { error: string }> {
  const user = await requireUser();
  const app = await db.application.findFirst({
    where: { id: applicationId, userId: user.id },
    include: { job: { select: { description: true, techStack: true } }, interviewPrep: { select: { stages: true } } },
  });
  if (!app) return { error: "not_found" };
  const stages = prepStagesSchema.safeParse(app.interviewPrep?.stages ?? []);
  const label = labelFor(lang);
  const summary = await generatePrepSummary(
    user.id,
    {
      title: app.title,
      company: app.company,
      techStack: app.job?.techStack ?? [],
      stages: (stages.success ? stages.data : []).map((s) => s.title || label(s.kind)),
      description: app.job?.description?.slice(0, 1500) ?? null,
      topics: [],
    },
    lang === "en" ? "en" : "he",
  );
  await db.interviewPrep.upsert({
    where: { applicationId },
    create: { userId: user.id, applicationId, summary: { ...summary } },
    update: { summary: { ...summary } },
  });
  track("prep_summary", { source: summary.source });
  revalidatePath(`/prep/${applicationId}`);
  return { ok: true, summary };
}

export async function saveDebrief(input: DebriefInput): Promise<{ ok: true; id: string } | { error: string }> {
  const user = await requireUser();
  const p = debriefSchema.safeParse(input);
  if (!p.success) return { error: "invalid" };
  if (!(await ownedApp(user.id, p.data.applicationId))) return { error: "not_found" };
  const row = await db.interviewDebrief.create({ data: { userId: user.id, ...p.data } });
  track("debrief_saved", { stage: p.data.stageKind, rating: p.data.rating, outcome: p.data.outcome });
  revalidatePath(`/prep/${p.data.applicationId}`);
  revalidatePath("/stats");
  return { ok: true, id: row.id };
}

export async function deleteDebrief(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const row = await db.interviewDebrief.findFirst({ where: { id, userId: user.id }, select: { applicationId: true } });
  if (!row) return { error: "not_found" };
  await db.interviewDebrief.delete({ where: { id } });
  revalidatePath(`/prep/${row.applicationId}`);
  revalidatePath("/stats");
  return { ok: true };
}
