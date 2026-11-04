import { db } from "@/lib/db";
import type { StatsApp } from "@/lib/stats/search-stats";
import { topGap } from "@/lib/gaps/aggregate";
import { loadGapReport } from "@/lib/gaps/server";
import { buildCoachData, type CoachContact, type CoachData } from "./build";

/** Load one user's applications (as /stats does) and outreach contacts, and build the coach data. */
export async function collectCoachData(userId: string, now: Date, week?: string): Promise<CoachData> {
  const [rows, contacts, profile] = await Promise.all([
    db.application.findMany({
      where: { userId, archivedAt: null },
      select: {
        id: true,
        title: true,
        company: true,
        status: true,
        createdAt: true,
        appliedAt: true,
        statusChangedAt: true,
        source: true,
        jobId: true,
        job: { select: { domain: true, source: true } },
        statusChanges: {
          select: { fromStatus: true, toStatus: true, source: true, createdAt: true, emailDate: true, undoneAt: true },
        },
      },
      take: 3000,
    }),
    db.contact.findMany({
      where: { userId },
      select: { status: true, sentAt: true, statusAt: true, followedUpAt: true },
      take: 3000,
    }),
    db.profile.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  const apps: StatsApp[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    status: r.status,
    createdAt: r.createdAt,
    appliedAt: r.appliedAt,
    statusChangedAt: r.statusChangedAt,
    source: r.source,
    jobId: r.jobId,
    domain: r.job?.domain ?? null,
    provider: r.job?.source ?? null,
    changes: r.statusChanges.map((c) => ({
      fromStatus: c.fromStatus,
      toStatus: c.toStatus,
      source: c.source,
      at: c.emailDate ?? c.createdAt,
      undone: !!c.undoneAt,
    })),
  }));
  // The skill gap is a bonus input: never let it break the coach.
  const gap = profile
    ? await loadGapReport(userId)
        .then((g) => (g.report ? topGap(g.report) : null))
        .catch((e: unknown) => {
          console.error("[coach] skill gap failed:", e instanceof Error ? e.message : String(e));
          return null;
        })
    : null;
  return buildCoachData({ apps, contacts: contacts as CoachContact[], hasProfile: !!profile, topGap: gap, now, week });
}
