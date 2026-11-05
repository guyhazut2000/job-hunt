import { db } from "@/lib/db";
import { aiConfig } from "./config";
import { cacheDeleteWhere, usageDeleteWhere } from "./retention";

/**
 * Daily housekeeping for the AI tables. Deletes expired cache rows (their own `expiresAt`, and
 * anything older than the current `AI_CACHE_TTL_HOURS`) and usage rows the rolling windows no
 * longer read. See `retention.ts`.
 */
export async function purgeExpiredAiRows(now = new Date(), ttlHours = aiConfig().cacheTtlHours) {
  const [cache, usage] = await Promise.all([
    db.aiCache.deleteMany({ where: cacheDeleteWhere(now, ttlHours) }),
    db.aiUsage.deleteMany({ where: usageDeleteWhere(now) }),
  ]);
  return { cache: cache.count, usage: usage.count };
}
