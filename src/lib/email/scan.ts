import type { EmailProvider, EmailSyncSettings, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { analyzeMessage, type Analysis, type AnalyzeContext } from "./analyze";
import { decryptSecret } from "./crypto";
import { classify, isAtsSender, parseFrom, type MailMessage } from "./parse";
import { getProvider, messageUrl, ProviderAuthError } from "./providers";

export type ScanSummary = {
  trigger: "manual" | "cron" | "fixture";
  scanned: number;
  created: number;
  updated: number;
  pending: number;
  duplicates: number;
  skipped: number;
  durationMs: number;
};

const MAX_MESSAGES = 150;
const MAX_BODY_FETCHES = 25;

export const DEFAULT_SETTINGS = {
  lookbackDays: 7,
  frequency: "MANUAL",
  confidence: "BALANCED",
  detectStatusUpdates: true,
} as const;

export async function getSettings(userId: string): Promise<EmailSyncSettings> {
  return db.emailSyncSettings.upsert({ where: { userId }, update: {}, create: { userId } });
}

async function loadContext(userId: string, settings: EmailSyncSettings): Promise<AnalyzeContext> {
  const [companies, jobs, applications] = await Promise.all([
    db.company.findMany({ select: { id: true, name: true, slug: true, website: true } }),
    db.job.findMany({ select: { id: true, title: true, companyId: true, isActive: true } }),
    db.application.findMany({
      where: { userId },
      select: { id: true, jobId: true, company: true, title: true, status: true },
    }),
  ]);
  return {
    confidence: settings.confidence,
    detectStatusUpdates: settings.detectStatusUpdates,
    companies,
    jobs,
    applications,
  };
}

function candidateData(userId: string, provider: EmailProvider, m: MailMessage, a: Analysis) {
  return {
    userId,
    provider,
    messageId: m.id,
    threadId: m.threadId ?? null,
    fromAddress: m.from.slice(0, 300),
    subject: m.subject.slice(0, 300),
    receivedAt: m.date,
    kind: a.kind,
    detectedStatus: a.detectedStatus,
    company: a.company,
    title: a.title,
    matchedJobId: a.matchedJobId,
    applicationId: a.applicationId,
    confidence: a.confidence,
    reasons: a.reasons,
  } satisfies Prisma.EmailCandidateUncheckedCreateInput;
}

/**
 * Analyze messages and persist outcomes. Stores only id/from/subject/date + extracted fields;
 * bodies/snippets are never written.
 */
export async function processMessages(
  userId: string,
  provider: EmailProvider,
  messages: MailMessage[],
  settings: EmailSyncSettings,
  opts: { fetchBody?: (id: string) => Promise<string | null> } = {},
): Promise<Omit<ScanSummary, "trigger" | "durationMs">> {
  const sum = { scanned: messages.length, created: 0, updated: 0, pending: 0, duplicates: 0, skipped: 0 };
  const seen = new Set(
    (
      await db.emailCandidate.findMany({
        where: { userId, provider, messageId: { in: messages.map((m) => m.id) } },
        select: { messageId: true },
      })
    ).map((c) => c.messageId),
  );
  const ctx = await loadContext(userId, settings);
  let bodyFetches = 0;
  // Oldest first so an application is created before its later status update.
  const ordered = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const m of ordered) {
    if (seen.has(m.id)) {
      sum.duplicates++;
      continue;
    }
    let a = analyzeMessage(m, ctx);
    // Minimal body read: only when metadata+snippet weren't enough.
    const needsBody =
      opts.fetchBody &&
      bodyFetches < MAX_BODY_FETCHES &&
      (a ? !a.company || !a.title : isAtsSender(parseFrom(m.from)) || classify(m).kind === null);
    if (needsBody && (!a || a.action !== "duplicate")) {
      bodyFetches++;
      const body = await opts.fetchBody!(m.id).catch(() => null);
      if (body) a = analyzeMessage({ ...m, body }, ctx) ?? a;
    }
    if (!a || a.action === "skip") {
      sum.skipped++;
      continue;
    }
    const data = candidateData(userId, provider, m, a);
    const link = messageUrl(provider, m.id);

    if (a.action === "duplicate") {
      await db.emailCandidate.create({ data: { ...data, status: "DUPLICATE" } });
      sum.duplicates++;
    } else if (a.action === "review") {
      await db.emailCandidate.create({ data: { ...data, status: "PENDING" } });
      sum.pending++;
    } else if (a.action === "update" && a.applicationId && a.newStatus) {
      const app = ctx.applications.find((x) => x.id === a.applicationId);
      await db.$transaction([
        db.application.update({
          where: { id: a.applicationId },
          data: {
            status: a.newStatus,
            statusChangedAt: new Date(),
            ...(app?.status === "SAVED" ? { appliedAt: m.date } : {}),
          },
        }),
        db.emailCandidate.create({ data: { ...data, status: "AUTO_ADDED" } }),
      ]);
      if (app) app.status = a.newStatus;
      sum.updated++;
    } else if (a.action === "create" && a.company) {
      try {
        const app = await db.application.create({
          data: {
            userId,
            jobId: a.matchedJobId,
            title: a.title ?? "—",
            company: a.company,
            url: a.matchedJobId ? null : link,
            status: "APPLIED",
            appliedAt: m.date,
            source: "EMAIL",
            emailMessageId: m.id,
          },
        });
        await db.emailCandidate.create({ data: { ...data, applicationId: app.id, status: "AUTO_ADDED" } });
        ctx.applications.push({
          id: app.id,
          jobId: app.jobId,
          company: app.company,
          title: app.title,
          status: app.status,
        });
        sum.created++;
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        await db.emailCandidate.create({ data: { ...data, status: "DUPLICATE" } });
        sum.duplicates++;
      }
    }
  }
  return sum;
}

async function finish(userId: string, summary: ScanSummary | null, error: string | null) {
  await db.emailSyncSettings.update({
    where: { userId },
    data: {
      lastScanAt: new Date(),
      ...(summary ? { lastScanSummary: summary as unknown as Prisma.InputJsonValue } : {}),
      lastScanError: error,
    },
  });
}

/** Scan one user's connected mailbox. Errors are recorded on the settings row, never thrown with secrets. */
export async function scanUser(
  userId: string,
  trigger: ScanSummary["trigger"],
): Promise<ScanSummary | { error: string }> {
  const started = Date.now();
  const settings = await getSettings(userId);
  const account = await db.emailAccount.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (!account) return { error: "not_connected" };
  const provider = getProvider(account.provider);
  if (!provider.configured()) return { error: "not_configured" };
  try {
    const accessToken = await provider.refreshAccessToken(decryptSecret(account.refreshTokenEnc));
    const messages = await provider.search({
      accessToken,
      lookbackDays: settings.lookbackDays,
      statusUpdates: settings.detectStatusUpdates,
      max: MAX_MESSAGES,
    });
    const counts = await processMessages(userId, account.provider, messages, settings, {
      fetchBody: provider.fetchBodyText ? (id) => provider.fetchBodyText!(accessToken, id) : undefined,
    });
    const summary: ScanSummary = { trigger, ...counts, durationMs: Date.now() - started };
    await finish(userId, summary, null);
    return summary;
  } catch (e) {
    const code = e instanceof ProviderAuthError ? "reconnect_required" : "scan_failed";
    console.error("[email-sync] scan failed", { userId, code, name: (e as Error).name });
    await finish(userId, null, code);
    return { error: code };
  }
}
