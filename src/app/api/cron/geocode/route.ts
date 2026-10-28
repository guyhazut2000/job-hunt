import { NextResponse } from "next/server";
import { geocodeJobs } from "@/lib/geo/backfill";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Geocode backfill for the jobs map (offline gazetteer, no external calls). Runs after every ingest
 * too; call it directly with `Authorization: Bearer $CRON_SECRET` (`?all=1` recomputes every job).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const all = new URL(req.url).searchParams.get("all") === "1";
  const result = await geocodeJobs({ all });
  return NextResponse.json({ ...result, coverage: result.active ? result.withGeo / result.active : 0 });
}

export const GET = handle;
export const POST = handle;
