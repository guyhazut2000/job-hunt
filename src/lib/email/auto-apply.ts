import type { ApplicationStatus, EmailProvider, Prisma, StatusChangeSource } from "@prisma/client";
import { db } from "@/lib/db";
import type { AppLike } from "./analyze";

/** One automatic change made by the email scan (returned for notifications and tests). */
export type AutoChange = {
  changeId: string;
  applicationId: string;
  company: string;
  title: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  confidence: number;
};

type Tx = Prisma.TransactionClient;

/** Signals that a concurrent scan / user action got there first; the caller skips the email. */
export class AlreadyHandled extends Error {}

/**
 * Latest effective time of each application's current status: the newest non-undone history entry
 * (email date for email-driven changes, else when it was logged), falling back to statusChangedAt.
 */
export async function statusTimes(
  userId: string,
  apps: { id: string; statusChangedAt: Date | null; appliedAt: Date | null; createdAt: Date }[],
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  for (const a of apps) out.set(a.id, a.statusChangedAt ?? a.appliedAt ?? a.createdAt);
  if (!apps.length) return out;
  const changes = await db.applicationStatusChange.findMany({
    where: { userId, undoneAt: null, applicationId: { in: apps.map((a) => a.id) } },
    select: { applicationId: true, emailDate: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  for (const c of changes) {
    if (seen.has(c.applicationId)) continue;
    seen.add(c.applicationId);
    out.set(c.applicationId, c.emailDate ?? c.createdAt);
  }
  return out;
}

export async function loadApps(userId: string): Promise<AppLike[]> {
  const apps = await db.application.findMany({
    where: { userId },
    select: {
      id: true,
      jobId: true,
      company: true,
      title: true,
      status: true,
      statusChangedAt: true,
      appliedAt: true,
      createdAt: true,
    },
  });
  const times = await statusTimes(userId, apps);
  return apps.map((a) => ({
    id: a.id,
    jobId: a.jobId,
    company: a.company,
    title: a.title,
    status: a.status,
    statusAt: times.get(a.id) ?? null,
  }));
}

/** The source email: a new candidate row to create, or an existing PENDING one to claim. */
export type CandidateRef =
  { create: Prisma.EmailCandidateUncheckedCreateInput } | { pendingId: string; receivedAt: Date };

async function attachCandidate(tx: Tx, ref: CandidateRef, applicationId: string, userId: string): Promise<string> {
  if ("create" in ref) {
    const c = await tx.emailCandidate.create({
      data: { ...ref.create, applicationId, status: "AUTO_ADDED" },
      select: { id: true },
    });
    return c.id;
  }
  const r = await tx.emailCandidate.updateMany({
    where: { id: ref.pendingId, userId, status: "PENDING" },
    data: { status: "AUTO_ADDED", applicationId },
  });
  if (r.count !== 1) throw new AlreadyHandled();
  return ref.pendingId;
}

/** Move an existing application to `to`, logging the change against the source email. */
export async function autoUpdate(input: {
  userId: string;
  app: AppLike;
  to: ApplicationStatus;
  confidence: number;
  emailDate: Date;
  candidate: CandidateRef;
}): Promise<AutoChange> {
  const { userId, app, to } = input;
  return db.$transaction(async (tx) => {
    const cur = await tx.application.findFirst({
      where: { id: app.id, userId },
      select: { status: true, statusChangedAt: true, company: true, title: true },
    });
    if (!cur || cur.status !== app.status) throw new AlreadyHandled();
    // Guard on the status we decided from, so a concurrent change isn't overwritten.
    const r = await tx.application.updateMany({
      where: { id: app.id, userId, status: app.status },
      data: {
        status: to,
        statusChangedAt: new Date(),
        ...(app.status === "SAVED" && to === "APPLIED" ? { appliedAt: input.emailDate } : {}),
      },
    });
    if (r.count !== 1) throw new AlreadyHandled();
    const candidateId = await attachCandidate(tx, input.candidate, app.id, userId);
    const log = await tx.applicationStatusChange.create({
      data: {
        userId,
        applicationId: app.id,
        fromStatus: app.status,
        toStatus: to,
        source: "EMAIL_AUTO",
        emailCandidateId: candidateId,
        confidence: input.confidence,
        emailDate: input.emailDate,
        prevStatusChangedAt: cur.statusChangedAt,
      },
      select: { id: true },
    });
    return {
      changeId: log.id,
      applicationId: app.id,
      company: cur.company,
      title: cur.title,
      fromStatus: app.status,
      toStatus: to,
      confidence: input.confidence,
    };
  });
}

/** Add a new application from an email (status APPLIED, or e.g. REJECTED for a rejection). */
export async function autoCreate(input: {
  userId: string;
  provider: EmailProvider;
  messageId: string;
  company: string;
  title: string | null;
  jobId: string | null;
  url: string | null;
  status: ApplicationStatus;
  confidence: number;
  emailDate: Date;
  candidate: CandidateRef;
}): Promise<AutoChange> {
  const { userId } = input;
  return db.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        userId,
        jobId: input.jobId,
        title: input.title ?? "—",
        company: input.company,
        url: input.jobId ? null : input.url,
        status: input.status,
        appliedAt: input.status === "SAVED" ? null : input.emailDate,
        statusChangedAt: new Date(),
        source: "EMAIL",
        emailMessageId: input.messageId,
      },
      select: { id: true, title: true, company: true },
    });
    const candidateId = await attachCandidate(tx, input.candidate, app.id, userId);
    const log = await tx.applicationStatusChange.create({
      data: {
        userId,
        applicationId: app.id,
        fromStatus: null,
        toStatus: input.status,
        source: "EMAIL_AUTO",
        emailCandidateId: candidateId,
        confidence: input.confidence,
        emailDate: input.emailDate,
      },
      select: { id: true },
    });
    return {
      changeId: log.id,
      applicationId: app.id,
      company: app.company,
      title: app.title,
      fromStatus: null,
      toStatus: input.status,
      confidence: input.confidence,
    };
  });
}

