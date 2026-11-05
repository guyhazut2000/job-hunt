/**
 * How long AI rows must stay so the guards can still count them.
 * The rolling windows are 1 minute and 24h (src/lib/ai/guard.ts); 48h keeps a full day plus slack.
 * Successful `learn_regen` rows are also counted for the current UTC month (src/lib/learning/hub.ts).
 */

/** Keep ordinary AiUsage rows this long (rolling day + slack). */
export const AI_USAGE_KEEP_MS = 48 * 60 * 60 * 1000;

/** UTC calendar-month start. `monthStart` in the learning hub returns this same instant. */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function isExpiredCache(row: { createdAt: Date; expiresAt: Date }, now: Date, ttlHours: number): boolean {
  if (row.expiresAt.getTime() <= now.getTime()) return true;
  const ttlMs = Math.max(0, ttlHours) * 3_600_000;
  return row.createdAt.getTime() < now.getTime() - ttlMs;
}

/**
 * True when an AiUsage row is past every window that still reads it.
 * `learn_regen` + `ok` rows from the current UTC month stay, so the monthly regeneration cap
 * still sees them after the 48h rolling window has moved on.
 */
export function isStaleUsage(
  row: { feature: string; outcome: string; createdAt: Date },
  now: Date,
  usageKeepMs = AI_USAGE_KEEP_MS,
): boolean {
  if (now.getTime() - row.createdAt.getTime() <= usageKeepMs) return false;
  if (
    row.feature === "learn_regen" &&
    row.outcome === "ok" &&
    row.createdAt.getTime() >= utcMonthStart(now).getTime()
  ) {
    return false;
  }
  return true;
}

export interface CacheDeleteWhere {
  OR: [{ expiresAt: { lte: Date } }, { createdAt: { lt: Date } }];
}

export interface UsageDeleteWhere {
  AND: [{ createdAt: { lt: Date } }, { NOT: { feature: "learn_regen"; outcome: "ok"; createdAt: { gte: Date } } }];
}

/** Prisma `where` for AiCache. Matches `isExpiredCache` (expired TTL, or older than the current TTL). */
export function cacheDeleteWhere(now: Date, ttlHours: number): CacheDeleteWhere {
  return {
    OR: [
      { expiresAt: { lte: now } },
      { createdAt: { lt: new Date(now.getTime() - Math.max(0, ttlHours) * 3_600_000) } },
    ],
  };
}

/** Prisma `where` for AiUsage. Matches `isStaleUsage`. */
export function usageDeleteWhere(now: Date, usageKeepMs = AI_USAGE_KEEP_MS): UsageDeleteWhere {
  return {
    AND: [
      { createdAt: { lt: new Date(now.getTime() - usageKeepMs) } },
      {
        NOT: {
          feature: "learn_regen",
          outcome: "ok",
          createdAt: { gte: utcMonthStart(now) },
        },
      },
    ],
  };
}
