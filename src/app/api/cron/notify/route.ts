import { NextResponse } from "next/server";
import { runNotifications } from "@/lib/notifications/run";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Notifications cron (vercel.json): saved-search alerts, follow-up reminders, "saved job closed",
 * and the push/Telegram send queue (including messages held back by quiet hours).
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ summary: await runNotifications() });
}

export const GET = handle;
export const POST = handle;
