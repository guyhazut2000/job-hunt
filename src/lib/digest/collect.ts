import { db } from "@/lib/db";
import { GRAPH } from "@/lib/learning/graph";
import { learningStats } from "@/lib/learning/progress";
import { followUpDue, daysBetween } from "@/lib/notifications/reminders";
import { learningSnapshot } from "@/lib/notifications/learning";
import type { EffectivePrefs } from "@/lib/notifications/prefs";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import { emptyDigestData, type DigestData } from "./build";

const DAY = 86_400_000;
const MATCH_MIN = 70;

/** Everything the digest reports for one user, for the window [since, now]. */
export async function collectDigestData(
  userId: string,
  prefs: EffectivePrefs,
  day: string,
  since: Date,
  now: Date,
): Promise<DigestData> {
  const d = emptyDigestData(day, since, now);
  const [alerts, apps, profile, searches, runs, learningPrefs, hasLearning] = await Promise.all([
    db.notification.findMany({
      where: { userId, kind: { in: ["JOB_MATCH", "COMPANY_JOBS"] }, createdAt: { gt: since, lte: now } },
      select: { data: true },
      take: 200,
    }),
    db.application.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        company: true,
        status: true,
        jobId: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true,
        statusChangedAt: true,
        currentStage: true,
        currentStageAt: true,
        interviewAt: true,
        interviewNote: true,
      },
      take: 2000,
    }),
    db.profile.findUnique({ where: { userId } }),
    db.savedSearch.findMany({ where: { userId }, select: { id: true, name: true } }),
    db.ingestionRun.findMany({
      where: { startedAt: { gt: since, lte: now } },
      select: { companyId: true, error: true },
      take: 5000,
    }),
    db.learningPrefs.findUnique({ where: { userId } }),
    db.stageProgress.findFirst({ where: { userId }, select: { id: true } }),
  ]);

  // New jobs: saved-search and followed-company alerts in the window…
  const bySearch = new Map<string, number>();
  for (const a of alerts) {
    const data = (a.data ?? {}) as { savedSearchId?: string; jobIds?: string[] };
    const n = Array.isArray(data.jobIds) ? data.jobIds.length : 0;
    d.newJobs.fromSearches += n;
    if (data.savedSearchId) bySearch.set(data.savedSearchId, (bySearch.get(data.savedSearchId) ?? 0) + n);
  }
  const names = new Map(searches.map((s) => [s.id, s.name]));
  d.newJobs.searches = [...bySearch]
    .filter(([id]) => names.has(id))
    .map(([id, count]) => ({ id, name: names.get(id)!, count }))
    .sort((a, b) => b.count - a.count);
  d.savedSearches = searches.length;
  // …and new jobs that match the profile well.
  if (hasScorableProfile(profile)) {
    const c = toCandidate(profile);
    const tracked = new Set(apps.map((a) => a.jobId).filter(Boolean));
    const fresh = await db.job.findMany({
      where: { isActive: true, createdAt: { gt: since, lte: now } },
      select: {
        id: true,
        title: true,
        techStack: true,
        roleCategory: true,
        seniority: true,
        location: true,
        workMode: true,
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const scored = fresh
      .filter((j) => !tracked.has(j.id))
      .map((j) => ({ j, score: scoreMatch(c, j).score }))
      .filter((x) => x.score >= MATCH_MIN)
      .sort((a, b) => b.score - a.score);
    d.newJobs.matchCount = scored.length;
    d.newJobs.top = scored
      .slice(0, 5)
      .map(({ j, score }) => ({ id: j.id, title: j.title, company: j.company.name, score: Math.round(score) }));
  }

  // Applications.
  for (const a of apps) {
    const key = a.status.toLowerCase() as keyof DigestData["pipeline"];
    if (key in d.pipeline) d.pipeline[key]++;
    const changed = (a.statusChangedAt && a.statusChangedAt > since) || (a.currentStageAt && a.currentStageAt > since);
    if (changed)
      d.statusChanges.push({
        id: a.id,
        title: a.title,
        company: a.company,
        status: a.status,
        stage: a.currentStageAt && a.currentStageAt > since ? a.currentStage : null,
      });
    if (prefs.followUpEnabled && followUpDue(a, prefs.followUpDays, now))
      d.followUps.push({
        id: a.id,
        title: a.title,
        company: a.company,
        days: daysBetween(a.appliedAt ?? a.createdAt, now),
        jobId: a.jobId,
      });
    const upcoming = a.interviewAt && a.interviewAt > now;
    if (upcoming && a.interviewAt!.getTime() <= now.getTime() + 7 * DAY && a.status !== "REJECTED")
      d.interviews.push({
        id: a.id,
        title: a.title,
        company: a.company,
        at: a.interviewAt!.toISOString(),
        note: a.interviewNote,
        jobId: a.jobId,
      });
    if (a.status === "INTERVIEW" && !upcoming) d.interviewsMissingDate++;
    const last = a.statusChangedAt ?? a.updatedAt;
    if (a.status === "SAVED" && now.getTime() - a.createdAt.getTime() > 7 * DAY) d.pipeline.staleSaved++;
    if (a.status === "SCREENING" && now.getTime() - last.getTime() > 14 * DAY) d.pipeline.stuckScreening++;
  }
  d.interviews.sort((a, b) => a.at.localeCompare(b.at));
  d.followUps.sort((a, b) => b.days - a.days);

  // Learning (only for users who started).
  if (hasLearning || learningPrefs) {
    const snap = await learningSnapshot(userId, prefs.learningIdleDays, now);
    const sessions = await db.studySession.findMany({
      where: { userId, createdAt: { gte: new Date(now.getTime() - 8 * DAY) } },
      select: { minutes: true, createdAt: true },
    });
    const stats = learningStats(sessions, snap.lastActivity ? [snap.lastActivity] : [], now);
    d.learning = {
      streak: snap.streak,
      minutesThisWeek: stats.minutesThisWeek,
      activeDaysThisWeek: stats.activeDaysThisWeek,
      goalHours: learningPrefs?.weeklyGoalHours ?? 5,
      reviewsDue: snap.reviewsDue,
      next: snap.next
        ? {
            label: snap.next.label,
            url:
              snap.next.stage && GRAPH.byId.has(snap.next.skill)
                ? `/learn/${snap.next.skill}/${snap.next.stage}`
                : "/learn/me",
          }
        : null,
    };
  }

  // Scan health (system-wide): failed runs, with the user's own companies listed first.
  d.scans.runs = runs.length;
  const failedIds = [...new Set(runs.filter((r) => r.error && r.companyId).map((r) => r.companyId!))];
  d.scans.failed = runs.filter((r) => r.error).length;
  if (failedIds.length) {
    const companies = await db.company.findMany({ where: { id: { in: failedIds } }, select: { name: true } });
    const mine = new Set(apps.map((a) => a.company.toLowerCase()));
    d.scans.companies = companies
      .map((c) => c.name)
      .sort((a, b) => Number(mine.has(b.toLowerCase())) - Number(mine.has(a.toLowerCase())) || a.localeCompare(b))
      .slice(0, 8);
  }
  return d;
}
