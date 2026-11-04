import "server-only";
import type { Company, Job, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emailResponses } from "@/lib/followup/server";
import { matchCompanies, searchWhere, type CompanyLike } from "@/lib/jobs/search";
import { type Candidate, inferSeniorityFromYears, scoreMatch } from "@/lib/profile/score";
import { estimateSalary } from "@/lib/salary/estimate";
import { companyTier, type CompanyTier } from "@/lib/salary/company-tier";
import { loadCompanyLexicon } from "@/lib/search/lexicon-server";
import { parseSearchQuery } from "@/lib/search/query";
import {
  compilePrefs,
  isOn,
  matchCore,
  normalizePrefs,
  type PersonalResult,
  personalScore,
  type RankingPrefs,
  type WeightKey,
} from "./personal";
import {
  companySizeValue,
  defaultEmployment,
  employmentValue,
  industriesOf,
  industryValue,
  locationValue,
  salaryValue,
  seniorityValue,
  techValue,
  workModeValue,
  type CompanyType,
  type Industry,
} from "./criteria";
import { commuteValue, homePoint } from "./commute";

export async function getRankingPrefs(userId: string | undefined): Promise<RankingPrefs | null> {
  if (!userId) return null;
  const row = await db.rankingPrefs.findUnique({ where: { userId } });
  return row ? normalizePrefs(row) : null;
}

/** Statuses that mean the company answered (a later stage than "applied"). */
const ANSWERED = ["SCREENING", "INTERVIEW", "OFFER", "REJECTED"] as const;

/** Companies that answered one of the user's applications (tracker stage or a status-update email). */
export async function respondedCompanies(userId: string): Promise<Set<string>> {
  const apps = await db.application.findMany({
    where: { userId, jobId: { not: null } },
    select: { id: true, status: true, appliedAt: true, createdAt: true, job: { select: { companyId: true } } },
    take: 2000,
  });
  const replied = await emailResponses(apps);
  const out = new Set<string>();
  for (const a of apps)
    if (a.job && ((ANSWERED as readonly string[]).includes(a.status) || replied.has(a.id))) out.add(a.job.companyId);
  return out;
}

