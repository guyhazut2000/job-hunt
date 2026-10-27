import { db } from "@/lib/db";
import { BraveError, braveWebSearch, createPacer } from "@/lib/people/brave";
import { peopleSearchConfig } from "@/lib/people/config";
import { MONTH } from "@/lib/people/limits";
import { fixtureJobResults } from "./fixtures";
import { buildLinkedinJobQuery, needsLinkedinCheck, pickLinkedinJob, RECHECK_MISS_MS } from "./jobs";

export type LinkedinResolveStatus = "found" | "not_found" | "cached" | "disabled" | "budget" | "busy" | "error";

const int = (v: string | undefined, d: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

/** Job-link lookups get their own slice of the shared Brave monthly cap (BRAVE_MONTHLY_CAP). */
export function linkedinJobsConfig(env: Record<string, string | undefined> = process.env) {
  const base = peopleSearchConfig(env);
  return {
    ...base,
    monthlyJobCap: int(env.LINKEDIN_JOB_MONTHLY_CAP, 300),
    ingestBatch: int(env.LINKEDIN_JOB_INGEST_BATCH, 10),
  };
}

const g = globalThis as unknown as { __bravePace?: () => Promise<void> };
const pacer = (ms: number) => (g.__bravePace ??= createPacer(ms));

/** Uncached Brave calls in the last 30 days: people search + job-link lookups (one shared budget). */
export async function braveCallsThisMonth(now = new Date()) {
  const since = new Date(now.getTime() - MONTH);
  const [people, jobs] = await Promise.all([
    db.peopleSearchUsage.count({ where: { cached: false, createdAt: { gt: since } } }),
    db.linkedinJobLookup.count({ where: { createdAt: { gt: since } } }),
  ]);
  return { people, jobs, total: people + jobs };
}

/** Pure budget check, exported for tests. */
export function withinBudget(
  used: { total: number; jobs: number },
  cfg: { monthlyCap: number; monthlyJobCap: number },
): boolean {
  return used.total < cfg.monthlyCap && used.jobs < cfg.monthlyJobCap;
}

/**
 * Find (and cache on the Job) the exact LinkedIn posting via Brave Search.
 * Claims the job first (linkedinCheckedAt) so concurrent page views trigger at most one call.
 */
export async function resolveLinkedinJob(
  jobId: string,
  trigger: "view" | "ingest",
): Promise<{ status: LinkedinResolveStatus; url: string | null }> {
  const cfg = linkedinJobsConfig();
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      linkedinUrl: true,
      linkedinCheckedAt: true,
      isActive: true,
      company: { select: { name: true } },
    },
  });
  if (!job) return { status: "error", url: null };
  if (!needsLinkedinCheck(job)) return { status: "cached", url: job.linkedinUrl };
  if (!cfg.enabled || !job.isActive) return { status: "disabled", url: job.linkedinUrl };

  const now = new Date();
  if (!withinBudget(await braveCallsThisMonth(now), cfg)) return { status: "budget", url: job.linkedinUrl };

  // Claim: only one request wins for a given previous checkedAt value.
  const claim = await db.job.updateMany({
    where: { id: job.id, linkedinCheckedAt: job.linkedinCheckedAt },
    data: { linkedinCheckedAt: now },
  });
  if (claim.count === 0) return { status: "busy", url: job.linkedinUrl };

  try {
    const query = buildLinkedinJobQuery(job.title, job.company.name);
    const page = cfg.mock
      ? fixtureJobResults(job.title, job.company.name)
      : await braveWebSearch(query, { apiKey: cfg.apiKey!, page: 0, count: 10, pace: pacer(cfg.minIntervalMs) });
    const hit = pickLinkedinJob(page.results, { title: job.title, company: job.company.name });
    // A miss keeps a previously found link (postings can drop out of the index temporarily).
    const url = hit?.url ?? job.linkedinUrl ?? null;
    await db.$transaction([
      db.job.update({ where: { id: job.id }, data: { linkedinUrl: url, linkedinCheckedAt: now } }),
      db.linkedinJobLookup.create({ data: { jobId: job.id, found: !!hit, trigger } }),
    ]);
    return { status: hit ? "found" : "not_found", url };
  } catch (e) {
    // Roll the claim back so a transient failure is retried later (but not immediately on every view).
    const retryAt = new Date(now.getTime() - RECHECK_MISS_MS + 3600_000);
    await db.job
      .update({ where: { id: job.id }, data: { linkedinCheckedAt: job.linkedinCheckedAt ?? retryAt } })
      .catch(() => {});
    if (e instanceof BraveError && (e.kind === "quota" || e.kind === "rate"))
      return { status: "budget", url: job.linkedinUrl };
    if (e instanceof BraveError && e.kind === "auth") return { status: "disabled", url: job.linkedinUrl };
    console.error("[linkedin-jobs] provider error", e instanceof Error ? e.message : "unknown");
    return { status: "error", url: job.linkedinUrl };
  }
}

/** Daily ingest: resolve a small batch of the newest unchecked active jobs, within budget. */
export async function resolvePendingLinkedinJobs(limit = linkedinJobsConfig().ingestBatch) {
  const cfg = linkedinJobsConfig();
  const out = { checked: 0, found: 0, stopped: null as LinkedinResolveStatus | null };
  if (!cfg.enabled || limit <= 0) return out;
  const jobs = await db.job.findMany({
    where: { isActive: true, linkedinCheckedAt: null },
    orderBy: { postedAt: "desc" },
    take: limit,
    select: { id: true },
  });
  for (const j of jobs) {
    const r = await resolveLinkedinJob(j.id, "ingest");
    if (r.status === "budget" || r.status === "disabled") {
      out.stopped = r.status;
      break;
    }
    if (r.status === "found" || r.status === "not_found") out.checked++;
    if (r.status === "found") out.found++;
  }
  return out;
}
