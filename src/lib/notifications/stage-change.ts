import type { ApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { isStageKind, STAGE_LABELS, type StageKind } from "@/lib/hiring/kinds";
import { notify, sentDedupeKeys } from "./create";

/**
 * Hiring-stage change notices (#41): when an application moves to screening / interview / offer, or
 * the user marks a new hiring-process stage, tell them what comes next in the company's published
 * process and where to prepare. Email-detected changes (EMAIL_AUTO) already get an EMAIL_UPDATE
 * notice from the scan, so they are not repeated here.
 */

const HOUR = 3_600_000;
/** The hourly cron looks a bit further back than an hour so a missed run doesn't drop a change. */
export const STAGE_LOOKBACK_MS = 26 * HOUR;
export const STAGE_STATUSES: ApplicationStatus[] = ["SCREENING", "INTERVIEW", "OFFER"];

const SCREEN_KINDS: StageKind[] = ["phone_screen", "assessment"];
const INTERVIEW_KINDS: StageKind[] = [
  "technical",
  "coding",
  "system_design",
  "team",
  "manager",
  "hr",
  "executive",
  "onsite",
];

export interface StageLite {
  kind: string;
  title: string;
}

/**
 * The stage after the user's position in an ordered process. Position = the stage they marked
 * (`currentStage`), else the first stage that matches the status (screening → phone screen /
 * assessment, interview → first interview round). Null when unknown or at the end.
 */
export function nextStage(
  stages: StageLite[],
  at: { status?: ApplicationStatus | null; currentStage?: string | null },
): StageLite | null {
  if (!stages.length) return null;
  let idx = -1;
  if (at.currentStage) idx = stages.findIndex((s) => s.kind === at.currentStage);
  if (idx < 0 && at.status === "SCREENING") {
    idx = stages.findIndex((s) => SCREEN_KINDS.includes(s.kind as StageKind));
    if (idx < 0) idx = stages.findIndex((s) => s.kind === "application");
  }
  if (idx < 0 && at.status === "INTERVIEW") {
    idx = stages.findIndex((s) => INTERVIEW_KINDS.includes(s.kind as StageKind));
  }
  if (idx < 0 || idx + 1 >= stages.length) return null;
  return stages[idx + 1];
}

export function stageLabel(locale: Locale, s: StageLite): string {
  return s.title?.trim() || (isStageKind(s.kind) ? STAGE_LABELS[locale][s.kind] : s.kind);
}

const localeOf = (l: string | null | undefined): Locale => (l === "en" ? "en" : "he");

interface Event {
  appId: string;
  userId: string;
  locale: Locale;
  title: string;
  company: string;
  jobId: string | null;
  companyId: string | null;
  /** "status:INTERVIEW" or "stage:technical" — also the dedupe suffix. */
  key: string;
  stageName: string;
  status: ApplicationStatus | null;
  currentStage: string | null;
}

async function officialStages(companyId: string, jobId: string | null): Promise<StageLite[]> {
  const select = { stages: { orderBy: { order: "asc" as const }, select: { kind: true, title: true } } };
  const p =
    (jobId
      ? await db.hiringProcess.findFirst({
          where: { jobId, kind: "official", status: "found" },
          orderBy: { checkedAt: "desc" },
          select,
        })
      : null) ??
    (await db.hiringProcess.findFirst({
      where: { companyId, jobId: null, kind: "official", status: "found" },
      orderBy: { checkedAt: "desc" },
      select,
    }));
  return p?.stages ?? [];
}

export async function runStageChanges(now = new Date()): Promise<{ notified: number }> {
  const since = new Date(now.getTime() - STAGE_LOOKBACK_MS);
  const appSelect = {
    id: true,
    userId: true,
    title: true,
    company: true,
    status: true,
    jobId: true,
    currentStage: true,
    job: { select: { companyId: true } },
    user: { select: { locale: true } },
  } as const;
  const [changes, staged] = await Promise.all([
    db.applicationStatusChange.findMany({
      where: {
        createdAt: { gte: since },
        undoneAt: null,
        toStatus: { in: STAGE_STATUSES },
        source: { not: "EMAIL_AUTO" },
      },
      select: { toStatus: true, application: { select: appSelect } },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    db.application.findMany({
      where: { currentStageAt: { gte: since }, currentStage: { not: null } },
      select: appSelect,
      take: 500,
    }),
  ]);

  const events = new Map<string, Event>();
  for (const c of changes) {
    const a = c.application;
    // The change still holds (not overwritten by a later move).
    if (a.status !== c.toStatus) continue;
    const locale = localeOf(a.user.locale);
    events.set(`${a.id}:status:${c.toStatus}`, {
      appId: a.id,
      userId: a.userId,
      locale,
      title: a.title,
      company: a.company,
      jobId: a.jobId,
      companyId: a.job?.companyId ?? null,
      key: `status:${c.toStatus}`,
      stageName: dictionaries[locale].status[c.toStatus] ?? c.toStatus,
      status: c.toStatus,
      currentStage: a.currentStage,
    });
  }
  for (const a of staged) {
    if (!a.currentStage) continue;
    const locale = localeOf(a.user.locale);
    events.set(`${a.id}:stage:${a.currentStage}`, {
      appId: a.id,
      userId: a.userId,
      locale,
      title: a.title,
      company: a.company,
      jobId: a.jobId,
      companyId: a.job?.companyId ?? null,
      key: `stage:${a.currentStage}`,
      stageName: isStageKind(a.currentStage) ? STAGE_LABELS[locale][a.currentStage] : a.currentStage,
      status: a.status,
      currentStage: a.currentStage,
    });
  }

  const sent = await sentDedupeKeys([...events.values()].map((e) => `stage:${e.appId}:${e.key}`));
  const stageCache = new Map<string, StageLite[]>();
  let notified = 0;
  for (const e of events.values()) {
    if (sent.has(`${e.userId}|stage:${e.appId}:${e.key}`)) continue;
    const s = notificationStrings(e.locale);
    let next: StageLite | null = null;
    if (e.companyId && e.status !== "OFFER") {
      const ck = `${e.companyId}:${e.jobId ?? ""}`;
      if (!stageCache.has(ck)) stageCache.set(ck, await officialStages(e.companyId, e.jobId));
      next = nextStage(stageCache.get(ck)!, { status: e.status, currentStage: e.currentStage });
    }
    const body = [
      fill(s.stageBody, { title: e.title, stage: e.stageName }),
      next ? fill(s.stageNext, { next: stageLabel(e.locale, next) }) : "",
      e.jobId && e.status !== "OFFER" ? s.stagePrep : "",
    ]
      .filter(Boolean)
      .join(" ");
    const created = await notify(
      e.userId,
      {
        kind: "STAGE_CHANGE",
        title: fill(s.stageTitle, { company: e.company, stage: e.stageName }),
        body,
        url: e.jobId ? `/jobs/${e.jobId}` : "/dashboard",
        data: { applicationId: e.appId, ...(next ? { next: next.kind } : {}) },
        dedupeKey: `stage:${e.appId}:${e.key}`,
      },
      { now },
    );
    if (created) notified++;
  }
  return { notified };
}
