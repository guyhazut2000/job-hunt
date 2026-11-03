import type { Company, Job } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { rankingStrings, reasonText } from "@/lib/i18n/ranking";
import { filtersToWhere, parseFilters } from "@/lib/jobs/filters";
import { hasScorableProfile, toCandidate } from "@/lib/profile/score";
import { hasKeywords, EMPTY_PREFS, type PersonalResult } from "@/lib/ranking/personal";
import { getRankingPrefs, rankPersonal } from "@/lib/ranking/server";
import { israelLocalToUtc } from "./israel-time";
import { notify } from "./create";
import { toEffective } from "./prefs";
import { NOTIFY_TZ } from "./quiet";

/**
 * Instant high-match alert (#96): after each scan, a newly ingested job whose personal match
 * ("התאמה אישית", the same score as the /jobs personal sort) reaches the user's threshold triggers
 * one alert. Each job is checked once (watermark), quiet hours are applied by notify(), and at most
 * `highMatchDailyCap` alerts go out per Israel day; extra jobs found in the same run are grouped.
 */

/** First run for a user only looks this far back, so turning the feature on doesn't replay old jobs. */
export const FIRST_LOOKBACK_MS = 2 * 3_600_000;
/** Never look further back than this, even after a long outage. */
export const MAX_LOOKBACK_MS = 24 * 3_600_000;
const LIST_JOBS = 3;

export type HighMatchJob = Pick<Job, "id" | "title" | "location"> & { company: Pick<Company, "name"> };
export interface HighMatchHit {
  job: HighMatchJob;
  personal: PersonalResult;
}

/** Window start for a user: the watermark, or a short look-back on the first run; capped at 24h. */
export function windowStart(checkedAt: Date | null | undefined, now: Date): Date {
  const floor = now.getTime() - MAX_LOOKBACK_MS;
  const start = checkedAt ? checkedAt.getTime() : now.getTime() - FIRST_LOOKBACK_MS;
  return new Date(Math.max(start, floor));
}

/** Hits at or above the threshold, best first (rows from rankPersonal are already sorted). */
export function pickHighMatches<T extends { personal: PersonalResult }>(rows: T[], threshold: number): T[] {
  return rows.filter((r) => !r.personal.hidden && r.personal.score >= threshold);
}

/** Start of the current Israel day as a UTC instant. */
export function israelDayStart(now: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: NOTIFY_TZ }).format(now);
  return israelLocalToUtc(`${day}T00:00`) ?? new Date(now.getTime() - 24 * 3_600_000);
}

export function buildHighMatchAlert(
  locale: Locale,
  hits: HighMatchHit[],
): { title: string; body: string; url: string } {
  const s = notificationStrings(locale);
  if (hits.length === 1) {
    const { job, personal } = hits[0];
    const rs = rankingStrings(locale);
    const why =
      personal.reasons
        .filter((r) => r.key !== "mustMissing")
        .slice(0, 2)
        .map((r) => reasonText(r, rs))
        .join(" · ") || "—";
    return {
      title: fill(s.highOne, { score: personal.score, title: job.title }),
      body: fill(s.highBodyOne, { company: job.company.name, location: job.location, why }),
      url: `/jobs/${job.id}`,
    };
  }
  const lines = hits
    .slice(0, LIST_JOBS)
    .map((h) => fill(s.highLine, { score: h.personal.score, title: h.job.title, company: h.job.company.name }));
  if (hits.length > LIST_JOBS) lines.push(fill(s.matchMore, { n: hits.length - LIST_JOBS }));
  return { title: fill(s.highMany, { n: hits.length }), body: lines.join("\n"), url: "/jobs?sort=personal" };
}

export interface HighMatchSummary {
  users: number;
  notified: number;
  jobs: number;
  capped: number;
}

/** Check new jobs for every user with high-match alerts on. Run after each scan / ingest and by the notify cron. */
export async function runHighMatchAlerts(now = new Date()): Promise<HighMatchSummary> {
  const summary: HighMatchSummary = { users: 0, notified: 0, jobs: 0, capped: 0 };
  const users = await db.user.findMany({
    where: {
      AND: [
        { OR: [{ profile: { isNot: null } }, { rankingPrefs: { isNot: null } }] },
        { OR: [{ notificationPrefs: null }, { notificationPrefs: { highMatchEnabled: true } }] },
      ],
    },
    select: { id: true, locale: true, profile: true, notificationPrefs: true },
  });
  if (!users.length) return summary;
  const starts = users.map((u) => windowStart(u.notificationPrefs?.highMatchCheckedAt, now));
  const oldest = new Date(Math.min(...starts.map((d) => d.getTime())));
  const anyNew = await db.job.count({ where: { isActive: true, createdAt: { gt: oldest, lte: now } } });
  const companies = anyNew
    ? await db.company.findMany({
        select: { id: true, slug: true, name: true, website: true, nameHe: true, aliases: true },
      })
    : [];
  const dayStart = israelDayStart(now);

  for (const [i, u] of users.entries()) {
    const since = starts[i];
    const prefs = (await getRankingPrefs(u.id)) ?? EMPTY_PREFS;
    const candidate = hasScorableProfile(u.profile) ? toCandidate(u.profile) : null;
    // Without a profile or keywords the score is only freshness: nothing personal to alert on.
    if (anyNew && (candidate || hasKeywords(prefs))) {
      summary.users++;
      const eff = toEffective(u.notificationPrefs);
      const where = filtersToWhere(parseFilters({}), { userId: u.id, now });
      const { rows } = await rankPersonal({
        userId: u.id,
        where: { AND: [where, { createdAt: { gt: since, lte: now } }] },
        prefs,
        candidate,
        companies,
        now,
      });
      const hits = pickHighMatches(rows, eff.highMatchThreshold);
      if (hits.length) {
        const sentToday = await db.notification.count({
          where: { userId: u.id, kind: "HIGH_MATCH", createdAt: { gte: dayStart } },
        });
        if (sentToday >= eff.highMatchDailyCap) {
          summary.capped += hits.length;
        } else {
          const locale: Locale = u.locale === "en" ? "en" : "he";
          const alert = buildHighMatchAlert(locale, hits);
          const created = await notify(
            u.id,
            {
              kind: "HIGH_MATCH",
              ...alert,
              data: {
                jobIds: hits.slice(0, 50).map((h) => h.job.id),
                scores: hits.slice(0, 50).map((h) => h.personal.score),
                threshold: eff.highMatchThreshold,
              },
              dedupeKey: `highmatch:${hits[0].job.id}`,
            },
            { now },
          );
          if (created) {
            summary.notified++;
            summary.jobs += hits.length;
          }
        }
      }
    }
    await db.notificationPreference.upsert({
      where: { userId: u.id },
      create: { userId: u.id, highMatchCheckedAt: now },
      update: { highMatchCheckedAt: now },
    });
  }
  return summary;
}
