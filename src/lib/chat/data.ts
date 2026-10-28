import type { JobLevel, Prisma, WorkMode } from "@prisma/client";
import { commuteForJobs, commuteSeconds } from "@/lib/commute/jobs";
import { type CommuteMode, type LatLng, parseDeparture } from "@/lib/commute/keys";
import { resolveOrigin } from "@/lib/commute/origin";
import { db } from "@/lib/db";
import { parseLocation } from "@/lib/geo/geocode";
import { companyGeoSelect } from "@/lib/geo/job-points";
import { communityLinks } from "@/lib/hiring/community";
import { loadHiringProcess } from "@/lib/hiring/server";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { filtersToQuery, filtersToWhere, type JobFilters } from "@/lib/jobs/filters";
import { matchCompanies, rankJob, type CompanyLike } from "@/lib/jobs/search";
import { planGaps } from "@/lib/learning/graph";
import { hasScorableProfile, scoreMatch, toCandidate, type Candidate } from "@/lib/profile/score";
import { parseSearchQuery } from "@/lib/search/query";
import type { ChatJobCard, CompanyInfoOutput, ExplainMatchOutput, SearchJobsOutput } from "./types";

/**
 * Server-side data for the chat tools. Every query is scoped to the signed-in user (profile, saved
 * places, own hiring notes) and reuses the app's existing search / commute / match / hiring code.
 * Outputs carry no job descriptions or other long free text (see the prompt-injection notes in
 * docs/chatbot.md).
 */

/** Commute provider requests one chat tool call may make (the rest come from cache or estimates). */
export const CHAT_COMMUTE_MAX_CALLS = 2;
export const CHAT_MAX_JOBS = 6;
/** Candidate rows ranked in memory per search (the jobs table is small; this bounds the worst case). */
const CANDIDATES = 400;
const MAX_COMMUTE_OPTIONS = [20, 30, 45, 60, 90] as const;

export interface ChatContext {
  userId: string;
  locale: Locale;
}

export interface SearchJobsInput {
  query?: string;
  domain?: string[];
  city?: string;
  level?: JobLevel[];
  workMode?: WorkMode[];
  company?: string;
  maxCommuteMinutes?: number;
  commuteMode?: CommuteMode;
  commuteFrom?: string;
  limit?: number;
}

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

const cardSelect = {
  id: true,
  title: true,
  location: true,
  workMode: true,
  seniority: true,
  level: true,
  domain: true,
  roleCategory: true,
  techStack: true,
  postedAt: true,
  applyUrl: true,
  linkedinUrl: true,
  linkedinCheckedAt: true,
  payMin: true,
  payMax: true,
  payCurrency: true,
  payPeriod: true,
  employmentType: true,
  department: true,
  geoPlaces: true,
  geoPrecision: true,
  company: {
    select: { ...companyGeoSelect, slug: true, name: true, industry: true, size: true, website: true },
  },
} satisfies Prisma.JobSelect;
type CardRow = Prisma.JobGetPayload<{ select: typeof cardSelect }>;

export function toCard(j: CardRow, extra: Partial<ChatJobCard> = {}): ChatJobCard {
  return {
    id: j.id,
    title: clip(j.title, 160),
    location: clip(j.location, 120),
    workMode: j.workMode,
    seniority: j.seniority,
    level: j.level,
    domain: j.domain,
    roleCategory: j.roleCategory,
    techStack: j.techStack.slice(0, 12).map((t) => clip(t, 40)),
    postedAt: j.postedAt.toISOString(),
    applyUrl: j.applyUrl,
    linkedinUrl: j.linkedinUrl,
    linkedinCheckedAt: j.linkedinCheckedAt?.toISOString() ?? null,
    payMin: j.payMin,
    payMax: j.payMax,
    payCurrency: j.payCurrency,
    payPeriod: j.payPeriod,
    employmentType: j.employmentType,
    department: j.department ? clip(j.department, 80) : null,
    company: {
      id: j.company.id,
      slug: j.company.slug,
      name: clip(j.company.name, 80),
      industry: j.company.industry,
      size: j.company.size,
      website: j.company.website,
    },
    ...extra,
  };
}

async function loadCandidate(userId: string): Promise<Candidate | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  return hasScorableProfile(profile) ? toCandidate(profile) : null;
}

async function allCompanies(): Promise<(CompanyLike & { slug: string })[]> {
  return db.company.findMany({ select: { id: true, slug: true, name: true, website: true, industry: true } });
}

/** A city / place name → point (offline gazetteer; no network). */
export function placeFromText(text: string | undefined) {
  if (!text?.trim()) return null;
  return parseLocation(text.slice(0, 60))[0] ?? null;
}

