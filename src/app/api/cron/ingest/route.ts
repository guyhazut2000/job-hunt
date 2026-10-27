import { NextResponse } from "next/server";
import { ingestAll } from "@/lib/ingestion/run";

export const dynamic = "force-dynamic";
/** Ingesting ~45 boards politely (with a delay between companies) takes a while. */
export const maxDuration = 300;

/**
 * Daily ingestion. Vercel Cron calls this with GET and `Authorization: Bearer $CRON_SECRET`
 * (see vercel.json); other schedulers (GitHub Actions, k8s CronJob) may POST with the same header.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await ingestAll();
  const summary = {
    companies: results.length,
    failed: results.filter((r) => r.error).length,
    created: results.reduce((n, r) => n + r.created, 0),
    updated: results.reduce((n, r) => n + r.updated, 0),
    deactivated: results.reduce((n, r) => n + r.deactivated, 0),
  };
  return NextResponse.json({ summary, results });
}

export const GET = handle;
export const POST = handle;
