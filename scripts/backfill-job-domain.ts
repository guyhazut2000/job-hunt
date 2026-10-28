/**
 * Backfill Job.domain (migration 20261028140000_job_domain) with the deterministic classifier.
 *
 *   npx tsx --env-file=.env scripts/backfill-job-domain.ts          # every job
 *   npx tsx --env-file=.env scripts/backfill-job-domain.ts --active # open roles only
 *
 * Only `domain` is written, and only when it changes. Safe to re-run; ingest sets it going forward.
 */
import { db } from "../src/lib/db";
import { DOMAIN_DESCRIPTION_CHARS, inferJobDomain } from "../src/lib/jobs/domain-classifier";

const activeOnly = process.argv.includes("--active");
const BATCH = 500;

async function main() {
  const counts = new Map<string, number>();
  let changed = 0;
  let cursor: string | undefined;
  for (;;) {
    const jobs = await db.job.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      select: { id: true, title: true, department: true, techStack: true, description: true, domain: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!jobs.length) break;
    cursor = jobs[jobs.length - 1].id;
    const byDomain = new Map<string, string[]>();
    for (const j of jobs) {
      const domain = inferJobDomain({ ...j, description: j.description.slice(0, DOMAIN_DESCRIPTION_CHARS) });
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
      if (domain === j.domain) continue;
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), j.id]);
    }
    for (const [domain, ids] of byDomain) {
      await db.job.updateMany({ where: { id: { in: ids } }, data: { domain } });
      changed += ids.length;
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`Classified ${total} jobs, updated ${changed}.`);
  for (const [d, n] of [...counts].sort((a, b) => b[1] - a[1]))
    console.log(`${d.padEnd(14)} ${String(n).padStart(5)}  ${((100 * n) / Math.max(1, total)).toFixed(1)}%`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
