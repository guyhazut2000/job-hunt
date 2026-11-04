/** Loads the inputs for the cross-job skill-gap analysis (#117) for one user. */
import { db } from "@/lib/db";
import { hasScorableProfile, toCandidate } from "@/lib/profile/score";
import { aggregateGaps, type GapJob, type GapReport, type GapSource } from "./aggregate";

/** Caps keep the page light (docs/ui-data-density.md): recent target jobs + all tracked ones. */
export const MAX_TARGET_JOBS = 150;
export const MAX_TRACKED = 400;

const jobSelect = {
  id: true,
  title: true,
  techStack: true,
  roleCategory: true,
  seniority: true,
  location: true,
  workMode: true,
  company: { select: { name: true } },
} as const;

export async function loadGapReport(userId: string): Promise<{ report: GapReport | null; hasProfile: boolean }> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile || !hasScorableProfile(profile)) return { report: null, hasProfile: false };
  const c = toCandidate(profile);
  const [target, apps, debriefs] = await Promise.all([
    c.targetRoles.length
      ? db.job.findMany({
          where: {
            isActive: true,
            roleCategory: { in: c.targetRoles },
            ...(c.targetSeniorities.length ? { seniority: { in: c.targetSeniorities } } : {}),
          },
          orderBy: [{ postedAt: "desc" }, { id: "asc" }],
          take: MAX_TARGET_JOBS,
          select: jobSelect,
        })
      : Promise.resolve([]),
    db.application.findMany({
      where: { userId, archivedAt: null, jobId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: MAX_TRACKED,
      select: { status: true, job: { select: jobSelect } },
    }),
    db.interviewDebrief.findMany({
      where: { userId },
      orderBy: { happenedAt: "desc" },
      take: 200,
      select: {
        applicationId: true,
        rating: true,
        outcome: true,
        asked: true,
        improve: true,
        application: { select: { title: true } },
      },
    }),
  ]);
  const toGap = (j: (typeof target)[number], source: GapSource): GapJob => ({
    id: j.id,
    title: j.title,
    company: j.company.name,
    source,
    techStack: j.techStack,
    roleCategory: j.roleCategory,
    seniority: j.seniority,
    location: j.location,
    workMode: j.workMode,
  });
  const jobs: GapJob[] = [
    ...target.map((j) => toGap(j, "target")),
    ...apps.filter((a) => a.job).map((a) => toGap(a.job!, a.status === "SAVED" ? "saved" : "applied")),
  ];
  const report = aggregateGaps({
    candidate: c,
    jobs,
    debriefs: debriefs.map((d) => ({
      applicationId: d.applicationId,
      title: d.application.title,
      rating: d.rating,
      outcome: d.outcome,
      asked: d.asked,
      improve: d.improve,
    })),
  });
  return { report, hasProfile: true };
}
