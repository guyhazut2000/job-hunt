import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { notify } from "./create";

export const MAX_FOLLOWED_COMPANIES = 100;
/** Jobs listed by name in one grouped alert. */
const LIST_JOBS = 3;

type AlertJob = Pick<Job, "id" | "title" | "location">;

export function buildCompanyAlert(
  locale: Locale,
  company: { name: string; slug: string },
  jobs: AlertJob[],
): { title: string; body: string; url: string } {
  const s = notificationStrings(locale);
  if (jobs.length === 1) {
    const j = jobs[0];
    return {
      title: fill(s.companyOne, { company: company.name, title: j.title }),
      body: fill(s.companyBodyOne, { location: j.location }),
      url: `/jobs/${j.id}`,
    };
  }
  const listed = jobs.slice(0, LIST_JOBS).map((j) => `• ${j.title}`);
  if (jobs.length > LIST_JOBS) listed.push(fill(s.matchMore, { n: jobs.length - LIST_JOBS }));
  return {
    title: fill(s.companyMany, { n: jobs.length, company: company.name }),
    body: listed.join("\n"),
    url: `/companies/${company.slug}`,
  };
}

/** Job ids already announced to each user by a saved-search alert (so one job = one alert). */
export function alreadyAlerted(rows: { userId: string; data: unknown }[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    const ids = (r.data as { jobIds?: unknown } | null)?.jobIds;
    if (!Array.isArray(ids)) continue;
    const set = out.get(r.userId) ?? new Set<string>();
    for (const id of ids) if (typeof id === "string") set.add(id);
    out.set(r.userId, set);
  }
  return out;
}

export interface CompanyFollowRunSummary {
  follows: number;
  notified: number;
  jobs: number;
}

/**
 * For every followed company, send one grouped COMPANY_JOBS notification with the jobs it published
 * since the follow was last checked. Jobs the user already heard about from a saved search in the
 * same window are left out. Run after saved-search alerts (ingest / fast scan / notify cron).
 */
export async function runFollowedCompanyAlerts(now = new Date()): Promise<CompanyFollowRunSummary> {
  const follows = await db.companyFollow.findMany({
    include: { company: { select: { name: true, slug: true } }, user: { select: { locale: true } } },
  });
  const summary: CompanyFollowRunSummary = { follows: follows.length, notified: 0, jobs: 0 };
  if (!follows.length) return summary;
  const oldest = new Date(Math.min(...follows.map((f) => f.lastCheckedAt.getTime())));
  const fresh = await db.job.findMany({
    where: {
      isActive: true,
      companyId: { in: [...new Set(follows.map((f) => f.companyId))] },
      createdAt: { gt: oldest, lte: now },
    },
    select: { id: true, title: true, location: true, companyId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const ids = follows.map((f) => f.id);
  if (!fresh.length) {
    await db.companyFollow.updateMany({ where: { id: { in: ids } }, data: { lastCheckedAt: now } });
    return summary;
  }
  const seen = alreadyAlerted(
    await db.notification.findMany({
      where: {
        userId: { in: [...new Set(follows.map((f) => f.userId))] },
        kind: "JOB_MATCH",
        createdAt: { gt: oldest },
      },
      select: { userId: true, data: true },
      take: 5000,
    }),
  );
  for (const f of follows) {
    const known = seen.get(f.userId);
    const jobs = fresh.filter((j) => j.companyId === f.companyId && j.createdAt > f.lastCheckedAt && !known?.has(j.id));
    if (jobs.length) {
      const locale: Locale = f.user.locale === "en" ? "en" : "he";
      const created = await notify(
        f.userId,
        {
          kind: "COMPANY_JOBS",
          ...buildCompanyAlert(locale, f.company, jobs),
          data: { companyId: f.companyId, jobIds: jobs.slice(0, 50).map((j) => j.id) },
          dedupeKey: `company:${f.id}:${now.toISOString()}`,
        },
        { now },
      );
      if (created) {
        summary.notified++;
        summary.jobs += jobs.length;
      }
    }
    await db.companyFollow.update({
      where: { id: f.id },
      data: { lastCheckedAt: now, ...(jobs.length ? { lastNotifiedAt: now } : {}) },
    });
  }
  return summary;
}
