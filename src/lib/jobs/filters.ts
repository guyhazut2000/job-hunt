import type { EmploymentType, JobLevel, Prisma, Seniority, WorkMode } from "@prisma/client";
import { ROLE_CATEGORIES, SENIORITIES, WORK_MODES } from "../taxonomy";
import { MAX_QUERY_LENGTH, parseSearchQuery } from "../search/query";
import { EMPLOYMENT_TYPES, JOB_FUNCTIONS, JOB_LEVELS } from "./classify";
import { type CompanyMatches, searchWhere } from "./search";

export const SORTS = ["relevance", "match", "newest", "updated", "company", "title"] as const;
export type SortKey = (typeof SORTS)[number];

export const POSTED_WINDOWS = { "1d": 1, "7d": 7, "30d": 30 } as const;
export type PostedWindow = keyof typeof POSTED_WINDOWS;

export const MIN_MATCH_OPTIONS = [50, 65, 80] as const;
export const HIDE_OPTIONS = ["saved", "applied"] as const;
export type HideOption = (typeof HIDE_OPTIONS)[number];

/** A company "fits" when its best open role scores at least this much for the user. */
export const COMPANY_FIT_THRESHOLD = 65;

/** Statuses that mean "I already applied" (anything past SAVED in the tracker). */
export const APPLIED_STATUSES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED"] as const;

export interface JobFilters {
  q?: string;
  /** Engineering specialisation (legacy single-select, still linked from the home page). */
  role?: string;
  /** Legacy matcher seniority; kept so old links keep working. The UI uses `level`. */
  seniority?: Seniority;
  fn: string[];
  level: JobLevel[];
  city: string[];
  workMode: WorkMode[];
  type: EmploymentType[];
  company: string[];
  tech?: string;
  posted?: PostedWindow;
  minMatch?: number;
  /** Only companies whose open roles fit the user's profile. */
  fit?: boolean;
  hide: HideOption[];
  /** Explicit sort from the URL; `undefined` means "the default for this user". */
  sort?: SortKey;
  page: number;
}

export const PAGE_SIZE = 20;

type Params = Record<string, string | string[] | undefined>;
const all = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : v === undefined ? [] : [v])
    .flatMap((x) => x.split(","))
    .map((x) => x.trim())
    .filter(Boolean);
const one = (v: string | string[] | undefined) => all(v)[0];
/** First value verbatim (free text may legitimately contain commas). */
const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const pick = <T extends string>(v: string | string[] | undefined, allowed: readonly T[], max = 20): T[] =>
  [...new Set(all(v).filter((x): x is T => (allowed as readonly string[]).includes(x)))].slice(0, max);

/** Parse untrusted URL search params into validated filters. Accepts repeated keys or comma lists. */
export function parseFilters(params: Params): JobFilters {
  const role = one(params.role);
  const seniority = one(params.seniority) as Seniority | undefined;
  const page = Math.max(1, Math.min(500, Number.parseInt(one(params.page) ?? "1", 10) || 1));
  const posted = one(params.posted);
  const sort = one(params.sort);
  const minMatch = Number.parseInt(one(params.minMatch) ?? "", 10);
  // `location` is the pre-v2 single city param; fold it into `city`.
  const city = [...new Set([...all(params.city), ...all(params.location)].map((c) => c.slice(0, 60)))].slice(0, 20);
  return {
    q: text(params.q)?.slice(0, MAX_QUERY_LENGTH),
    role: role && (ROLE_CATEGORIES as readonly string[]).includes(role) ? role : undefined,
    seniority: seniority && SENIORITIES.includes(seniority) ? seniority : undefined,
    fn: pick(params.fn, JOB_FUNCTIONS),
    level: pick(params.level, JOB_LEVELS),
    city,
    workMode: pick(params.workMode, WORK_MODES),
    type: pick(params.type, EMPLOYMENT_TYPES),
    company: [...new Set(all(params.company).map((c) => c.slice(0, 80)))].slice(0, 30),
    tech: text(params.tech)?.slice(0, 40),
    posted: posted && posted in POSTED_WINDOWS ? (posted as PostedWindow) : undefined,
    minMatch: (MIN_MATCH_OPTIONS as readonly number[]).includes(minMatch) ? minMatch : undefined,
    fit: one(params.fit) === "1" ? true : undefined,
    hide: pick(params.hide, HIDE_OPTIONS),
    sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as SortKey) : undefined,
    page,
  };
}

/** Whether the filters carry a usable free-text query (not just blanks / one-letter noise). */
export function hasSearch(f: Pick<JobFilters, "q">): boolean {
  return parseSearchQuery(f.q).length > 0;
}

/**
 * The sort actually applied: an explicit choice, else relevance while searching, else best match for
 * users with a profile, else newest.
 */
export function effectiveSort(f: JobFilters, hasProfile: boolean): SortKey {
  const searching = hasSearch(f);
  const fallback: SortKey = searching ? "relevance" : hasProfile ? "match" : "newest";
  if (f.sort === "match" && !hasProfile) return searching ? "relevance" : "newest";
  if (f.sort === "relevance" && !searching) return hasProfile ? "match" : "newest";
  return f.sort ?? fallback;
}

/** Whether results must be scored in memory (match sort / match threshold / company fit). */
export function needsScoring(f: JobFilters, hasProfile: boolean): boolean {
  return hasProfile && (effectiveSort(f, hasProfile) === "match" || f.minMatch !== undefined || !!f.fit);
}

export interface WhereContext {
  now?: Date;
  /** Signed-in user, required for the "hide saved/applied" filters. */
  userId?: string;
  /** Company ids per search term, pre-resolved so the text search stays index-friendly. */
  companyMatches?: CompanyMatches;
}

