/**
 * Tiny in-memory sliding-window limiter (per server instance). Used for upload-token issuance; the
 * durable per-hour limit is enforced from the DB in finalize (see quotaState).
 */
const hits = new Map<string, number[]>();

export function takeToken(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