/** Companies where the user has an insider contact (#100 referrals). */
export async function insiderCompanies(userId: string): Promise<Set<string>> {
  const rows = await db.contact.findMany({
    where: { userId, insider: true, companyId: { not: null } },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  return new Set(rows.map((r) => r.companyId).filter((id): id is string => !!id));
}

const TIER_TYPE: Record<CompanyTier, CompanyType> = { early: "startup", growth: "mid", established: "enterprise" };

/** Top of the pay range the job is likely to offer (monthly ILS), or null when unknown / low confidence. */
export function offeredSalary(job: Job & { company: Company }): number | null {
  const e = estimateSalary({ job: { ...job, description: job.description ?? "" }, company: job.company });
  if (e.posted) return e.posted.max ?? e.posted.min ?? null;
  return e.confidence === "low" ? null : e.p75;
}

export type PersonalRow = { job: Job & { company: Company }; score: number; personal: PersonalResult };

/**
 * Score every job matching `where` with the user's personal ranking. Loads jobs without
 * descriptions; keyword hits in descriptions come from one indexed text query per keyword.
 */
export async function rankPersonal(opts: {
  userId: string;
  where: Prisma.JobWhereInput;
  prefs: RankingPrefs;
  candidate: Candidate | null;
  companies: CompanyLike[];
  now?: Date;
}): Promise<{ rows: PersonalRow[]; hidden: number }> {
  const { prefs, candidate } = opts;
  const lexicon = prefs.include.length || prefs.exclude.length ? await loadCompanyLexicon() : undefined;
  const compiled = compilePrefs(prefs, (q) => parseSearchQuery(q, { companies: lexicon }));
  const on = (k: WeightKey) => isOn(prefs, k);
  const [jobs, responded, textHits, profile, insiders] = await Promise.all([
    db.job.findMany({ where: opts.where, include: { company: true }, omit: { description: true } }),
    on("response") ? respondedCompanies(opts.userId) : Promise.resolve(new Set<string>()),
    Promise.all(
      compiled.include.map(async (k) => {
        const ids = await db.job.findMany({
          where: { AND: [opts.where, ...searchWhere(k.terms, matchCompanies(k.terms, opts.companies))] },
          select: { id: true },
        });
        return new Set(ids.map((j) => j.id));
      }),
    ),
    on("salary") || on("companySize") || on("commute")
      ? db.profile.findUnique({
          where: { userId: opts.userId },
          select: { salaryMin: true, companyTypes: true, location: true },
        })
      : Promise.resolve(null),
    on("referral") ? insiderCompanies(opts.userId) : Promise.resolve(new Set<string>()),
  ]);
  // Seeker preferences, derived from the profile unless set on the ranking page.
  const home = on("commute") ? homePoint(profile?.location) : null;
  const expected = prefs.salaryMin ?? profile?.salaryMin ?? null;
  const targets = candidate
    ? candidate.targetSeniorities.length
      ? candidate.targetSeniorities
      : candidate.totalYears != null
        ? [inferSeniorityFromYears(candidate.totalYears)]
        : []
    : [];
  const employment = prefs.employment.length ? prefs.employment : defaultEmployment(targets);
  const companyTypes = (prefs.companyTypes.length ? prefs.companyTypes : (profile?.companyTypes ?? [])).filter(
    (t): t is CompanyType => t === "startup" || t === "mid" || t === "enterprise",
  );
  const perCompany = new Map<string, { industries: Industry[]; type: CompanyType | null }>();
  const companyInfo = (c: Company) => {
    let v = perCompany.get(c.id);
    if (!v) {
      const t = companyTier(c);
      v = { industries: industriesOf(c.industry), type: t.basis === "default" ? null : TIER_TYPE[t.tier] };
      perCompany.set(c.id, v);
    }
    return v;
  };
  let hidden = 0;
  const rows: PersonalRow[] = [];
  for (const j of jobs) {
    const m = candidate ? scoreMatch(candidate, j) : null;
    const ci = companyInfo(j.company);
    const personal = personalScore({
      job: j,
      match: m && candidate ? matchCore(m, candidate.targetRoles.length > 0, on) : null,
      values: {
        salary: on("salary") ? salaryValue(expected, offeredSalary({ ...j, description: "" })) : null,
        seniority: seniorityValue(j.seniority, targets),
        tech:
          m && candidate
            ? techValue({
                techStack: j.techStack,
                skillShare: Math.round((m.parts.skills / 50) * 100),
                wanted: candidate.wantedTech,
                avoid: candidate.avoidTech,
              })
            : null,
        domain: industryValue(ci.industries, prefs.industries),
        location: locationValue(j, candidate?.regions ?? []),
        commute: commuteValue(home, j),
        workMode: workModeValue(j.workMode, candidate?.workModes ?? []),
        employment: employmentValue(j.employmentType, employment),
        companySize: companySizeValue(ci.type, companyTypes),
        referral: insiders.has(j.companyId) ? 100 : null,
      },
      off: prefs.off,
      include: compiled.include,
      exclude: compiled.exclude,
      inText: (i) => textHits[i]?.has(j.id) ?? false,
      companyResponded: responded.has(j.companyId),
      weights: prefs.weights,
      now: opts.now,
    });
    if (personal.hidden) {
      hidden++;
      continue;
    }
    rows.push({ job: { ...j, description: "" }, score: m?.score ?? 0, personal });
  }
  rows.sort(
    (a, b) =>
      b.personal.score - a.personal.score ||
      b.job.postedAt.getTime() - a.job.postedAt.getTime() ||
      a.job.id.localeCompare(b.job.id),
  );
  return { rows, hidden };
}
