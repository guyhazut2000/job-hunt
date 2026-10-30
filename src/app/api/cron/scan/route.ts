import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { FAST_SCAN_BUDGET_MS, FAST_SCAN_STALE_MS, authorized, scanInProgress } from "@/lib/ingestion/fast-scan";
import { LAST_SCAN_TAG } from "@/lib/ingestion/last-scan";
import { ingestAllDetailed } from "@/lib/ingestion/run";
import { runFollowedCompanyAlerts } from "@/lib/notifications/company-follow";
import { processDeliveries } from "@/lib/notifications/deliver";
import { runSavedSearchAlerts } from "@/lib/notifications/saved-search";
import { runScanFailureAlerts } from "@/lib/notifications/scan-failures";

export const dynamic = "force-dynamic";
/** The scan stops starting boards after FAST_SCAN_BUDGET_MS; the rest is headroom for in-flight ones. */
export const maxDuration = 120;

/**
 * Fast scan: called every ~15 min by .github/workflows/fast-scan.yml (free external scheduler —
 * Vercel Hobby crons run at most daily). Refreshes the stalest boards (only those not synced in the last hour) for ~45 s, then sends the
 * alerts for whatever it found right away. Auth: `Bearer $SCAN_TRIGGER_SECRET` (or `$CRON_SECRET`).
 */
async function handle(req: Request) {
  if (!authorized(req.headers.get("authorization"), [process.env.SCAN_TRIGGER_SECRET, process.env.CRON_SECRET])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (await scanInProgress()) return NextResponse.json({ skipped: "scan in progress" });

  const started = Date.now();
  const { results, skipped, skippedByProvider, fresh } = await ingestAllDetailed({
    timeBudgetMs: FAST_SCAN_BUDGET_MS,
    staleAfterMs: FAST_SCAN_STALE_MS,
    syncSources: false,
  });
  try {
    revalidateTag(LAST_SCAN_TAG);
  } catch {
    // outside a Next request context — nothing to revalidate
  }
  const safe = <T>(p: Promise<T>) => p.catch((e: unknown) => ({ error: e instanceof Error ? e.message : "error" }));
  const searches = await safe(runSavedSearchAlerts());
  const companies = await safe(runFollowedCompanyAlerts());
  const failures = await safe(runScanFailureAlerts());
  const deliveries = await safe(processDeliveries());
  return NextResponse.json({
    summary: {
      ms: Date.now() - started,
      companies: results.length,
      /** Stale boards (not synced in the last hour) this tick didn't reach; the next tick starts there. */
      remaining: skipped,
      remainingByProvider: skippedByProvider,
      /** Boards skipped because they were synced within the last hour. */
      fresh,
      failed: results.filter((r) => r.error).length,
      created: results.reduce((n, r) => n + r.created, 0),
      updated: results.reduce((n, r) => n + r.updated, 0),
      deactivated: results.reduce((n, r) => n + r.deactivated, 0),
    },
    notifications: { searches, companies, failures, deliveries },
  });
}

export const GET = handle;
export const POST = handle;