export function filtersToWhere(f: JobFilters, ctx: WhereContext = {}): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [];
  const where: Prisma.JobWhereInput = { isActive: true };
  if (f.role) where.roleCategory = f.role;
  if (f.seniority) where.seniority = f.seniority;
  if (f.fn.length) where.jobFunction = { in: f.fn };
  if (f.level.length) where.level = { in: f.level };
  if (f.workMode.length) where.workMode = { in: f.workMode };
  if (f.type.length) where.employmentType = { in: f.type };
  if (f.tech) where.techStack = { has: f.tech };
  if (f.company.length) where.company = { slug: { in: f.company } };
  if (f.city.length) and.push({ OR: f.city.map((c) => ({ location: { contains: c, mode: "insensitive" as const } })) });
  if (f.posted) {
    const now = ctx.now ?? new Date();
    where.postedAt = { gte: new Date(now.getTime() - POSTED_WINDOWS[f.posted] * 86_400_000) };
  }
  if (ctx.userId && f.hide.length) {
    const hideAll = f.hide.includes("saved"); // saved ⊇ applied: anything in the tracker
    where.applications = {
      none: hideAll ? { userId: ctx.userId } : { userId: ctx.userId, status: { in: [...APPLIED_STATUSES] } },
    };
  }
  if (f.q) and.push(...searchWhere(parseSearchQuery(f.q), ctx.companyMatches));
  if (and.length) where.AND = and;
  return where;
}

/** Database ordering for every sort except "match" (scored in memory). Always ends with a stable tiebreaker. */
export function sortToOrderBy(sort: SortKey): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case "updated":
      return [{ sourceUpdatedAt: { sort: "desc", nulls: "last" } }, { postedAt: "desc" }, { id: "asc" }];
    case "company":
      return [{ company: { name: "asc" } }, { postedAt: "desc" }, { id: "asc" }];
    case "title":
      return [{ title: "asc" }, { id: "asc" }];
    case "relevance": // ranked in memory; the DB order is only the tiebreak
    case "match":
    case "newest":
    default:
      return [{ postedAt: "desc" }, { id: "asc" }];
  }
}

/** In-memory ordering used on the scored path, mirroring `sortToOrderBy`. */
export function compareJobs<T extends { score: number; rank?: number; job: SortableJob }>(sort: SortKey) {
  const time = (d: Date | null | undefined) => d?.getTime() ?? 0;
  const byPosted = (a: T, b: T) => time(b.job.postedAt) - time(a.job.postedAt) || a.job.id.localeCompare(b.job.id);
  switch (sort) {
    case "relevance":
      return (a: T, b: T) => (b.rank ?? 0) - (a.rank ?? 0) || b.score - a.score || byPosted(a, b);
    case "match":
      return (a: T, b: T) => b.score - a.score || byPosted(a, b);
    case "updated":
      return (a: T, b: T) =>
        time(b.job.sourceUpdatedAt ?? b.job.postedAt) - time(a.job.sourceUpdatedAt ?? a.job.postedAt) || byPosted(a, b);
    case "company":
      return (a: T, b: T) => a.job.company.name.localeCompare(b.job.company.name, "en") || byPosted(a, b);
    case "title":
      return (a: T, b: T) => a.job.title.localeCompare(b.job.title, "en") || a.job.id.localeCompare(b.job.id);
    default:
      return byPosted;
  }
}

export interface SortableJob {
  id: string;
  title: string;
  postedAt: Date;
  sourceUpdatedAt?: Date | null;
  company: { name: string };
}

/**
 * Companies that fit the user: best open-role score ≥ threshold, best first.
 * Input is every scored active job, so the list doesn't shrink as filters are applied.
 */
export function fitCompanies(
  scored: { score: number; job: { companyId: string } }[],
  threshold = COMPANY_FIT_THRESHOLD,
): { companyId: string; best: number; count: number }[] {
  const by = new Map<string, { companyId: string; best: number; count: number }>();
  for (const { score, job } of scored) {
    const c = by.get(job.companyId) ?? { companyId: job.companyId, best: 0, count: 0 };
    c.best = Math.max(c.best, score);
    if (score >= threshold) c.count++;
    by.set(job.companyId, c);
  }
  return [...by.values()].filter((c) => c.best >= threshold).sort((a, b) => b.best - a.best || b.count - a.count);
}

/** Number of user-visible filters in use (for the filter button badge). Sort and page don't count. */
export function activeFilterCount(f: JobFilters): number {
  return (
    [f.q, f.role, f.seniority, f.tech, f.posted, f.minMatch, f.fit].filter((v) => v !== undefined && v !== "").length +
    f.fn.length +
    f.level.length +
    f.city.length +
    f.workMode.length +
    f.type.length +
    f.company.length +
    f.hide.length
  );
}

/** Serialize filters to a query string. Arrays become repeated keys; defaults are omitted. */
export function filtersToQuery(f: Partial<JobFilters>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "" || v === false) continue;
    if (k === "page" && v === 1) continue;
    if (Array.isArray(v)) for (const x of v) sp.append(k, String(x));
    else sp.set(k, v === true ? "1" : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Remove one value from an array filter (or clear a scalar one) and reset to page 1. */
export function withoutValue(f: JobFilters, key: keyof JobFilters, value?: string): JobFilters {
  const cur = f[key];
  if (Array.isArray(cur)) return { ...f, [key]: cur.filter((x) => x !== value), page: 1 };
  return { ...f, [key]: undefined, page: 1 };
}

/** Clear every filter but keep the user's chosen sort. */
export function clearedFilters(f: JobFilters): JobFilters {
  return { ...parseFilters({}), sort: f.sort };
}