/** Log a status change made by the user (board dropdown or review approval) for the timeline. */
export async function logStatusChange(
  tx: Tx | typeof db,
  input: {
    userId: string;
    applicationId: string;
    from: ApplicationStatus | null;
    to: ApplicationStatus;
    source: StatusChangeSource;
    prevStatusChangedAt?: Date | null;
    emailCandidateId?: string | null;
    emailDate?: Date | null;
    confidence?: number | null;
  },
) {
  if (input.from === input.to) return;
  await tx.applicationStatusChange.create({
    data: {
      userId: input.userId,
      applicationId: input.applicationId,
      fromStatus: input.from,
      toStatus: input.to,
      source: input.source,
      prevStatusChangedAt: input.prevStatusChangedAt ?? null,
      emailCandidateId: input.emailCandidateId ?? null,
      emailDate: input.emailDate ?? null,
      confidence: input.confidence ?? null,
    },
  });
}

export type UndoPlan =
  | { kind: "noop" } // already undone
  | { kind: "conflict" } // the application moved on since; undoing would clobber that
  | { kind: "delete" } // the change created the application: remove it
  | { kind: "restore"; status: ApplicationStatus; statusChangedAt: Date | null };

/** Decide what undoing an automatic change means, given the application's current state. */
export function planUndo(
  change: {
    id: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    prevStatusChangedAt: Date | null;
    undoneAt: Date | null;
    createdAt: Date;
  },
  app: { status: ApplicationStatus } | null,
  laterActiveChanges: number,
): UndoPlan {
  if (change.undoneAt || !app) return { kind: "noop" };
  if (app.status !== change.toStatus || laterActiveChanges > 0) return { kind: "conflict" };
  if (change.fromStatus === null) return { kind: "delete" };
  return { kind: "restore", status: change.fromStatus, statusChangedAt: change.prevStatusChangedAt };
}

/**
 * Undo one automatic change. Idempotent: a second call is a no-op. The source email stays recorded
 * (as DISMISSED), so later scans never re-apply it.
 */
export async function undoAutoChange(userId: string, changeId: string): Promise<UndoPlan["kind"] | "not_found"> {
  return db.$transaction(async (tx) => {
    const change = await tx.applicationStatusChange.findFirst({
      where: { id: changeId, userId, source: "EMAIL_AUTO" },
    });
    if (!change) return "not_found";
    const app = await tx.application.findFirst({
      where: { id: change.applicationId, userId },
      select: { status: true },
    });
    const later = await tx.applicationStatusChange.count({
      where: { applicationId: change.applicationId, undoneAt: null, createdAt: { gt: change.createdAt } },
    });
    const plan = planUndo(change, app, later);
    if (plan.kind === "noop" || plan.kind === "conflict") return plan.kind;
    if (change.emailCandidateId)
      await tx.emailCandidate.updateMany({
        where: { id: change.emailCandidateId, userId },
        data: { status: "DISMISSED", ...(plan.kind === "delete" ? { applicationId: null } : {}) },
      });
    if (plan.kind === "delete") {
      await tx.application.deleteMany({ where: { id: change.applicationId, userId } });
      return plan.kind;
    }
    const r = await tx.applicationStatusChange.updateMany({
      where: { id: change.id, undoneAt: null },
      data: { undoneAt: new Date() },
    });
    if (r.count !== 1) return "noop";
    await tx.application.updateMany({
      where: { id: change.applicationId, userId, status: change.toStatus },
      data: { status: plan.status, statusChangedAt: plan.statusChangedAt },
    });
    return plan.kind;
  });
}
