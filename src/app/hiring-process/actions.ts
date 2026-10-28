"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { STAGE_KINDS } from "@/lib/hiring/kinds";
import { requireUser } from "@/lib/session";

export type MyProcessState =
  { ok: true; deleted?: boolean } | { ok?: false; error: "invalid" | "not_found" | "rate" } | undefined;

const MAX_STAGES = 12;
/** Max saves per user per rolling hour. */
const HOURLY_LIMIT = 30;

const stageSchema = z.object({
  kind: z.enum(STAGE_KINDS),
  title: z.string().trim().max(80).default(""),
  note: z.string().trim().max(300).default(""),
});
const schema = z.object({
  companyId: z.string().min(1).max(40),
  jobId: z.string().max(40).optional(),
  intent: z.enum(["save", "delete"]).default("save"),
  estimatedDuration: z.string().trim().max(60).optional(),
  stages: z
    .string()
    .max(10_000)
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom" });
        return z.NEVER;
      }
    })
    .pipe(z.array(stageSchema).max(MAX_STAGES))
    .optional(),
});

async function revalidate(companyId: string, jobId?: string) {
  const c = await db.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  if (c) revalidatePath(`/companies/${c.slug}`);
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/** Save (replace) or delete the signed-in user's own hiring process for a company. Visible only to them. */
export async function saveMyHiringProcess(_prev: MyProcessState, form: FormData): Promise<MyProcessState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const { companyId, jobId, intent, estimatedDuration } = parsed.data;
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { error: "not_found" };

  const where = { companyId, userId: user.id, kind: "user" };
  if (intent === "delete") {
    await db.hiringProcess.deleteMany({ where });
    await revalidate(companyId, jobId);
    return { ok: true, deleted: true };
  }
  const stages = parsed.data.stages ?? [];
  if (stages.length === 0) return { error: "invalid" };
  const recent = await db.hiringProcess.count({
    where: { userId: user.id, kind: "user", updatedAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= HOURLY_LIMIT) return { error: "rate" };

  await db.$transaction([
    db.hiringProcess.deleteMany({ where }),
    db.hiringProcess.create({
      data: {
        ...where,
        status: "found",
        confidence: "high",
        method: "user",
        estimatedDuration: estimatedDuration || null,
        stages: {
          create: stages.map((s, i) => ({
            order: i,
            kind: s.kind,
            title: s.title,
            detailHe: s.note || null,
            detailEn: s.note || null,
          })),
        },
      },
    }),
  ]);
  await revalidate(companyId, jobId);
  return { ok: true };
}

export type StageState = { ok: true } | { ok?: false; error: "invalid" } | undefined;

const stageForm = z.object({
  applicationId: z.string().min(1).max(40),
  stage: z.union([z.enum(STAGE_KINDS), z.literal("")]),
});

/** Mark the current hiring-process stage on one of the signed-in user's applications ("" clears it). */
export async function setApplicationStage(_prev: StageState, form: FormData): Promise<StageState> {
  const user = await requireUser();
  const parsed = stageForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const { applicationId, stage } = parsed.data;
  const res = await db.application.updateMany({
    where: { id: applicationId, userId: user.id },
    data: { currentStage: stage || null, currentStageAt: stage ? new Date() : null },
  });
  if (res.count === 0) return { error: "invalid" };
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { jobId: true } });
  if (app) revalidatePath(`/jobs/${app.jobId}`);
  return { ok: true };
}