async function originFor(ctx: ChatContext, from: string | undefined) {
  const place = placeFromText(from);
  if (place)
    return {
      point: { lat: place.lat, lng: place.lng } as LatLng,
      label: place[ctx.locale === "he" ? "he" : "label"],
      placeId: undefined as string | undefined,
    };
  const saved = await resolveOrigin({}, ctx.userId, true);
  if (saved) return { point: saved.point, label: saved.label ?? "", placeId: saved.placeId };
  // No saved place: fall back to the city on the profile (city-level precision only).
  const profile = await db.profile.findUnique({ where: { userId: ctx.userId }, select: { location: true } });
  const home = placeFromText(profile?.location ?? undefined);
  return home
    ? {
        point: { lat: home.lat, lng: home.lng } as LatLng,
        label: home[ctx.locale === "he" ? "he" : "label"],
        placeId: undefined as string | undefined,
      }
    : null;
}

export async function searchJobs(input: SearchJobsInput, ctx: ChatContext): Promise<SearchJobsOutput> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), CHAT_MAX_JOBS);
  const q = clip(input.query, 100) || undefined;
  const terms = parseSearchQuery(q);
  const companies = await allCompanies();
  const companyMatches = terms.length ? matchCompanies(terms, companies) : undefined;

  let companyIds: string[] | undefined;
  let companySlugs: string[] = [];
  if (input.company?.trim()) {
    const ids = new Set(Object.values(matchCompanies(parseSearchQuery(clip(input.company, 80)), companies)).flat());
    const hit = companies.filter((c) => ids.has(c.id));
    if (!hit.length) return emptySearch(input, { unknownCompany: clip(input.company, 80) });
    companyIds = hit.map((c) => c.id);
    companySlugs = hit.map((c) => c.slug);
  }

  const filters: JobFilters = {
    q,
    fn: [],
    domain: input.domain ?? [],
    level: input.level ?? [],
    city: [],
    workMode: input.workMode ?? [],
    type: [],
    company: [],
    hide: [],
    page: 1,
  };
  const where = filtersToWhere(filters, { userId: ctx.userId, companyMatches });
  const and: Prisma.JobWhereInput[] = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
  if (companyIds) and.push({ companyId: { in: companyIds } });
  const city = placeFromText(input.city);
  if (city) {
    and.push({
      OR: [
        { geoPlaces: { has: city.key } },
        { location: { contains: city.label, mode: "insensitive" } },
        { location: { contains: city.he, mode: "insensitive" } },
      ],
    });
  } else if (input.city?.trim()) {
    and.push({ location: { contains: clip(input.city, 60), mode: "insensitive" } });
  }
  if (and.length) where.AND = and;

  const [rows, candidate] = await Promise.all([
    db.job.findMany({ where, select: cardSelect, orderBy: [{ postedAt: "desc" }, { id: "asc" }], take: CANDIDATES }),
    loadCandidate(ctx.userId),
  ]);

  let list = rows.map((job) => ({
    job,
    rank: terms.length ? rankJob(job, terms) : 0,
    score: candidate ? scoreMatch(candidate, job).score : undefined,
    commute: undefined as ChatJobCard["commute"],
    minutes: undefined as number | null | undefined,
  }));

  const wantsCommute = !!input.maxCommuteMinutes || !!input.commuteFrom;
  let commuteApplied: SearchJobsOutput["applied"]["commute"];
  let needsOrigin = false;
  let originParam: Partial<JobFilters> = {};
  if (wantsCommute) {
    const origin = await originFor(ctx, input.commuteFrom);
    if (!origin) needsOrigin = true;
    else {
      const { byJob, batch } = await commuteForJobs(
        list.map((x) => x.job),
        { origin: origin.point, departure: parseDeparture(undefined), maxCalls: CHAT_COMMUTE_MAX_CALLS },
      );
      for (const x of list) {
        const c = byJob.get(x.job.id);
        x.commute = c?.commute;
        const s = commuteSeconds(c, input.commuteMode);
        x.minutes = s == null ? null : Math.round(s / 60);
      }
      if (input.maxCommuteMinutes)
        list = list.filter((x) => x.minutes != null && x.minutes <= input.maxCommuteMinutes!);
      commuteApplied = {
        mode: input.commuteMode,
        maxMinutes: input.maxCommuteMinutes ?? 0,
        from: origin.label,
        estimated: batch.estimated,
      };
      originParam = origin.placeId
        ? { origin: origin.placeId }
        : { from: `${origin.point.lat.toFixed(3)},${origin.point.lng.toFixed(3)}` };
      if (input.maxCommuteMinutes)
        originParam.maxc = MAX_COMMUTE_OPTIONS.find((m) => m >= input.maxCommuteMinutes!) ?? 90;
      if (input.commuteMode) originParam.cmode = input.commuteMode;
    }
  }

  list.sort(
    (a, b) =>
      b.rank - a.rank ||
      (b.score ?? 0) - (a.score ?? 0) ||
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity) ||
      b.job.postedAt.getTime() - a.job.postedAt.getTime(),
  );

  const href =
    "/jobs" +
    filtersToQuery({
      q,
      domain: filters.domain,
      level: filters.level,
      workMode: filters.workMode,
      city: city ? [city.label] : input.city ? [clip(input.city, 60)] : [],
      company: companySlugs,
      ...originParam,
    });
  const shown = list.slice(0, limit);
  return {
    kind: "jobs",
    total: list.length,
    shown: shown.length,
    jobs: shown.map((x) =>
      toCard(x.job, {
        ...(x.score !== undefined ? { score: x.score } : {}),
        ...(x.commute ? { commute: x.commute, commuteMinutes: x.minutes ?? null } : {}),
      }),
    ),
    href,
    applied: {
      ...(q ? { q } : {}),
      ...(filters.domain.length ? { domain: filters.domain } : {}),
      ...(city || input.city ? { city: city ? city[ctx.locale === "he" ? "he" : "label"] : clip(input.city, 60) } : {}),
      ...(filters.level.length ? { level: filters.level } : {}),
      ...(filters.workMode.length ? { workMode: filters.workMode } : {}),
      ...(companySlugs.length ? { company: companySlugs } : {}),
      ...(commuteApplied ? { commute: commuteApplied } : {}),
    },
    ...(needsOrigin ? { needsOrigin } : {}),
  };
}

