import type { ApplicationStatus, StatusChangeSource } from "@prisma/client";
import { db } from "@/lib/db";
import { formatIsraelTime } from "./format";

export type TimelineEntry = {
  id: string;
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  /** "FOLLOW_UP" = a follow-up email the user marked as sent (ApplicationFollowUp), not a status change. */
  source: StatusChangeSource | "FOLLOW_UP";
  at: string;
  confidence: number | null;
  undone: boolean;
  /** Follow-up round (1 or 2) for FOLLOW_UP entries. */
  followUp?: number;
};

export type AutoInfo = { changeId: string; canUndo: boolean };

export type RecentAuto = {
  changeId: string;
  applicationId: string;
  title: string;
  company: string;
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  confidence: number | null;
  at: string;
  canUndo: boolean;
};

type ChangeRow = {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  source: StatusChangeSource | "FOLLOW_UP";
  confidence: number | null;
  undoneAt: Date | null;
  createdAt: Date;
  followUp?: number;
};

/**
 * Pure: per application, its status timeline and — when the latest effective change was made
 * automatically from email — the badge/undo info. Undo is offered only while the application is
 * still in the status that change set.
 */
export function buildHistory(
  changes: ChangeRow[],
  statusOf: Map<string, ApplicationStatus>,
  fmt: (d: Date) => string,
): { timeline: Map<string, TimelineEntry[]>; auto: Map<string, AutoInfo> } {
  const timeline = new Map<string, TimelineEntry[]>();
  const latest = new Map<string, ChangeRow>();
  const sorted = [...changes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const c of sorted) {
    const list = timeline.get(c.applicationId) ?? [];
    list.push({
      id: c.id,
      from: c.fromStatus,
      to: c.toStatus,
      source: c.source,
      at: fmt(c.createdAt),
      confidence: c.confidence,
      undone: !!c.undoneAt,
      ...(c.followUp ? { followUp: c.followUp } : {}),
    });
    timeline.set(c.applicationId, list);
    // Follow-up rows aren't status changes: they never hide the "auto-updated from email" badge/undo.
    if (!c.undoneAt && c.source !== "FOLLOW_UP") latest.set(c.applicationId, c);
  }
  const auto = new Map<string, AutoInfo>();
  for (const [appId, c] of latest)
    if (c.source === "EMAIL_AUTO") auto.set(appId, { changeId: c.id, canUndo: statusOf.get(appId) === c.toStatus });
  return { timeline, auto };
}

/** Timeline + auto-update info for the board, and the recent automatic changes for the dashboard panel. */
export async function getStatusHistory(
  userId: string,
  apps: { id: string; title: string; company: string; status: ApplicationStatus }[],
  locale: string,
  opts: { recentDays?: number } = {},
) {
  const changes = apps.length
    ? await db.applicationStatusChange.findMany({
        where: { userId, applicationId: { in: apps.map((a) => a.id) } },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: {
          id: true,
          applicationId: true,
          fromStatus: true,
          toStatus: true,
          source: true,
          confidence: true,
          undoneAt: true,
          createdAt: true,
        },
      })
    : [];
  const followUps = apps.length
    ? await db.applicationFollowUp.findMany({
        where: { userId, applicationId: { in: apps.map((a) => a.id) } },
        select: { id: true, applicationId: true, round: true, sentAt: true },
        take: 1000,
      })
    : [];
  const fmt = (d: Date) => formatIsraelTime(d, locale);
  const statusOf = new Map(apps.map((a) => [a.id, a.status]));
  const rows: ChangeRow[] = [
    ...changes,
    ...followUps.map((f) => ({
      id: f.id,
      applicationId: f.applicationId,
      fromStatus: "APPLIED" as const,
      toStatus: "APPLIED" as const,
      source: "FOLLOW_UP" as const,
      confidence: null,
      undoneAt: null,
      createdAt: f.sentAt,
      followUp: f.round,
    })),
  ];
  const { timeline, auto } = buildHistory(rows, statusOf, fmt);
  const since = Date.now() - (opts.recentDays ?? 14) * 86_400_000;
  const byId = new Map(apps.map((a) => [a.id, a]));
  const recent: RecentAuto[] = changes
    .filter((c) => c.source === "EMAIL_AUTO" && !c.undoneAt && c.createdAt.getTime() >= since)
    .slice(0, 12)
    .map((c) => {
      const app = byId.get(c.applicationId)!;
      return {
        changeId: c.id,
        applicationId: c.applicationId,
        title: app.title,
        company: app.company,
        from: c.fromStatus,
        to: c.toStatus,
        confidence: c.confidence,
        at: fmt(c.createdAt),
        canUndo: auto.get(c.applicationId)?.changeId === c.id && auto.get(c.applicationId)!.canUndo,
      };
    });
  return { timeline, auto, recent };
}
