import type { AtsProvider } from "@prisma/client";
import { db } from "../db";
import { changedFields, contentHash } from "../jobs/content-hash";
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
  // A manual-seed row whose company just got an adapter (provider still MANUAL) becomes automatic.
  // Rows an admin switched to manual keep their real provider, so they are left alone.
  await db.company.updateMany({
    where: { slug: { in: sources.map((s) => s.slug) }, atsProvider: "MANUAL", syncMode: "MANUAL" },
    data: { syncMode: "AUTO", syncFailures: 0 },
  });
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
        await upsertJob(job, companyId, known.get(job.externalId));
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

/** Known external ids → their stored content hash (null until first hashed). */
async function existingIds(source: AtsProvider, ids: string[]) {
  if (!ids.length) return new Map<string, string | null>();
  const rows = await db.job.findMany({
    where: { source, externalId: { in: ids } },
    select: { externalId: true, contentHash: true },
  });
  return new Map(rows.map((r) => [r.externalId, r.contentHash]));
}

/**
 * Insert or refresh a posting. The content hash lets a later scan see which fields the employer
 * edited; a change stamps `contentChangedAt` + `changedFields`, which feeds saved-job updates (#41).
 * The first hash on an existing row (prev null) is a baseline, not a change.
 */
function upsertJob(job: NormalizedJob, companyId: string, prevHash?: string | null) {
  const hash = contentHash(job);
  const changed = changedFields(prevHash, hash);
  const stamp = changed.length ? { contentChangedAt: new Date(), changedFields: changed } : {};
  return db.job.upsert({
    where: { source_externalId: { source: job.source, externalId: job.externalId } },
    create: { ...job, companyId, contentHash: hash },
    update: { ...job, companyId, isActive: true, contentHash: hash, ...stamp },
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
  /**
   * Only boards last synced longer ago than this (or never, or failing) are scanned; the rest are
   * counted as `fresh`. The fast scan uses it so it doesn't re-read boards the daily run just did.
   */
  staleAfterMs?: number;
}

export interface IngestAllResult {
  results: IngestionResult[];
  /** Stale companies not reached before the time budget ran out (the real backlog). */
  skipped: number;
  /** Per provider, the stale companies not reached (only providers with a backlog). */
  skippedByProvider: Partial<Record<AtsProvider, number>>;
  /** Companies left out because they were synced within `staleAfterMs` (0 without it). */
  fresh: number;
}

export interface ScanCandidate {
  id: string;
  atsProvider: AtsProvider;
  lastSyncedAt: Date | null;
  syncFailures: number;
}

/**
 * Stalest-first queue per provider. With `staleAfterMs`, boards synced more recently than that (and
 * not failing) are dropped from the queue and only counted. Pure — exported for tests.
 */
export function planScan(
  companies: ScanCandidate[],
  opts: { now?: number; staleAfterMs?: number } = {},
): { byProvider: Map<AtsProvider, string[]>; fresh: number } {
  const now = opts.now ?? Date.now();
  const cutoff = opts.staleAfterMs ? now - opts.staleAfterMs : null;
  const ts = (c: ScanCandidate) => c.lastSyncedAt?.getTime() ?? -Infinity;
  const sorted = [...companies].sort((a, b) => ts(a) - ts(b));
  const byProvider = new Map<AtsProvider, string[]>();
  let fresh = 0;
  for (const c of sorted) {
    if (cutoff !== null && c.lastSyncedAt && c.lastSyncedAt.getTime() >= cutoff && c.syncFailures === 0) {
      fresh++;
      continue;
    }
    byProvider.set(c.atsProvider, [...(byProvider.get(c.atsProvider) ?? []), c.id]);
  }
  return { byProvider, fresh };
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
    select: { id: true, atsProvider: true, lastSyncedAt: true, syncFailures: true },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
  });
  const deadline = options.timeBudgetMs ? started + options.timeBudgetMs : undefined;
  const { byProvider, fresh } = planScan(companies, { now: started, staleAfterMs: options.staleAfterMs });

  const results: IngestionResult[] = [];
  let skipped = 0;
  const skippedByProvider: Partial<Record<AtsProvider, number>> = {};
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
            skippedByProvider[provider] = (skippedByProvider[provider] ?? 0) + ids.length - next;
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
  return { results, skipped, skippedByProvider, fresh };
}

export async function ingestAll(options: IngestAllOptions = {}): Promise<IngestionResult[]> {
  return (await ingestAllDetailed(options)).results;
}
