import type { EmailProvider, EmailSyncSettings, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { analyzeMessage, findApplication, type Analysis, type AnalyzeContext, type AppLike } from "./analyze";
import { AlreadyHandled, autoCreate, autoUpdate, loadApps, type AutoChange } from "./auto-apply";
import { notifyAutoChanges } from "./auto-notify";
import { decryptSecret } from "./crypto";
import { classify, isAtsSender, parseFrom, type MailMessage } from "./parse";
import { getProvider, messageUrl, ProviderAuthError } from "./providers";
import { clampThreshold, isStaleEmail, nextStatus, type AutoApply } from "./score";

export type ScanSummary = {
  trigger: "manual" | "cron" | "fixture";
  scanned: number;
  created: number;
  updated: number;
  pending: number;
  duplicates: number;
  skipped: number;
  /** Earlier review items that now meet the auto-apply threshold and were applied. */
  fromReview?: number;
  durationMs: number;
};

const MAX_MESSAGES = 150;
const MAX_BODY_FETCHES = 25;

export const DEFAULT_SETTINGS = {
  lookbackDays: 7,
  frequency: "MANUAL",
  detectStatusUpdates: true,
  autoApplyEnabled: true,
  autoApplyThreshold: 60,
} as const;

export function autoApplyOf(settings: Pick<EmailSyncSettings, "autoApplyEnabled" | "autoApplyThreshold">): AutoApply {
  return { enabled: settings.autoApplyEnabled, threshold: clampThreshold(settings.autoApplyThreshold) };
}

export async function getSettings(userId: string): Promise<EmailSyncSettings> {
  return db.emailSyncSettings.upsert({ where: { userId }, update: {}, create: { userId } });
}

async function loadContext(userId: string, settings: EmailSyncSettings): Promise<AnalyzeContext> {
  const [companies, jobs, applications] = await Promise.all([
    db.company.findMany({ select: { id: true, name: true, slug: true, website: true } }),
    db.job.findMany({ select: { id: true, title: true, companyId: true, isActive: true } }),
    loadApps(userId),
  ]);
  return {
    autoApply: autoApplyOf(settings),
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
  opts: { fetchBody?: (id: string) => Promise<string | null>; changes?: AutoChange[] } = {},
): Promise<Omit<ScanSummary, "trigger" | "durationMs">> {
  const changes: AutoChange[] = [];
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
      if (!app) continue;
      try {
        const ch = await autoUpdate({
          userId,
          app,
          to: a.newStatus,
          confidence: a.confidence,
          emailDate: m.date,
          candidate: { create: data },
        });
        app.status = a.newStatus;
        app.statusAt = m.date;
        changes.push(ch);
        sum.updated++;
      } catch (e) {
        if (!(e instanceof AlreadyHandled)) throw e;
        await db.emailCandidate.create({ data: { ...data, status: "PENDING" } }).catch(() => null);
        sum.pending++;
      }
    } else if (a.action === "create" && a.company && a.newStatus) {
      try {
        const ch = await autoCreate({
          userId,
          provider,
          messageId: m.id,
          company: a.company,
          title: a.title,
          jobId: a.matchedJobId,
          url: link,
          status: a.newStatus,
          confidence: a.confidence,
          emailDate: m.date,
          candidate: { create: data },
        });
        ctx.applications.push({
          id: ch.applicationId,
          jobId: a.matchedJobId,
          company: ch.company,
          title: ch.title,
          status: ch.toStatus,
          statusAt: m.date,
        });
        changes.push(ch);
        sum.created++;
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        await db.emailCandidate.create({ data: { ...data, status: "DUPLICATE" } });
        sum.duplicates++;
      }
    }
  }
  opts.changes?.push(...changes);
  return sum;
}

/**
 * Re-check review items against the current auto-apply settings: anything at/above the threshold is
 * applied now (oldest email first), exactly as a fresh scan would. Items without a company, or whose
 * email is older than the application's current later-stage status, stay in review.
 */
export async function applyPendingCandidates(
  userId: string,
  settings: Pick<EmailSyncSettings, "autoApplyEnabled" | "autoApplyThreshold" | "detectStatusUpdates">,
  opts: { apps?: AppLike[] } = {},
): Promise<AutoChange[]> {
  const auto = autoApplyOf(settings);
  if (!auto.enabled) return [];
  const pending = await db.emailCandidate.findMany({
    where: { userId, status: "PENDING", confidence: { gte: auto.threshold } },
    orderBy: { receivedAt: "asc" },
    take: 100,
  });
  if (!pending.length) return [];
  const apps = opts.apps ?? (await loadApps(userId));
  const out: AutoChange[] = [];
  for (const c of pending) {
    if (!c.company) continue;
    if (c.kind === "STATUS_UPDATE" && !settings.detectStatusUpdates) continue;
    const detected = c.kind === "APPLICATION" ? "APPLIED" : c.detectedStatus;
    if (!detected) continue;
    const ref = { pendingId: c.id, receivedAt: c.receivedAt };
    const existing = findApplication(apps, c.company, c.title, c.matchedJobId);
    try {
      if (existing) {
        const to = nextStatus(existing.app.status, detected);
        if (!to) {
          // Already reflected on the board (or would move backwards): nothing left to review.
          await db.emailCandidate.updateMany({
            where: { id: c.id, status: "PENDING" },
            data: { status: "DUPLICATE", applicationId: existing.app.id },
          });
          continue;
        }
        if (isStaleEmail(existing.app.status, existing.app.statusAt, c.receivedAt)) continue;
        const ch = await autoUpdate({
          userId,
          app: existing.app,
          to,
          confidence: c.confidence,
          emailDate: c.receivedAt,
          candidate: ref,
        });
        existing.app.status = to;
        existing.app.statusAt = c.receivedAt;
        out.push(ch);
      } else {
        const ch = await autoCreate({
          userId,
          provider: c.provider,
          messageId: c.messageId,
          company: c.company,
          title: c.title,
          jobId: c.matchedJobId,
          url: messageUrl(c.provider, c.messageId),
          status: detected,
          confidence: c.confidence,
          emailDate: c.receivedAt,
          candidate: ref,
        });
        apps.push({
          id: ch.applicationId,
          jobId: c.matchedJobId,
          company: ch.company,
          title: ch.title,
          status: ch.toStatus,
          statusAt: c.receivedAt,
        });
        out.push(ch);
      }
    } catch (e) {
      if (e instanceof AlreadyHandled || (e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  return out;
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
    const changes: AutoChange[] = [];
    const counts = await processMessages(userId, account.provider, messages, settings, {
      fetchBody: provider.fetchBodyText ? (id) => provider.fetchBodyText!(accessToken, id) : undefined,
      changes,
    });
    const fromReview = await applyPendingCandidates(userId, settings);
    changes.push(...fromReview);
    const summary: ScanSummary = {
      trigger,
      ...counts,
      pending: Math.max(0, counts.pending - fromReview.length),
      fromReview: fromReview.length,
      durationMs: Date.now() - started,
    };
    await finish(userId, summary, null);
    await notifyAutoChanges(userId, changes).catch((e) =>
      console.error("[email-sync] notify failed", { userId, name: (e as Error).name }),
    );
    return summary;
  } catch (e) {
    const code = e instanceof ProviderAuthError ? "reconnect_required" : "scan_failed";
    console.error("[email-sync] scan failed", { userId, code, name: (e as Error).name });
    await finish(userId, null, code);
    return { error: code };
  }
}
