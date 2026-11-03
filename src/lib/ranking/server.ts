import "server-only";
import type { Company, Job, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emailResponses } from "@/lib/followup/server";
import { matchCompanies, searchWhere, type CompanyLike } from "@/lib/jobs/search";
import { type Candidate, scoreMatch } from "@/lib/profile/score";
import { loadCompanyLexicon } from "@/lib/search/lexicon-server";
import { parseSearchQuery } from "@/lib/search/query";
import { compilePrefs, normalizePrefs, type PersonalResult, personalScore, type RankingPrefs } from "./personal";

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
  const [jobs, responded, textHits] = await Promise.all([
    db.job.findMany({ where: opts.where, include: { company: true }, omit: { description: true } }),
    respondedCompanies(opts.userId),
    Promise.all(
      compiled.include.map(async (k) => {
        const ids = await db.job.findMany({
          where: { AND: [opts.where, ...searchWhere(k.terms, matchCompanies(k.terms, opts.companies))] },
          select: { id: true },
        });
        return new Set(ids.map((j) => j.id));
      }),
    ),
  ]);
  let hidden = 0;
  const rows: PersonalRow[] = [];
  for (const j of jobs) {
    const m = candidate ? scoreMatch(candidate, j) : null;
    const personal = personalScore({
      job: j,
      match: m ? m.score : null,
      missingSkills: m ? m.missingSkills.length : null,
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
