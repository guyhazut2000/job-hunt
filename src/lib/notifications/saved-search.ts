import type { Company, Job } from "@prisma/client";
import { db } from "@/lib/db";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import type { Locale } from "@/lib/i18n/dictionaries";
import { filtersToQuery, filtersToWhere, parseFilters, type JobFilters } from "@/lib/jobs/filters";
import { matchCompanies } from "@/lib/jobs/search";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import { parseSearchQuery } from "@/lib/search/query";
import { loadCompanyLexicon } from "@/lib/search/lexicon-server";
import { notify } from "./create";

export const MAX_SAVED_SEARCHES = 20;
/** Jobs listed by name in one grouped alert. */
const LIST_JOBS = 3;

/** Filter keys that make sense for alerts (commute / sort / paging / view are dropped). */
export function alertFilters(f: JobFilters): JobFilters {
  return {
    ...f,
    sort: undefined,
    page: 1,
    view: undefined,
    from: undefined,
    origin: undefined,
    cmode: undefined,
    maxc: undefined,
    dep: undefined,
    // "posted within N days" is relative to now and would hide everything new or nothing; new = new.
    posted: undefined,
  };
}

/** Normalize an untrusted /jobs query string into the canonical stored form (no leading "?"). */
export function normalizeSearchQuery(raw: string): string {
  const sp = new URLSearchParams(raw.replace(/^\?/, ""));
  const params: Record<string, string[]> = {};
  for (const [k, v] of sp) (params[k] ??= []).push(v);
  return filtersToQuery(alertFilters(parseFilters(params))).replace(/^\?/, "");
}

export function parseStoredQuery(query: string): JobFilters {
  const sp = new URLSearchParams(query);
  const params: Record<string, string[]> = {};
  for (const [k, v] of sp) (params[k] ??= []).push(v);
  return alertFilters(parseFilters(params));
}

type AlertJob = Pick<Job, "id" | "title" | "location"> & { company: Pick<Company, "name"> };

export function buildSearchAlert(
  locale: Locale,
  search: { id: string; name: string; query: string },
  jobs: AlertJob[],
): { title: string; body: string; url: string } {
  const s = notificationStrings(locale);
  if (jobs.length === 1) {
    const j = jobs[0];
    return {
      title: fill(s.matchOne, { title: j.title }),
      body: fill(s.matchBodyOne, { company: j.company.name, location: j.location, name: search.name }),
      url: `/jobs/${j.id}`,
    };
  }
  const listed = jobs.slice(0, LIST_JOBS).map((j) => `• ${j.title} · ${j.company.name}`);
  if (jobs.length > LIST_JOBS) listed.push(fill(s.matchMore, { n: jobs.length - LIST_JOBS }));
  const q = new URLSearchParams(search.query);
  q.set("sort", "newest");
  return {
    title: fill(s.matchMany, { n: jobs.length, name: search.name }),
    body: listed.join("\n"),
    url: `/jobs?${q.toString()}`,
  };
}

/** A readable default name for a saved search ("react · Tel Aviv · Senior"). */
export function defaultSearchName(f: JobFilters, fallback: string): string {
  const parts = [f.q, ...f.city, ...f.company, f.tech, ...f.domain, ...f.level.map((l) => l.toLowerCase())]
    .filter((x): x is string => !!x)
    .slice(0, 4);
  return (parts.join(" · ") || fallback).slice(0, 80);
}

export interface SavedSearchRunSummary {
  searches: number;
  notified: number;
  jobs: number;
}

/**
 * Check every active saved search against jobs created since it was last checked and send one
 * grouped notification per search with new matches. Run after each ingest (and by the notify cron).
 */
export async function runSavedSearchAlerts(now = new Date()): Promise<SavedSearchRunSummary> {
  const searches = await db.savedSearch.findMany({
    where: { active: true },
    include: { user: { select: { locale: true, profile: true } } },
  });
  const summary: SavedSearchRunSummary = { searches: searches.length, notified: 0, jobs: 0 };
  if (!searches.length) return summary;
  const oldest = new Date(Math.min(...searches.map((s) => s.lastCheckedAt.getTime())));
  const anyNew = await db.job.count({ where: { isActive: true, createdAt: { gt: oldest, lte: now } } });
  if (!anyNew) {
    await db.savedSearch.updateMany({ where: { id: { in: searches.map((s) => s.id) } }, data: { lastCheckedAt: now } });
    return summary;
  }
  const [companies, lexicon] = await Promise.all([
    db.company.findMany({ select: { id: true, slug: true, name: true, website: true, nameHe: true, aliases: true } }),
    loadCompanyLexicon(),
  ]);

  for (const s of searches) {
    const f = parseStoredQuery(s.query);
    const terms = parseSearchQuery(f.q, { companies: lexicon });
    const companyMatches = terms.length ? matchCompanies(terms, companies) : undefined;
    const where = filtersToWhere(f, { userId: s.userId, companyMatches, terms, now });
    let jobs = await db.job.findMany({
      where: { AND: [where, { createdAt: { gt: s.lastCheckedAt, lte: now } }] },
      include: { company: true },
      omit: { description: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const profile = s.user.profile;
    if ((f.minMatch !== undefined || f.fit) && hasScorableProfile(profile)) {
      const c = toCandidate(profile);
      const min = f.minMatch ?? 65;
      jobs = jobs.filter((j) => scoreMatch(c, j).score >= min);
    }
    if (jobs.length) {
      const locale: Locale = s.user.locale === "en" ? "en" : "he";
      const alert = buildSearchAlert(locale, s, jobs);
      const created = await notify(
        s.userId,
        {
          kind: "JOB_MATCH",
          ...alert,
          data: { savedSearchId: s.id, jobIds: jobs.slice(0, 50).map((j) => j.id) },
          dedupeKey: `search:${s.id}:${now.toISOString()}`,
        },
        { now },
      );
      if (created) {
        summary.notified++;
        summary.jobs += jobs.length;
      }
    }
    await db.savedSearch.update({
      where: { id: s.id },
      data: { lastCheckedAt: now, ...(jobs.length ? { lastNotifiedAt: now } : {}) },
    });
  }
  return summary;
}
