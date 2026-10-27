import { db } from "../db";
import { sleep } from "./http";
import { getAdapter } from "./registry";
import { JOB_SOURCES, type JobSource } from "./sources";

export interface IngestionResult {
  companyId: string;
  company?: string;
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  error?: string;
}

/** Pause between companies so we never hammer a job-board API. */
const POLITE_DELAY_MS = 750;

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
    await db.company.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...managed }, update: managed });
  }
  return sources.length;
}

/** Sync one company's Israeli jobs from its ATS. Idempotent: upserts by (source, externalId). */
export async function ingestCompany(companyId: string): Promise<IngestionResult> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const adapter = getAdapter(company.atsProvider);
  const result: IngestionResult = {
    companyId,
    company: company.name,
    fetched: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
  };
  if (!adapter || !company.atsBoardId) {
    result.error = "No ATS adapter/board configured";
    return result;
  }
  const run = await db.ingestionRun.create({ data: { provider: company.atsProvider, companyId } });
  try {
    const raws = await adapter.fetchRaw({ boardId: company.atsBoardId });
    result.fetched = raws.length;
    const jobs = raws
      .filter((r) => adapter.isInIsrael(r))
      .map((r) => adapter.normalize(r))
      .filter((j) => j !== null);
    const existing = new Set(
      (
        await db.job.findMany({
          where: { source: company.atsProvider, externalId: { in: jobs.map((j) => j.externalId) } },
          select: { externalId: true },
        })
      ).map((j) => j.externalId),
    );
    const seen = new Set<string>();
    for (const job of jobs) {
      if (seen.has(job.externalId)) continue;
      seen.add(job.externalId);
      await db.job.upsert({
        where: { source_externalId: { source: job.source, externalId: job.externalId } },
        create: { ...job, companyId },
        update: { ...job, companyId, isActive: true },
      });
      if (existing.has(job.externalId)) result.updated++;
      else result.created++;
    }
    const stale = await db.job.updateMany({
      where: { companyId, source: company.atsProvider, isActive: true, externalId: { notIn: [...seen] } },
      data: { isActive: false },
    });
    result.deactivated = stale.count;
    await db.company.update({ where: { id: companyId }, data: { lastSyncedAt: new Date() } });
  } catch (e) {
    // On fetch errors we keep the existing jobs active rather than wiping a board on a transient failure.
    result.error = e instanceof Error ? e.message : String(e);
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

export async function ingestAll(options: { syncSources?: boolean } = {}): Promise<IngestionResult[]> {
  if (options.syncSources !== false) await syncSources();
  const companies = await db.company.findMany({
    where: { atsProvider: { not: "MANUAL" }, atsBoardId: { not: null } },
    select: { id: true },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
  });
  const results: IngestionResult[] = [];
  for (const [i, c] of companies.entries()) {
    if (i > 0) await sleep(POLITE_DELAY_MS);
    results.push(await ingestCompany(c.id));
  }
  return results;
}
