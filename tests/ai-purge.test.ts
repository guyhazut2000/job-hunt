import { describe, expect, it } from "vitest";
import {
  AI_USAGE_KEEP_MS,
  cacheDeleteWhere,
  isExpiredCache,
  isStaleUsage,
  usageDeleteWhere,
  utcMonthStart,
} from "@/lib/ai/retention";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const HOUR = 3_600_000;

function deletedByUsageWhere(row: { feature: string; outcome: string; createdAt: Date }, now: Date): boolean {
  const where = usageDeleteWhere(now);
  const cutoff = where.AND[0].createdAt.lt;
  const kept = where.AND[1].NOT;
  const regenKept = row.feature === kept.feature && row.outcome === kept.outcome && row.createdAt >= kept.createdAt.gte;
  return row.createdAt < cutoff && !regenKept;
}

function deletedByCacheWhere(row: { createdAt: Date; expiresAt: Date }, now: Date, ttlHours: number): boolean {
  const where = cacheDeleteWhere(now, ttlHours);
  const expiredAt = where.OR[0].expiresAt.lte;
  const createdBefore = where.OR[1].createdAt.lt;
  return row.expiresAt <= expiredAt || row.createdAt < createdBefore;
}

describe("AI retention windows", () => {
  it("keeps 48h of usage and this month's successful learn_regen rows", () => {
    const rows = [
      { feature: "cv_tips", outcome: "ok", createdAt: new Date(NOW.getTime() - 24 * HOUR) },
      { feature: "cv_tips", outcome: "ok", createdAt: new Date(NOW.getTime() - AI_USAGE_KEEP_MS) },
      { feature: "study_plan", outcome: "ok", createdAt: new Date(NOW.getTime() - AI_USAGE_KEEP_MS - 1) },
      { feature: "learn_regen", outcome: "error", createdAt: new Date("2026-11-01T00:00:00.000Z") },
      { feature: "learn_regen", outcome: "ok", createdAt: new Date("2026-11-01T00:00:00.000Z") },
      { feature: "learn_regen", outcome: "ok", createdAt: new Date("2026-10-31T23:00:00.000Z") },
      { feature: "tutor_chat", outcome: "cached", createdAt: new Date(NOW.getTime() - 3 * 24 * HOUR) },
    ];
    expect(rows.map((r) => isStaleUsage(r, NOW))).toEqual([false, false, true, true, false, true, true]);
    for (const row of rows) expect(deletedByUsageWhere(row, NOW)).toBe(isStaleUsage(row, NOW));
    expect(utcMonthStart(NOW).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(usageDeleteWhere(NOW).AND[0].createdAt.lt.toISOString()).toBe(
      new Date(NOW.getTime() - AI_USAGE_KEEP_MS).toISOString(),
    );
  });

  it("drops cache rows past their expiry or past the current TTL", () => {
    const ttlHours = 24;
    const rows = [
      { createdAt: new Date(NOW.getTime() - HOUR), expiresAt: new Date(NOW.getTime() - 1) },
      { createdAt: new Date(NOW.getTime() - HOUR), expiresAt: NOW },
      { createdAt: new Date(NOW.getTime() - 48 * HOUR), expiresAt: new Date(NOW.getTime() + 10 * 24 * HOUR) },
      { createdAt: new Date(NOW.getTime() - 23 * HOUR), expiresAt: new Date(NOW.getTime() + HOUR) },
      { createdAt: new Date(NOW.getTime() - 24 * HOUR), expiresAt: new Date(NOW.getTime() + HOUR) },
    ];
    expect(rows.map((r) => isExpiredCache(r, NOW, ttlHours))).toEqual([true, true, true, false, false]);
    for (const row of rows) expect(deletedByCacheWhere(row, NOW, ttlHours)).toBe(isExpiredCache(row, NOW, ttlHours));
  });
});
