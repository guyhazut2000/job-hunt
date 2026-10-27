import { createHash } from "node:crypto";
import type { PeopleSearchConfig } from "./config";

export type LimitStatus = "rate_limited" | "daily_cap" | "quota";

export interface UsageCounts {
  /** All requests by this user in the last minute (cached or not). */
  lastMinute: number;
  /** Uncached (billed) requests by this user in the last 24h. */
  lastDayUncached: number;
  /** Uncached requests by everyone in the last 30 days (protects the monthly Brave budget). */
  lastMonthUncached: number;
}

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const MONTH = 30 * DAY;

/** Per-minute limit applies to every request; daily/monthly caps only to ones that would hit Brave. */
export function checkLimits(
  c: UsageCounts,
  cfg: Pick<PeopleSearchConfig, "perMinute" | "dailyCap" | "monthlyCap">,
  needsApi: boolean,
): LimitStatus | null {
  if (c.lastMinute >= cfg.perMinute) return "rate_limited";
  if (!needsApi) return null;
  if (c.lastDayUncached >= cfg.dailyCap) return "daily_cap";
  if (c.lastMonthUncached >= cfg.monthlyCap) return "quota";
  return null;
}

export function queryHash(query: string, page: number): string {
  return createHash("sha256").update(`${page}\n${query.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export function isFresh(entry: { expiresAt: Date } | null | undefined, now = new Date()): boolean {
  return !!entry && entry.expiresAt.getTime() > now.getTime();
}

export function expiryFrom(now: Date, ttlHours: number): Date {
  return new Date(now.getTime() + ttlHours * 3_600_000);
}
