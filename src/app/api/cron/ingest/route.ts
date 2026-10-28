import type { AtsProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { geocodeJobs } from "@/lib/geo/backfill";
import { ingestAllDetailed } from "@/lib/ingestion/run";
import { resolvePendingLinkedinJobs } from "@/lib/linkedin/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Stop starting new boards after this, leaving headroom under maxDuration for in-flight ones. */
const TIME_BUDGET_MS = 230_000;

/**
 * Daily ingestion. Vercel Cron calls this with GET and `Authorization: Bearer $CRON_SECRET`
 * (see vercel.json); other schedulers may POST with the same header.
 *
 * `?provider=WORKDAY,SMARTRECRUITERS` limits a run to some sources, so the cron can split the work
 * into several invocations that each fit the function time limit. Boards are visited stalest-first,
 * so anything skipped for time is first in line next run.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const param = new URL(req.url).searchParams.get("provider");
  const providers = param
    ? param
        .split(",")
        .map((p) => p.trim().toUpperCase())
        .filter((p): p is AtsProvider => (SUPPORTED_PROVIDERS as string[]).includes(p))
    : undefined;
  if (param && !providers?.length) return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  const { results, skipped } = await ingestAllDetailed({ providers, timeBudgetMs: TIME_BUDGET_MS });
  const summary = {
    providers: providers ?? "all",
    companies: results.length,
    skipped,
    failed: results.filter((r) => r.error).length,
    created: results.reduce((n, r) => n + r.created, 0),
    updated: results.reduce((n, r) => n + r.updated, 0),
    deactivated: results.reduce((n, r) => n + r.deactivated, 0),
    deferred: results.reduce((n, r) => n + (r.deferred ?? 0), 0),
    // Small capped batch of exact LinkedIn posting lookups (Brave); never fails the ingest.
    linkedin: await resolvePendingLinkedinJobs().catch(() => null),
    // Jobs-map points for new / moved postings (offline gazetteer); never fails the ingest.
    geocode: await geocodeJobs().catch(() => null),
  };
  return NextResponse.json({ summary, results });
}

export const GET = handle;
export const POST = handle;
