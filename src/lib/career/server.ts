import "server-only";
import type { Company, Job, Seniority } from "@prisma/client";
import { db } from "@/lib/db";
import { experienceItem, parseList } from "@/lib/profile/schema";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import {
  compareStepUps,
  currentPosition,
  gapFor,
  hasLeadership,
  stepTargets,
  stepUpMove,
  type Gap,
  type MoveKind,
  type Position,
  type StepMove,
} from "./ladder";

export interface StepUpRow {
  job: Job & { company: Company };
  move: StepMove;
  gap: Gap;
  score: number;
}

export interface StepUpResult {
  position: Position | null;
  rows: StepUpRow[];
  counts: Record<MoveKind | "all" | "apply", number>;
}

const MAX_SCAN = 600;

/** Step-up jobs for a user (#85): load the profile, place them on the ladder, keep one-step moves, analyse gaps. */
export async function loadStepUps(
  userId: string,
  override: { role?: string; level?: Seniority } = {},
): Promise<StepUpResult> {
  const empty = { all: 0, apply: 0, level: 0, broaden: 0, technical: 0 };
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return { position: null, rows: [], counts: empty };
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
  const { roles, levels } = stepTargets(position);
  const jobs = await db.job.findMany({
    where: { isActive: true, roleCategory: { in: roles }, seniority: { in: levels } },
    include: { company: true },
    orderBy: [{ postedAt: "desc" }, { id: "asc" }],
    take: MAX_SCAN,
  });
  const rows: StepUpRow[] = [];
  for (const job of jobs) {
    const move = stepUpMove(position, job);
    if (!move) continue;
    const m = candidate ? scoreMatch(candidate, job) : null;
    const gap = gapFor(move, {
      missingSkills: m ? m.missingSkills : job.techStack,
      years: position.years,
      leadership,
    });
    rows.push({ job, move, gap, score: m?.score ?? 0 });
  }
  rows.sort((a, b) =>
    compareStepUps(
      { gap: a.gap, score: a.score, postedAt: a.job.postedAt, id: a.job.id },
      { gap: b.gap, score: b.score, postedAt: b.job.postedAt, id: b.job.id },
    ),
  );
  const counts = { ...empty, all: rows.length };
  for (const r of rows) {
    counts[r.move.kind]++;
    if (r.gap.verdict === "apply") counts.apply++;
  }
  return { position, rows, counts };
}
