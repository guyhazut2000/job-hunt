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
import { discoverProcessPages, type CheckedSource, type CompanyTarget } from "./discover";
import { extractHiringProcess, hasProcessSignals, type Extraction, type SourcePage } from "./extract";
import { HIRING_SEEDS } from "./seeds";
import type { FetchDeps } from "./fetch";

/** Re-check companies after this long. */
export const RECHECK_DAYS = 30;
/** Minimum gap between LLM calls (global free-tier limit is 8/min). */
const LLM_GAP_MS = 8_500;

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
  jobsScanned: number;
  jobProcesses: number;
  llmCalls: number;
  errors: number;
  examples: { slug: string; stages: number; sources: string[] }[];
}

async function persistOfficial(
  companyId: string,
  jobId: string | null,
  ex: Extraction,
  checked: CheckedSource[],
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

class Pacer {
  private last = 0;
  calls = 0;
  constructor(private readonly max: number) {}
  get exhausted() {
    return this.calls >= this.max;
  }
  async take() {
    const wait = this.last + LLM_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
    this.calls++;
  }
}

async function extractPaced(name: string, pages: SourcePage[], llm: LLMProvider, pacer: Pacer) {
  if (llm.name === "mock") return extractHiringProcess(name, pages, null);
  // Out of LLM budget: leave the company for a later run instead of storing a heuristic guess.
  if (pacer.exhausted) return { ...(await extractHiringProcess(name, [], null)), method: "llm_failed" };
  await pacer.take();
  const ex = await extractHiringProcess(name, pages, llm);
  if (ex.method === "llm_failed") pacer.calls = Number.POSITIVE_INFINITY; // quota/limit hit → stop calling for this run
  return ex;
}

export async function processCompany(
  target: CompanyTarget & { id: string },
  llm: LLMProvider,
  pacer: Pacer,
  deps: FetchDeps,
): Promise<Extraction> {
  const { pages, checked } = await discoverProcessPages(target, deps);
  const ex = pages.length
    ? await extractPaced(target.name, pages, llm, pacer)
    : await extractHiringProcess(target.name, [], null);
  if (ex.method === "llm_failed") return ex; // retry on a later run
  await persistOfficial(target.id, null, ex, checked);
  return ex;
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
        NOT: { hiringProcesses: { some: { kind: "official", jobId: null, checkedAt: { gte: stale } } } },
      };
  const candidates = await prisma.company.findMany({
    where,
    select: { id: true, slug: true, name: true, website: true, careersUrl: true },
    orderBy: { name: "asc" },
    take: 600,
  });
  // Curated seeds first, then the rest.
  candidates.sort((a, b) => Number(!!HIRING_SEEDS[b.slug]) - Number(!!HIRING_SEEDS[a.slug]));
  const limit = opts.limit ?? 15;
  for (const c of candidates.slice(0, limit)) {
    if (Date.now() > deadline - 25_000) break;
    try {
      const ex = await processCompany(c, llm, pacer, deps);
      summary.companies++;
      if (ex.method === "llm_failed") summary.errors++;
      else if (ex.status === "found") {
        summary.found++;
        summary.examples.push({ slug: c.slug, stages: ex.stages.length, sources: ex.sourceUrls });
      } else summary.none++;
    } catch (e) {
      summary.errors++;
      console.warn(`[hiring] ${c.slug} failed:`, e instanceof Error ? e.message.slice(0, 200) : "error");
    }
  }

  // Job descriptions that spell out their own process → job-level processes.
  const jobLimit = opts.jobLimit ?? 10;
  if (jobLimit > 0 && Date.now() < deadline - 20_000) {
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        hiringProcesses: { none: { kind: "official" } },
        OR: [
          { description: { contains: "interview process", mode: "insensitive" } },
          { description: { contains: "hiring process", mode: "insensitive" } },
          { description: { contains: "recruitment process", mode: "insensitive" } },
          { description: { contains: "תהליך הגיוס" } },
          { description: { contains: "תהליך המיון" } },
        ],
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
