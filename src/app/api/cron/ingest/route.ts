import { NextResponse } from "next/server";
import { ingestAll } from "@/lib/ingestion/run";

export const dynamic = "force-dynamic";

/** Trigger from a scheduler (Vercel Cron, GitHub Actions, k8s CronJob) with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await ingestAll();
  return NextResponse.json({ results });
}
