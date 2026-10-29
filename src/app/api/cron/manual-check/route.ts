import { NextResponse } from "next/server";
import { runManualCheckReminders } from "@/lib/companies/manual-check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly "check these careers sites by hand" reminder (vercel.json, Sunday morning Israel time).
 * Only creates notifications; the hourly send queue delivers push/Telegram.
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ summary: await runManualCheckReminders() });
}

export const GET = handle;
export const POST = handle;