function emptySearch(input: SearchJobsInput, extra: Partial<SearchJobsOutput>): SearchJobsOutput {
  return { kind: "jobs", total: 0, shown: 0, jobs: [], href: "/jobs", applied: {}, ...extra };
}

const fill = (tpl: string, params?: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k: string) => (params && k in params ? String(params[k]) : m));

export async function explainMatch(
  input: { jobId?: string; jobQuery?: string },
  ctx: ChatContext,
): Promise<ExplainMatchOutput> {
  const candidate = await loadCandidate(ctx.userId);
  let job: CardRow | null = null;
  if (input.jobId) job = await db.job.findUnique({ where: { id: clip(input.jobId, 40) }, select: cardSelect });
  if (!job && input.jobQuery?.trim()) {
    const found = await searchJobs({ query: input.jobQuery, limit: 1 }, ctx);
    const id = found.jobs[0]?.id;
    if (id) job = await db.job.findUnique({ where: { id }, select: cardSelect });
  }
  if (!job && !input.jobId && !input.jobQuery?.trim() && candidate) {
    // "Which job fits me best?": explain the top-scored open job.
    const best = await searchJobs({ limit: 1 }, ctx);
    const id = best.jobs[0]?.id;
    if (id) job = await db.job.findUnique({ where: { id }, select: cardSelect });
  }
  if (!job) return { kind: "match", error: "not_found" };
  if (!candidate) return { kind: "match", error: "no_profile", job: toCard(job) };

  const m = scoreMatch(candidate, job);
  const plan = planGaps(candidate, job);
  const t = dictionaries[ctx.locale].match.reasons;
  return {
    kind: "match",
    job: toCard(job, { score: m.score }),
    score: m.score,
    parts: { ...m.parts },
    reasons: m.reasons,
    reasonText: m.reasons.map(
      (r) => `${r.tone === "plus" ? "+" : r.tone === "minus" ? "-" : "~"} ${fill(t[r.key], r.params)}`,
    ),
    matchedSkills: m.matchedSkills.slice(0, 15),
    missingSkills: m.missingSkills.slice(0, 15),
    plan: plan.steps.slice(0, 5).map((s) => ({
      skill: s.node.label,
      href: `/learn/${s.node.id}`,
      hours: s.hours,
      gain: s.gain,
      prerequisite: s.isPrerequisite,
    })),
    scoreAfterPlan: plan.after,
    unmappedSkills: plan.unmapped.slice(0, 10),
    profile: {
      roles: candidate.targetRoles.slice(0, 6),
      seniorities: candidate.targetSeniorities,
      ...(candidate.totalYears !== undefined ? { years: candidate.totalYears } : {}),
      skills: candidate.skills.slice(0, 25).map((s) => s.name),
    },
  };
}

