import type { AtsProvider } from "@prisma/client";
import { db } from "../db";
import { sleep } from "./http";
import { getAdapter } from "./registry";
import { MANUAL_COMPANIES, type ManualCompany } from "../companies/manual";
import { JOB_SOURCES, type JobSource } from "./sources";
import type { NormalizedJob } from "./types";

export interface IngestionResult {
  companyId: string;
  company?: string;
  provider?: AtsProvider;
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  /** New postings whose details were not fetched this run (detail budget / deadline); picked up next run. */
  deferred?: number;
  error?: string;
}

/** Pause between two companies of the same provider so we never hammer a job-board API. */
const POLITE_DELAY_MS = 750;
/** Max detail requests per company per run for list-only sources (Workday, SmartRecruiters). */
export const DETAIL_BUDGET = 60;

/**
 * Upsert the curated sources (src/lib/ingestion/sources.ts) as Company rows. No network access.
 * Existing rows keep any manual edits to fields not managed here.
 */
export async function syncSources(sources: JobSource[] = JOB_SOURCES): Promise<number> {
  for (const s of sources) {
    const managed = {
      name: s.name,
      website: s.website,
      industry: s.industry,
      hqLocation: s.hqLocation,
      atsProvider: s.provider,
      atsBoardId: s.boardId,
    };
    await db.company.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, ...managed, careersUrl: s.careersUrl, addedVia: "curated" },
      update: managed,
    });
  }
  return sources.length;
}

/**
 * Insert the curated manual companies (src/lib/companies/manual.ts): companies we can't pull jobs
 * from automatically but must keep visible. Only missing rows are created, so admin edits (notes,
 * careers URL, switching to AUTO once a feed exists) are never overwritten.
 */
export async function syncManualCompanies(companies: ManualCompany[] = MANUAL_COMPANIES): Promise<number> {
  const res = await db.company.createMany({
    data: companies.map((c) => ({
      slug: c.slug,
      name: c.name,
      website: c.website,
      careersUrl: c.careersUrl,
      industry: c.industry,
      hqLocation: c.hqLocation,
      notesHe: c.notesHe,
      notesEn: c.notesEn,
      atsProvider: "MANUAL" as const,
      syncMode: "MANUAL" as const,
      addedVia: "manual-seed",
    })),
    skipDuplicates: true,
  });
  return res.count;
}

export interface IngestOptions {
  /** Epoch ms after which no new detail requests are started. */
  deadline?: number;
  detailBudget?: number;
}

/** Sync one company's Israeli jobs from its ATS. Idempotent: upserts by (source, externalId). */
export async function ingestCompany(companyId: string, options: IngestOptions = {}): Promise<IngestionResult> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const adapter = getAdapter(company.atsProvider);
  const result: IngestionResult = {
    companyId,
    company: company.name,
    provider: company.atsProvider,
    fetched: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
  };
  if (!adapter || !company.atsBoardId) {
    result.error = "No ATS adapter/board configured";
    return result;
  }
  const ctx = { boardId: company.atsBoardId };
  const run = await db.ingestionRun.create({ data: { provider: company.atsProvider, companyId } });
  try {
    const raws = (await adapter.fetchRaw(ctx)).filter((r) => adapter.isInIsrael(r));
    result.fetched = raws.length;
    const seen = new Set<string>();

    if (adapter.detail) {
      // List-only source: refresh known postings cheaply, fetch details for new ones within budget.
      const detail = adapter.detail;
      const ids = raws.map((r) => detail.externalId(r, ctx));
      const known = await existingIds(company.atsProvider, ids);
      let budget = options.detailBudget ?? DETAIL_BUDGET;
      let deferred = 0;
      for (const [i, raw] of raws.entries()) {
        const id = ids[i];
        if (seen.has(id)) continue;
        if (known.has(id)) {
          seen.add(id);
          await db.job.update({
            where: { source_externalId: { source: company.atsProvider, externalId: id } },
            data: { isActive: true, companyId },
          });
          result.updated++;
          continue;
        }
        if (budget <= 0 || (options.deadline && Date.now() > options.deadline)) {
          deferred++;
          continue;
        }
        budget--;
        let full: unknown;
        try {
          full = await detail.fetch(raw, ctx);
        } catch {
          deferred++;
          continue;
        }
        if (!adapter.isInIsrael(full)) continue;
        const job = adapter.normalize(full);
        if (!job) continue;
        seen.add(job.externalId);
        await upsertJob(job, companyId);
        result.created++;
      }
      if (deferred) result.deferred = deferred;
    } else {
      const jobs = raws.map((r) => adapter.normalize(r)).filter((j): j is NormalizedJob => j !== null);
      const known = await existingIds(
        company.atsProvider,
        jobs.map((j) => j.externalId),
      );
      for (const job of jobs) {
        if (seen.has(job.externalId)) continue;
        seen.add(job.externalId);
        await upsertJob(job, companyId);
        if (known.has(job.externalId)) result.updated++;
        else result.created++;
      }
    }

    const stale = await db.job.updateMany({
      where: { companyId, source: company.atsProvider, isActive: true, externalId: { notIn: [...seen] } },
      data: { isActive: false },
    });
    result.deactivated = stale.count;
    await db.company.update({
      where: { id: companyId },
      data: { lastSyncedAt: new Date(), syncFailures: 0, lastSyncError: null, lastSyncErrorAt: null },
    });
  } catch (e) {
    // On fetch errors we keep the existing jobs active rather than wiping a board on a transient failure,
    // and record the error on the company: it stays listed (with its careers link) however long it fails.
    result.error = e instanceof Error ? e.message : String(e);
    await db.company.update({
      where: { id: companyId },
      data: { syncFailures: { increment: 1 }, lastSyncError: result.error.slice(0, 500), lastSyncErrorAt: new Date() },
    });
  }
  await db.ingestionRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      created: result.created,
      updated: result.updated,
      deactivated: result.deactivated,
      error: result.error,
    },
  });
  return result;
}

