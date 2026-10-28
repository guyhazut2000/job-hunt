import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { LAST_SCAN_TAG, SCAN_WINDOW_MS, summarizeScan, type ScanSummary } from "./last-scan";

/** Latest scan summary: two small indexed queries, cached 5 min (and busted by the ingest cron). */
export const getLastScan = unstable_cache(
  async (): Promise<ScanSummary | null> => {
    const newest = await db.ingestionRun.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    });
    if (!newest?.finishedAt) return null;
    const rows = await db.ingestionRun.findMany({
      where: { finishedAt: { gte: new Date(newest.finishedAt.getTime() - SCAN_WINDOW_MS) } },
      select: { companyId: true, finishedAt: true, created: true, updated: true, error: true },
    });
    return summarizeScan(rows.map((r) => ({ ...r, finishedAt: r.finishedAt ?? newest.finishedAt! })));
  },
  ["last-scan-v1"],
  { revalidate: 300, tags: [LAST_SCAN_TAG] },
);

export async function lastScanSafe(): Promise<ScanSummary | null> {
  try {
    return await getLastScan();
  } catch {
    return null; // decoration; never fail the jobs page on it
  }
}
