import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isGmailConfigured } from "@/lib/email/config";
import { scanUser } from "@/lib/email/scan";
import { isDue } from "@/lib/email/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const BUDGET_MS = 240_000;

/**
 * Scheduled email scans. Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
 * The cron may fire more often than a user's setting; `isDue` enforces each user's frequency.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isGmailConfigured()) return NextResponse.json({ skipped: "not_configured" });

  const started = Date.now();
  const rows = await db.emailSyncSettings.findMany({
    where: { frequency: { not: "MANUAL" }, user: { emailAccounts: { some: {} } } },
    select: { userId: true, frequency: true, lastScanAt: true },
    orderBy: { lastScanAt: { sort: "asc", nulls: "first" } },
  });
  const due = rows.filter((r) => isDue(r.frequency, r.lastScanAt));
  let scanned = 0;
  let failed = 0;
  for (const r of due) {
    if (Date.now() - started > BUDGET_MS) break;
    const res = await scanUser(r.userId, "cron");
    if ("error" in res) failed++;
    else scanned++;
  }
  return NextResponse.json({ eligible: rows.length, due: due.length, scanned, failed });
}

export const GET = handle;
export const POST = handle;
