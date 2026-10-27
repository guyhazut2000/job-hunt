/**
 * One-off backfill for the derived Job columns added in 20261027170000_job_derived_fields:
 * jobFunction, level, employmentType (from the title + ATS employment hint) and sourceUpdatedAt.
 *
 *   npx tsx scripts/backfill-job-fields.ts            # classify titles + refresh ATS hints/updated times
 *   npx tsx scripts/backfill-job-fields.ts --offline  # titles only; sourceUpdatedAt falls back to postedAt
 *
 * Only the derived columns are written. Safe to re-run; the regular ingest also sets these going forward.
 */
import { db } from "../src/lib/db";
import { deriveJobFields } from "../src/lib/jobs/classify";
import { getAdapter } from "../src/lib/ingestion/registry";
import type { NormalizedJob } from "../src/lib/ingestion/types";

const offline = process.argv.includes("--offline");

async function atsSnapshot(): Promise<Map<string, NormalizedJob>> {
  const out = new Map<string, NormalizedJob>();
  if (offline) return out;
  const companies = await db.company.findMany({ where: { atsBoardId: { not: null } } });
  for (const c of companies) {
    const adapter = getAdapter(c.atsProvider);
    if (!adapter || !c.atsBoardId) continue;
    try {
      for (const raw of await adapter.fetchRaw({ boardId: c.atsBoardId })) {
        const j = adapter.normalize(raw);
        if (j) out.set(`${j.source}:${j.externalId}`, j);
      }
    } catch (e) {
      console.warn(`skip ${c.slug}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 300)); // be polite to public job boards
  }
  return out;
}

async function main() {
  const ats = await atsSnapshot();
  const jobs = await db.job.findMany({
    select: { id: true, source: true, externalId: true, title: true, postedAt: true },
  });
  let fromAts = 0;
  for (const job of jobs) {
    const live = ats.get(`${job.source}:${job.externalId}`);
    if (live) fromAts++;
    const derived = live
      ? { jobFunction: live.jobFunction, level: live.level, employmentType: live.employmentType }
      : deriveJobFields(job.title);
    await db.job.update({
      where: { id: job.id },
      data: { ...derived, sourceUpdatedAt: live?.sourceUpdatedAt ?? job.postedAt },
    });
  }
  console.log(`Backfilled ${jobs.length} jobs (${fromAts} with live ATS data).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
