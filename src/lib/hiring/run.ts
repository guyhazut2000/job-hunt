/**
 * Hiring-process population (docs/hiring-process.md): discovers official pages per company, extracts a
 * grounded process (Gemini via the guarded provider, heuristic fallback) and stores it — "found" with
 * stages + sources, or "none" with the sources that were checked. Also scans job descriptions that
 * explicitly describe their process (job-level processes). Time-boxed and LLM-paced for the free tier.
 */
import type { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { guardedLLM } from "@/lib/ai";
import { sleep } from "@/lib/ingestion/http";
import type { LLMProvider } from "@/lib/ai/types";
import {
  discoverProcessPages,
  type CheckedSource,
  type CompanyTarget,
  type DiscoveryFailure,
  type DiscoveryStats,
} from "./discover";
import {
  extractHiringProcess,
  hasProcessSignals,
  jobProcessSource,
  type Extraction,
  type ExtractionFailure,
  type SourcePage,
} from "./extract";
import { HIRING_SEEDS } from "./seeds";
import type { FetchDeps } from "./fetch";

/** Re-check companies after this long. */
export const RECHECK_DAYS = 30;
/** Minimum gap between LLM calls (global free-tier limit is 8/min). */
const LLM_GAP_MS = 8_500;
/**
 * Bumped when discovery/extraction changes enough that older "none" results are worth re-checking.
 * v2 = sitemap/raw-link discovery, job-description aggregation, fuzzy grounding, 1-stage rule.
 */
export const PIPELINE_VERSION = 2;
/** Active job descriptions (with an explicit process section) added to a company's extraction. */
export const MAX_JOB_SOURCES = 3;
/** Companies discovered in parallel (LLM calls stay serialized by the pacer). */
const DISCOVERY_CONCURRENCY = 4;

/** Why a company ended up with "no info" (stored on the row for diagnostics / the admin report). */
export type FailureReason = DiscoveryFailure | ExtractionFailure;

export interface RunOptions {
  limit?: number;
  jobLimit?: number;
  timeBudgetMs?: number;
  /** Max LLM calls in this run (each extraction = at most one call). */
  maxLlmCalls?: number;
  slugs?: string[];
  deps?: FetchDeps;
}

export interface RunSummary {
  companies: number;
  found: number;
  none: number;
  /** "none" results by reason. */
  reasons: Partial<Record<FailureReason, number>>;
  /** Companies left for a later run (LLM budget/quota or time box). */
  deferred: number;
  jobsScanned: number;
  jobProcesses: number;
  llmCalls: number;
  errors: number;
  examples: { slug: string; stages: number; sources: string[] }[];
}

interface Diagnostics {
  failureReason: FailureReason | null;
  diagnostics: Prisma.InputJsonValue | null;
}

async function persistOfficial(
  companyId: string,
  jobId: string | null,
  ex: Extraction,
  checked: CheckedSource[],
  diag: Diagnostics = { failureReason: null, diagnostics: null },
): Promise<void> {
  const sourceSet = new Set(ex.sourceUrls);
  const titleOf = new Map(checked.map((c) => [c.url, c.title]));
  const checkedOut = checked.map((c) => ({ ...c, result: sourceSet.has(c.url) ? ("stages" as const) : c.result }));
  for (const u of ex.sourceUrls)
    if (!checkedOut.some((c) => c.url === u)) checkedOut.push({ url: u, title: "", result: "stages" });
  await prisma.$transaction([
    prisma.hiringProcess.deleteMany({ where: { companyId, jobId, kind: "official" } }),
    prisma.hiringProcess.create({
      data: {
        companyId,
        jobId,
        kind: "official",
        status: ex.status,
        confidence: ex.confidence,
        estimatedDuration: ex.estimatedDuration,
        notesHe: ex.notesHe,
        notesEn: ex.notesEn,
        sources: ex.sourceUrls.map((url) => ({ url, title: titleOf.get(url) ?? "" })) as Prisma.InputJsonValue,
        checked: checkedOut.slice(0, 20) as Prisma.InputJsonValue,
        method: ex.method,
        failureReason: ex.status === "found" ? null : diag.failureReason,
        pipelineVersion: PIPELINE_VERSION,
        ...(diag.diagnostics ? { diagnostics: diag.diagnostics } : {}),
        checkedAt: new Date(),
        stages: {
          create: ex.stages.map((s, i) => ({
            order: i,
            kind: s.kind,
            title: s.title,
            detailHe: s.detailHe,
            detailEn: s.detailEn,
            duration: s.duration,
            evidence: s.evidence,
            sourceUrl: s.sourceUrl,
          })),
        },
      },
    }),
  ]);
}

export class Pacer {
  private last = 0;
  private chain: Promise<void> = Promise.resolve();
  calls = 0;
  constructor(
    private readonly max: number,
    private readonly gapMs = LLM_GAP_MS,
  ) {}
  get exhausted() {
    return this.calls >= this.max;
  }
  /** Reserve one LLM call; resolves false when the budget ran out. Calls are spaced ≥ gapMs apart. */
  take(): Promise<boolean> {
    const turn = this.chain.then(async () => {
      if (this.exhausted) return false;
      const wait = this.last + this.gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      this.calls++;
      return true;
    });
    this.chain = turn.then(() => undefined);
    return turn;
  }
}

async function extractPaced(name: string, pages: SourcePage[], llm: LLMProvider, pacer: Pacer) {
  if (llm.name === "mock") return extractHiringProcess(name, pages, null);
  // Out of LLM budget: leave the company for a later run instead of storing a heuristic guess.
  if (!(await pacer.take())) return { ...(await extractHiringProcess(name, [], null)), method: "llm_failed" };
  const ex = await extractHiringProcess(name, pages, llm);
  if (ex.method === "llm_failed") pacer.calls = Number.POSITIVE_INFINITY; // quota/limit hit → stop calling for this run
  return ex;
}

/** Up to MAX_JOB_SOURCES active job descriptions of the company that describe their own process. */
async function companyJobSources(companyId: string, companyName: string): Promise<SourcePage[]> {
  const jobs = await prisma.job.findMany({
    where: { companyId, isActive: true, OR: PROCESS_JOB_FILTER },
    select: { title: true, description: true, applyUrl: true },
    orderBy: { postedAt: "desc" },
    take: 30,
  });
  const out: SourcePage[] = [];
  const seenText = new Set<string>();
  for (const j of jobs) {
    if (out.length >= MAX_JOB_SOURCES) break;
    const src = jobProcessSource({ url: j.applyUrl, title: `${companyName} — ${j.title}`, text: j.description });
    if (!src) continue;
    const key = src.text.slice(0, 400); // the same process section is often pasted into many postings
    if (seenText.has(key)) continue;
    seenText.add(key);
    out.push(src);
  }
  return out;
}

const PROCESS_JOB_FILTER: Prisma.JobWhereInput[] = [
  { description: { contains: "interview process", mode: "insensitive" } },
  { description: { contains: "hiring process", mode: "insensitive" } },
  { description: { contains: "recruitment process", mode: "insensitive" } },
  { description: { contains: "תהליך הגיוס" } },
  { description: { contains: "תהליך המיון" } },
];

export interface CompanyOutcome {
  ex: Extraction;
  failureReason: FailureReason | null;
  stats: DiscoveryStats;
  jobSources: number;
}

export async function processCompany(
  target: CompanyTarget & { id: string },
  llm: LLMProvider,
  pacer: Pacer,
  deps: FetchDeps,
  opts: { jobSources?: boolean } = {},
): Promise<CompanyOutcome> {
  const { pages, checked, failure, stats } = await discoverProcessPages(target, deps);
  const jobPages = opts.jobSources === false ? [] : await companyJobSources(target.id, target.name);
  const all = [...pages, ...jobPages];
  const ex = all.length
    ? await extractPaced(target.name, all, llm, pacer)
    : await extractHiringProcess(target.name, [], null);
  const failureReason: FailureReason | null =
    ex.status === "found" ? null : pages.length === 0 && jobPages.length === 0 ? failure : (ex.reason ?? null);
  const outcome = { ex, failureReason, stats, jobSources: jobPages.length };
  if (ex.method === "llm_failed") return outcome; // retry on a later run
  const checkedAll: CheckedSource[] = [
    ...checked,
    ...jobPages
      .filter((j) => ex.sourceUrls.includes(j.url))
      .map((j) => ({ url: j.url, title: j.title, result: "stages" as const })),
  ];
  await persistOfficial(target.id, null, ex, checkedAll, {
    failureReason,
    diagnostics: { stats, jobSources: jobPages.length, proposed: ex.proposed ?? 0 } as unknown as Prisma.InputJsonValue,
  });
  return outcome;
}

export async function runHiringProcessBatch(opts: RunOptions = {}): Promise<RunSummary> {
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? 240_000;
  const deadline = started + budget;
  const llm = await guardedLLM("hiring_process", null);
  const pacer = new Pacer(opts.maxLlmCalls ?? 20);
  const deps: FetchDeps = { robotsCache: new Map(), ...opts.deps };
  const summary: RunSummary = {
    companies: 0,
    found: 0,
    none: 0,
    reasons: {},
    deferred: 0,
    jobsScanned: 0,
    jobProcesses: 0,
    llmCalls: 0,
    errors: 0,
    examples: [],
  };

  const stale = new Date(started - RECHECK_DAYS * 86_400_000);
  const where: Prisma.CompanyWhereInput = opts.slugs?.length
    ? { slug: { in: opts.slugs } }
    : {
        jobs: { some: { isActive: true } },
        NOT: {
          hiringProcesses: {
            some: {
              kind: "official",
              jobId: null,
              checkedAt: { gte: stale },
              pipelineVersion: { gte: PIPELINE_VERSION },
            },
          },
        },
      };
  const candidates = await prisma.company.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      website: true,
      careersUrl: true,
      hiringProcesses: {
        where: { kind: "official", jobId: null },
        select: { id: true, status: true, checkedAt: true, pipelineVersion: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 600,
  });
  // Seeds first, then never checked, then older-pipeline "none", then older-pipeline "found".
  const rank = (c: (typeof candidates)[number]) => {
    if (HIRING_SEEDS[c.slug]) return 0;
    const row = c.hiringProcesses[0];
    if (!row) return 1;
    return row.status === "none" ? 2 : 3;
  };
  candidates.sort((a, b) => rank(a) - rank(b));
  const limit = opts.limit ?? 20;
  const queue = candidates.slice(0, limit);
  let stop = false;
  const worker = async () => {
    for (let c = queue.shift(); c && !stop; c = queue.shift()) {
      if (Date.now() > deadline - 40_000) {
        summary.deferred++;
        continue;
      }
      const prev = c.hiringProcesses[0];
      // A process found by an older pipeline that is still fresh: keep it (no LLM call), just mark it current.
      if (!opts.slugs?.length && prev?.status === "found" && prev.checkedAt >= stale) {
        await prisma.hiringProcess.update({ where: { id: prev.id }, data: { pipelineVersion: PIPELINE_VERSION } });
        continue;
      }
      try {
        const { ex, failureReason } = await processCompany(c, llm, pacer, deps);
        summary.companies++;
        if (ex.method === "llm_failed") {
          summary.deferred++;
          if (!Number.isFinite(pacer.calls)) stop = true; // quota/limit hit: stop this run
        } else if (ex.status === "found") {
          summary.found++;
          summary.examples.push({ slug: c.slug, stages: ex.stages.length, sources: ex.sourceUrls });
        } else {
          summary.none++;
          if (failureReason) summary.reasons[failureReason] = (summary.reasons[failureReason] ?? 0) + 1;
        }
      } catch (e) {
        summary.errors++;
        console.warn(`[hiring] ${c.slug} failed:`, e instanceof Error ? e.message.slice(0, 200) : "error");
      }
    }
  };
  await Promise.all(Array.from({ length: DISCOVERY_CONCURRENCY }, worker));

  // Job descriptions that spell out their own process → job-level processes.
  const jobLimit = opts.jobLimit ?? 8;
  if (jobLimit > 0 && Date.now() < deadline - 20_000) {
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        hiringProcesses: { none: { kind: "official" } },
        OR: PROCESS_JOB_FILTER,
        ...(opts.slugs?.length ? { company: { slug: { in: opts.slugs } } } : {}),
      },
      select: {
        id: true,
        companyId: true,
        title: true,
        description: true,
        applyUrl: true,
        company: { select: { name: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 300,
    });
    for (const j of jobs) {
      if (summary.jobProcesses >= jobLimit || Date.now() > deadline - 15_000) break;
      summary.jobsScanned++;
      if (!hasProcessSignals(j.description)) continue;
      const page: SourcePage = {
        url: j.applyUrl,
        title: `${j.company.name} — ${j.title}`,
        text: j.description,
        origin: "job",
      };
      try {
        const ex = await extractPaced(j.company.name, [page], llm, pacer);
        if (ex.status !== "found") continue;
        await persistOfficial(j.companyId, j.id, ex, [{ url: j.applyUrl, title: page.title, result: "stages" }]);
        summary.jobProcesses++;
      } catch (e) {
        summary.errors++;
        console.warn(`[hiring] job ${j.id} failed:`, e instanceof Error ? e.message.slice(0, 200) : "error");
      }
    }
  }
  summary.llmCalls = Number.isFinite(pacer.calls) ? pacer.calls : -1;
  return summary;
}
