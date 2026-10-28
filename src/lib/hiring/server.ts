import { db } from "@/lib/db";
import type { CheckedResult } from "./discover";

export interface SourceRef {
  url: string;
  title: string;
}
export interface CheckedRef extends SourceRef {
  result: CheckedResult;
}

function asRefs<T extends SourceRef>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is T =>
      !!x &&
      typeof x === "object" &&
      typeof (x as SourceRef).url === "string" &&
      /^https?:\/\//.test((x as SourceRef).url),
  );
}

const withStages = { stages: { orderBy: { order: "asc" as const } } };

/**
 * Data for the "Hiring process" section: the official process (job-specific when the posting describes
 * one, else company-wide) and the signed-in user's own process for the company.
 */
export async function loadHiringProcess(opts: { companyId: string; jobId?: string | null; userId?: string | null }) {
  const [jobLevel, companyLevel, mine] = await Promise.all([
    opts.jobId
      ? db.hiringProcess.findFirst({
          where: { jobId: opts.jobId, kind: "official", status: "found" },
          include: withStages,
          orderBy: { checkedAt: "desc" },
        })
      : null,
    db.hiringProcess.findFirst({
      where: { companyId: opts.companyId, jobId: null, kind: "official" },
      include: withStages,
      orderBy: { checkedAt: "desc" },
    }),
    opts.userId
      ? db.hiringProcess.findFirst({
          where: { companyId: opts.companyId, userId: opts.userId, kind: "user" },
          include: withStages,
          orderBy: { updatedAt: "desc" },
        })
      : null,
  ]);
  const official = jobLevel ?? companyLevel;
  return {
    official: official
      ? {
          ...official,
          scope: jobLevel ? ("job" as const) : ("company" as const),
          sourceRefs: asRefs<SourceRef>(official.sources),
          checkedRefs: asRefs<CheckedRef>(companyLevel?.checked ?? official.checked),
        }
      : null,
    /** Company-wide check result, so a job-level process can still show what else was checked. */
    companyChecked: companyLevel ? asRefs<CheckedRef>(companyLevel.checked) : [],
    mine,
  };
}

export type HiringProcessData = Awaited<ReturnType<typeof loadHiringProcess>>;
