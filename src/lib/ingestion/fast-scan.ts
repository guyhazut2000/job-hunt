import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/** Fast scan (docs/notifications.md#fast-scan): small, frequent slices of the daily ingest. */
export const FAST_SCAN_BUDGET_MS = 45_000;
/**
 * Boards synced within this window are skipped by the fast scan (the daily run or an earlier tick
 * just read them), so each tick spends its budget on the stale backlog and `remaining` means
 * "stale boards still waiting" instead of "every board this tick didn't get to".
 */
export const FAST_SCAN_STALE_MS = 60 * 60 * 1000;
/** An unfinished ingest run younger than this = another scan is in progress; skip this tick. */
export const OVERLAP_WINDOW_MS = 6 * 60 * 1000;

/** `Authorization: Bearer <secret>` against any of the configured secrets (constant-time). */
export function authorized(header: string | null, secrets: (string | undefined)[]): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  let ok = false;
  for (const s of secrets) {
    if (!s || s.length < 16) continue;
    const want = Buffer.from(s);
    if (want.length === given.length && timingSafeEqual(want, given)) ok = true;
  }
  return ok;
}

/** True when another ingest (daily cron or an earlier fast scan) is still running. */
export async function scanInProgress(now = new Date()): Promise<boolean> {
  const running = await db.ingestionRun.findFirst({
    where: { finishedAt: null, startedAt: { gte: new Date(now.getTime() - OVERLAP_WINDOW_MS) } },
    select: { id: true },
  });
  return Boolean(running);
}
