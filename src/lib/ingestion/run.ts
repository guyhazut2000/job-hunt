import { db } from "../db";
import { getAdapter } from "./registry";

export interface IngestionResult {
  companyId: string;
  created: number;
  updated: number;
  deactivated: number;
  error?: string;
}

/** Sync one company's jobs from its ATS. Idempotent: upserts by (source, externalId). */
export async function ingestCompany(companyId: string): Promise<IngestionResult> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const adapter = getAdapter(company.atsProvider);
  const result: IngestionResult = { companyId, created: 0, updated: 0, deactivated: 0 };
  if (!adapter || !company.atsBoardId) {
    result.error = "No ATS adapter/board configured";
    return result;
  }
  const run = await db.ingestionRun.create({
    data: { provider: company.atsProvider, companyId },
  });
  try {
    const raws = await adapter.fetchRaw({ boardId: company.atsBoardId });
    const jobs = raws.map((r) => adapter.normalize(r)).filter((j) => j !== null);
    const seen = new Set<string>();
    for (const job of jobs) {
      seen.add(job.externalId);
      const existing = await db.job.findUnique({
        where: { source_externalId: { source: job.source, externalId: job.externalId } },
        select: { id: true },
      });
      await db.job.upsert({
        where: { source_externalId: { source: job.source, externalId: job.externalId } },
        create: { ...job, companyId },
        update: { ...job, isActive: true },
      });
      if (existing) result.updated++;
      else result.created++;
    }
    const stale = await db.job.updateMany({
      where: { companyId, source: company.atsProvider, isActive: true, externalId: { notIn: [...seen] } },
      data: { isActive: false },
    });
    result.deactivated = stale.count;
    await db.company.update({ where: { id: companyId }, data: { lastSyncedAt: new Date() } });
  } catch (e) {
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

export async function ingestAll(): Promise<IngestionResult[]> {
  const companies = await db.company.findMany({
    where: { atsProvider: { not: "MANUAL" }, atsBoardId: { not: null } },
    select: { id: true },
  });
  const results: IngestionResult[] = [];
  for (const c of companies) results.push(await ingestCompany(c.id));
  return results;
}
