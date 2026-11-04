import "server-only";
import type { Company, Job, Seniority } from "@prisma/client";
import { db } from "@/lib/db";
import { experienceItem, parseList } from "@/lib/profile/schema";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import { EMPTY_PREFS, type PersonalResult } from "@/lib/ranking/personal";
import { getRankingPrefs, rankPersonal } from "@/lib/ranking/server";
import {
  compareStepUps,
  currentPosition,
  gapFor,
  hasLeadership,
  stepTargets,
  stepUpMove,
  TECH_TITLE_TERMS,
  type Gap,
  type MoveKind,
  type Position,
  type StepMove,
} from "./ladder";

export interface StepUpRow {
  job: Job & { company: Company };
  move: StepMove;
  gap: Gap;
  /** Plain profile match (shown on the card). */
  score: number;
  /** The user's personal ranking (#106 criteria) — what the list is ordered by, with the "why" breakdown. */
  personal: PersonalResult | null;
}

export interface StepUpResult {
  position: Position | null;
  rows: StepUpRow[];
  counts: Record<MoveKind | "all" | "apply", number>;
  /** Jobs hidden by the user's ranking keywords (must-have missing / not interested). */
  hidden: number;
}

const MAX_SCAN = 600;
/** Technical-track candidates are fetched separately so the newest-first cap above can't crowd them out. */
const MAX_TECH_SCAN = 300;

/** Step-up jobs for a user (#85): load the profile, place them on the ladder, keep one-step moves, analyse gaps. */
export async function loadStepUps(
  userId: string,
  override: { role?: string; level?: Seniority } = {},
): Promise<StepUpResult> {
  const empty = { all: 0, apply: 0, level: 0, broaden: 0, technical: 0 };
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return { position: null, rows: [], counts: empty, hidden: 0 };
  const exp = parseList(experienceItem, profile.experience).sort(
    (a, b) => (b.end || "9999").localeCompare(a.end || "9999") || (b.start || "").localeCompare(a.start || ""),
  );
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const position = currentPosition(
    {
      targetRoles: candidate?.targetRoles ?? profile.targetRoles,
      seniority: profile.seniority,
      totalYears: candidate?.totalYears ?? profile.yearsExperience ?? undefined,
      experienceTitles: exp.map((e) => e.title),
    },
    override,
  );
  const leadership = hasLeadership(
    exp.map((e) => e.title),
    exp.map((e) => e.description),
  );
  const { roles, levels, techRoles } = stepTargets(position);
  const order = [{ postedAt: "desc" as const }, { id: "asc" as const }];
  const [general, technical] = await Promise.all([
    db.job.findMany({
      where: { isActive: true, roleCategory: { in: roles }, seniority: { in: levels } },
      include: { company: true },
      orderBy: order,
      take: MAX_SCAN,
    }),
    db.job.findMany({
      where: {
        isActive: true,
        roleCategory: { in: techRoles },
        seniority: { in: levels },
        OR: TECH_TITLE_TERMS.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
      },
      include: { company: true },
      orderBy: order,
      take: MAX_TECH_SCAN,
    }),
  ]);
  const seen = new Set<string>();
  const jobs = [...general, ...technical].filter((j) => !seen.has(j.id) && (seen.add(j.id), true));
  const scored: Omit<StepUpRow, "personal">[] = [];
  for (const job of jobs) {
    const move = stepUpMove(position, job);
    if (!move) continue;
    const m = candidate ? scoreMatch(candidate, job) : null;
    const gap = gapFor(move, {
      missingSkills: m ? m.missingSkills : job.techStack,
      years: position.years,
      leadership,
    });
    scored.push({ job, move, gap, score: m?.score ?? 0 });
  }
  // Rank with the same personal engine and criteria as "התאמה אישית" on /jobs (#110).
  const prefs = (await getRankingPrefs(userId)) ?? EMPTY_PREFS;
  const companies = prefs.include.length
    ? await db.company.findMany({
        select: { id: true, slug: true, name: true, website: true, nameHe: true, aliases: true },
      })
    : [];
  const ranked = scored.length
    ? await rankPersonal({
        userId,
        where: { id: { in: scored.map((r) => r.job.id) } },
        prefs,
        candidate,
        companies,
      })
    : { rows: [], hidden: 0 };
  const personalById = new Map(ranked.rows.map((r) => [r.job.id, r.personal]));
  const hiddenIds = ranked.hidden ? new Set(scored.map((r) => r.job.id).filter((id) => !personalById.has(id))) : null;
  const rows: StepUpRow[] = scored
    .filter((r) => !hiddenIds?.has(r.job.id))
    .map((r) => ({ ...r, personal: personalById.get(r.job.id) ?? null }));
  rows.sort((a, b) =>
    compareStepUps(
      { gap: a.gap, score: a.personal?.score ?? a.score, postedAt: a.job.postedAt, id: a.job.id },
      { gap: b.gap, score: b.personal?.score ?? b.score, postedAt: b.job.postedAt, id: b.job.id },
    ),
  );
  const counts = { ...empty, all: rows.length };
  for (const r of rows) {
    counts[r.move.kind]++;
    if (r.gap.verdict === "apply") counts.apply++;
  }
  return { position, rows, counts, hidden: ranked.hidden };
}