async function existingIds(source: AtsProvider, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.job.findMany({ where: { source, externalId: { in: ids } }, select: { externalId: true } });
  return new Set(rows.map((r) => r.externalId));
}

function upsertJob(job: NormalizedJob, companyId: string) {
  return db.job.upsert({
    where: { source_externalId: { source: job.source, externalId: job.externalId } },
    create: { ...job, companyId },
    update: { ...job, companyId, isActive: true },
  });
}

export interface IngestAllOptions {
  syncSources?: boolean;
  /** Only these providers (the cron splits providers across invocations). */
  providers?: AtsProvider[];
  /**
   * Wall-clock budget in ms. Companies not started by then are skipped (they are the freshest ones,
   * since we go stalest-first, so every board is still visited across runs).
   */
  timeBudgetMs?: number;
}

export interface IngestAllResult {
  results: IngestionResult[];
  /** Companies not reached before the time budget ran out. */
  skipped: number;
}

/**
 * Parallel lanes per provider. Workday boards are separate tenant hosts (each still paced by
 * http.ts), so a few run side by side; shared-host APIs (Greenhouse, Lever, ...) stay serial.
 */
const PROVIDER_LANES: Partial<Record<AtsProvider, number>> = { WORKDAY: 4 };

/**
 * Ingest every configured company. Providers run concurrently (they are different hosts); companies
 * of one provider run one at a time with a polite delay, stalest first.
 */
export async function ingestAllDetailed(options: IngestAllOptions = {}): Promise<IngestAllResult> {
  const started = Date.now();
  if (options.syncSources !== false) {
    await syncSources();
    await syncManualCompanies();
  }
  const companies = await db.company.findMany({
    where: {
      syncMode: "AUTO",
      atsProvider: options.providers?.length ? { in: options.providers } : { not: "MANUAL" },
      atsBoardId: { not: null },
    },
    select: { id: true, atsProvider: true },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
  });
  const deadline = options.timeBudgetMs ? started + options.timeBudgetMs : undefined;
  const byProvider = new Map<AtsProvider, string[]>();
  for (const c of companies) byProvider.set(c.atsProvider, [...(byProvider.get(c.atsProvider) ?? []), c.id]);

  const results: IngestionResult[] = [];
  let skipped = 0;
  await Promise.all(
    [...byProvider.entries()].flatMap(([provider, ids]) => {
      // Lanes pull from one shared queue; >1 lane only where every board is its own host.
      let next = 0;
      const lanes = Math.min(PROVIDER_LANES[provider] ?? 1, ids.length);
      return Array.from({ length: lanes }, async () => {
        for (let first = true; next < ids.length; first = false) {
          // Leave headroom for the slowest single board (detail fetches stop at the deadline too).
          if (deadline && Date.now() > deadline) {
            skipped += ids.length - next;
            next = ids.length;
            return;
          }
          const id = ids[next++];
          if (!first) await sleep(POLITE_DELAY_MS);
          results.push(await ingestCompany(id, { deadline }));
        }
      });
    }),
  );
  return { results, skipped };
}

export async function ingestAll(options: IngestAllOptions = {}): Promise<IngestionResult[]> {
  return (await ingestAllDetailed(options)).results;
}
