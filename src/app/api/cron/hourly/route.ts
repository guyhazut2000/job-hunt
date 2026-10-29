import { NextResponse } from "next/server";
import { runHourly } from "@/lib/notifications/hourly";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hourly cron (vercel.json lists it once per hour — Hobby crons run at most daily each, and fire
 * somewhere inside the scheduled hour): interview + learning reminders, daily digests, send queue.
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ summary: await runHourly() });
}

export const GET = handle;
export const POST = handle;