/** Resolve a company by slug or (fuzzy) name; the one with the most open jobs wins among several hits. */
async function findCompany(query: string) {
  const q = clip(query, 80);
  const companies = await allCompanies();
  const lower = q.toLowerCase();
  const exact = companies.filter((c) => c.slug === lower || c.name.toLowerCase() === lower);
  const ids = exact.length
    ? exact.map((c) => c.id)
    : [...new Set(Object.values(matchCompanies(parseSearchQuery(q), companies)).flat())];
  if (!ids.length) return { company: null, alternatives: [] };
  const counts = await db.job.groupBy({
    by: ["companyId"],
    where: { companyId: { in: ids }, isActive: true },
    _count: true,
  });
  const n = new Map(counts.map((c) => [c.companyId, c._count]));
  const hits = companies.filter((c) => ids.includes(c.id)).sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0));
  return { company: hits[0], alternatives: hits.slice(1, 5).map((c) => ({ slug: c.slug, name: c.name })) };
}

export async function companyInfo(
  input: { company: string; from?: string },
  ctx: ChatContext,
): Promise<CompanyInfoOutput> {
  const { company: hit, alternatives } = await findCompany(input.company);
  if (!hit) return { kind: "company", error: "not_found", query: clip(input.company, 80) };
  const [company, jobs, hiring, candidate] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: hit.id },
      select: {
        id: true,
        slug: true,
        name: true,
        website: true,
        careersUrl: true,
        industry: true,
        size: true,
        hqLocation: true,
        linkedinUrl: true,
      },
    }),
    db.job.findMany({
      where: { companyId: hit.id, isActive: true },
      select: cardSelect,
      orderBy: [{ postedAt: "desc" }, { id: "asc" }],
      take: 200,
    }),
    loadHiringProcess({ companyId: hit.id, userId: ctx.userId }),
    loadCandidate(ctx.userId),
  ]);

  const byDomain = new Map<string, number>();
  for (const j of jobs) byDomain.set(j.domain, (byDomain.get(j.domain) ?? 0) + 1);
  const locations = [...new Set(jobs.map((j) => clip(j.location, 60)).filter(Boolean))].slice(0, 6);
  const scored = jobs
    .map((j) => ({ j, s: candidate ? scoreMatch(candidate, j).score : undefined }))
    .sort((a, b) => (b.s ?? 0) - (a.s ?? 0));

  let commute: CompanyInfoOutput["commute"] = null;
  const origin = jobs.length ? await originFor(ctx, input.from) : null;
  if (origin) {
    const { byJob, batch } = await commuteForJobs(jobs, {
      origin: origin.point,
      departure: parseDeparture(undefined),
      maxCalls: 1,
    });
    const best = (mode: CommuteMode) => {
      let min: number | null = null;
      for (const j of jobs) {
        const s = commuteSeconds(byJob.get(j.id), mode);
        if (s != null && (min == null || s < min)) min = s;
      }
      return min == null ? null : Math.round(min / 60);
    };
    commute = {
      from: origin.label,
      minutes: { car: best("car"), transit: best("transit") },
      estimated: batch.estimated,
    };
  }

  const official = hiring.official;
  return {
    kind: "company",
    company: { ...company, name: clip(company.name, 80) },
    domains: [...byDomain].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
    locations,
    activeJobs: jobs.length,
    topJobs: scored.slice(0, 3).map(({ j, s }) => toCard(j, s !== undefined ? { score: s } : {})),
    commute,
    hiring: {
      status: official ? (official.status === "found" ? "found" : "none") : "unknown",
      ...(official
        ? {
            scope: official.scope,
            confidence: official.confidence,
            duration: official.estimatedDuration ? clip(official.estimatedDuration, 40) : null,
            checkedAt: official.checkedAt.toISOString(),
          }
        : {}),
      stages:
        official?.status === "found"
          ? official.stages.map((s) => ({
              kind: s.kind,
              title: clip(s.title, 80),
              duration: s.duration ? clip(s.duration, 40) : null,
              sourceUrl: s.sourceUrl,
            }))
          : [],
      sources: (official?.sourceRefs ?? []).slice(0, 5).map((r) => ({ url: r.url, title: clip(r.title, 100) })),
      mine: !!hiring.mine,
    },
    community: communityLinks(company.name).map(({ id, site, url }) => ({ id, site, url })),
    ...(alternatives.length ? { alternatives } : {}),
  };
}

/** Company names (for the offline intent router). */
export async function companyNames(): Promise<string[]> {
  // Every company, not only hiring ones: "how does Wix hire?" is a fair question with 0 open roles.
  const rows = await db.company.findMany({ select: { name: true } });
  return rows.map((r) => r.name);
}

/** Context for the system prompt: does the user have a scorable profile / a saved default place? */
export async function chatUserContext(userId: string): Promise<{ hasProfile: boolean; hasPlace: boolean }> {
  const [profile, places] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.savedPlace.count({ where: { userId } }),
  ]);
  return { hasProfile: hasScorableProfile(profile), hasPlace: places > 0 };
}
