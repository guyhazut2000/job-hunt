import { NextResponse } from "next/server";
import { ingestDiscovered, runDiscovery } from "@/lib/discovery/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Discovery itself stops starting new checks ~25 s before this; the rest ingests newly added boards. */
const DISCOVERY_BUDGET_MS = 200_000;
const TOTAL_BUDGET_MS = 250_000;

/**
 * Startup discovery (see docs/startup-discovery.md). Vercel Cron calls this daily with
 * `Authorization: Bearer $CRON_SECRET`: the open directories are re-imported when the last import is
 * over a week old, then a time-boxed batch of candidates is checked for a public ATS feed.
 * `?import=always|never` overrides the weekly import.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const param = new URL(req.url).searchParams.get("import");
  const mode = param === "always" || param === "never" ? param : "auto";
  const { run, imported, check } = await runDiscovery({
    trigger: "cron",
    timeBudgetMs: DISCOVERY_BUDGET_MS,
    import: mode,
  });
  const ingestedJobs = await ingestDiscovered(started + TOTAL_BUDGET_MS).catch(() => null);
  return NextResponse.json({
    runId: run.id,
    imported: imported ? { fetched: imported.fetched, created: imported.created, errors: imported.errors } : null,
    check,
    pendingReview: run.pending,
    ingestedJobs,
  });
}

export const GET = handle;
export const POST = handle;
