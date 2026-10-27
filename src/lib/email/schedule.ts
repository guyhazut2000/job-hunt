import type { EmailScanFrequency } from "@prisma/client";

const HOUR = 3_600_000;
/** Slightly under the nominal interval so cron jitter doesn't skip a cycle. */
const MIN_GAP: Record<EmailScanFrequency, number | null> = { MANUAL: null, DAILY: 20 * HOUR, EVERY_6H: 5 * HOUR };

export function isDue(freq: EmailScanFrequency, lastScanAt: Date | null, now = new Date()): boolean {
  const gap = MIN_GAP[freq];
  if (gap === null) return false;
  return !lastScanAt || now.getTime() - lastScanAt.getTime() >= gap;
}
