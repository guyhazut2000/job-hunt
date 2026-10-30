"use server";

import type { ApplicationStatus, EmailProvider } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/email/crypto";
import { getProvider, messageUrl } from "@/lib/email/providers";
import { logStatusChange, undoAutoChange } from "@/lib/email/auto-apply";
import { notifyAutoChanges } from "@/lib/email/auto-notify";
import { applyPendingCandidates, getSettings, scanUser, type ScanSummary } from "@/lib/email/scan";
import { MAX_AUTO_THRESHOLD, MIN_AUTO_THRESHOLD, nextStatus } from "@/lib/email/score";
import { requireUser } from "@/lib/session";

const settingsSchema = z.object({
  lookback: z.string(),
  customDays: z.coerce.number().int().min(1).max(365).optional(),
  frequency: z.enum(["MANUAL", "DAILY", "EVERY_6H"]),
  autoApplyThreshold: z.coerce.number().int().min(MIN_AUTO_THRESHOLD).max(MAX_AUTO_THRESHOLD),
  autoApplyEnabled: z.string().optional(),
  detectStatusUpdates: z.string().optional(),
});

export type EmailFormState = { ok?: boolean; error?: string; applied?: number } | undefined;

export async function saveEmailSettings(_: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = settingsSchema.safeParse({ ...raw, customDays: raw.customDays || undefined });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  const lookbackDays = d.lookback === "custom" ? d.customDays : Number(d.lookback);
  if (!lookbackDays || lookbackDays < 1 || lookbackDays > 365) return { error: "invalid_days" };
  await getSettings(user.id);
  const settings = await db.emailSyncSettings.update({
    where: { userId: user.id },
    data: {
      lookbackDays,
      frequency: d.frequency,
      autoApplyEnabled: d.autoApplyEnabled === "on",
      autoApplyThreshold: d.autoApplyThreshold,
      detectStatusUpdates: d.detectStatusUpdates === "on",
    },
  });
  // A lower threshold (or turning automation on) applies waiting review items right away.
  const applied = await applyPendingCandidates(user.id, settings);
  if (applied.length) {
    await notifyAutoChanges(user.id, applied).catch(() => null);
    revalidatePath("/dashboard");
  }
  revalidatePath("/settings/email");
  return { ok: true, applied: applied.length };
}

export async function scanEmailNow(): Promise<ScanSummary | { error: string }> {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  // Light rate limit: one manual scan per 30s.
  if (settings.lastScanAt && Date.now() - settings.lastScanAt.getTime() < 30_000 && !settings.lastScanError)
    return (settings.lastScanSummary as unknown as ScanSummary) ?? { error: "scan_failed" };
  const res = await scanUser(user.id, "manual");
  revalidatePath("/settings/email");
  revalidatePath("/dashboard");
  return res;
}

export async function disconnectEmail(provider: EmailProvider) {
  const user = await requireUser();
  const account = await db.emailAccount.findUnique({ where: { userId_provider: { userId: user.id, provider } } });
  if (!account) return;
  const p = getProvider(provider);
  if (p.revoke) {
    try {
      await p.revoke(decryptSecret(account.refreshTokenEnc));
    } catch {
      // best effort: still delete locally
    }
  }
  await db.emailAccount.delete({ where: { id: account.id } });
  revalidatePath("/settings/email");
}

const approveSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(["job", "custom", "app"]),
  jobId: z.string().optional(),
  applicationId: z.string().optional(),
  title: z.string().trim().max(150).optional(),
  company: z.string().trim().max(100).optional(),
});

export async function approveEmailCandidate(formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const f = parsed.data;
  const c = await db.emailCandidate.findFirst({ where: { id: f.id, userId: user.id, status: "PENDING" } });
  if (!c) return { error: "not_found" };
  const target: ApplicationStatus = c.kind === "APPLICATION" ? "APPLIED" : (c.detectedStatus ?? "APPLIED");
  const review = {
    userId: user.id,
    source: "EMAIL_REVIEW" as const,
    emailCandidateId: c.id,
    emailDate: c.receivedAt,
    confidence: c.confidence,
  };

  let applicationId: string;
  if (f.mode === "app") {
    const app = await db.application.findFirst({ where: { id: f.applicationId ?? "", userId: user.id } });
    if (!app) return { error: "not_found" };
    // The user explicitly approved: apply the detected status unless it would move backwards.
    const next = nextStatus(app.status, target) ?? (app.status === target ? null : target);
    if (next) {
      await db.application.update({ where: { id: app.id }, data: { status: next, statusChangedAt: new Date() } });
      await logStatusChange(db, {
        ...review,
        applicationId: app.id,
        from: app.status,
        to: next,
        prevStatusChangedAt: app.statusChangedAt,
      });
    }
    applicationId = app.id;
  } else if (f.mode === "job") {
    const job = await db.job.findUnique({
      where: { id: f.jobId ?? "" },
      select: { id: true, title: true, company: { select: { name: true } } },
    });
    if (!job) return { error: "not_found" };
    const existing = await db.application.findUnique({ where: { userId_jobId: { userId: user.id, jobId: job.id } } });
    if (existing) {
      const next = nextStatus(existing.status, target);
      if (next) {
        await db.application.update({
          where: { id: existing.id },
          data: { status: next, statusChangedAt: new Date() },
        });
        await logStatusChange(db, {
          ...review,
          applicationId: existing.id,
          from: existing.status,
          to: next,
          prevStatusChangedAt: existing.statusChangedAt,
        });
      }
      applicationId = existing.id;
    } else {
      const app = await db.application.create({
        data: {
          userId: user.id,
          jobId: job.id,
          title: job.title,
          company: job.company.name,
          status: target,
          appliedAt: c.receivedAt,
          statusChangedAt: new Date(),
          source: "EMAIL",
          emailMessageId: c.messageId,
        },
      });
      await logStatusChange(db, { ...review, applicationId: app.id, from: null, to: target });
      applicationId = app.id;
    }
  } else {
    const title = f.title || c.title;
    const company = f.company || c.company;
    if (!title || !company) return { error: "missing_fields" };
    const app = await db.application.create({
      data: {
        userId: user.id,
        title,
        company,
        url: messageUrl(c.provider, c.messageId),
        status: target,
        appliedAt: c.receivedAt,
        statusChangedAt: new Date(),
        source: "EMAIL",
        emailMessageId: c.messageId,
      },
    });
    await logStatusChange(db, { ...review, applicationId: app.id, from: null, to: target });
    applicationId = app.id;
  }
  await db.emailCandidate.update({ where: { id: c.id }, data: { status: "APPROVED", applicationId } });
  revalidatePath("/dashboard");
  return {};
}

export async function dismissEmailCandidate(id: string) {
  const user = await requireUser();
  await db.emailCandidate.updateMany({
    where: { id, userId: user.id, status: "PENDING" },
    data: { status: "DISMISSED" },
  });
  revalidatePath("/dashboard");
}

/** One-click undo of an automatic email change (restores the previous status, or removes an app it added). */
export async function undoEmailAutoChange(changeId: string): Promise<{ result: string }> {
  const user = await requireUser();
  if (typeof changeId !== "string" || !changeId) return { result: "not_found" };
  const result = await undoAutoChange(user.id, changeId);
  revalidatePath("/dashboard");
  return { result };
}
