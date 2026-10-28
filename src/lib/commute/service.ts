import { db } from "@/lib/db";
import { estimateCommute } from "./estimate";
import {
  departureKey,
  destKey,
  MODES,
  nextDeparture,
  roundOrigin,
  trafficFactor,
  type CommuteMode,
  type Departure,
  type LatLng,
} from "./keys";
import { transitous } from "./transitous";
import type { CommuteProvider, CommuteResult, CommuteValue } from "./types";

/**
 * Commute times from one origin to many job points, per mode, for a departure bucket.
 *
 * - The origin is snapped to a ~200 m grid first (privacy; also lets nearby users share cache rows).
 * - Cached in CommuteCache by (originKey, destKey, mode, bucket): 30 days for car, 7 for transit
 *   (timetables change). No-route results are cached too.
 * - Misses go to the provider as one matrix request per mode (≤ batchSize points each), within a
 *   global daily cap (TRANSITOUS_DAILY_CAP, default 500 — Transitous asks to talk to them above ~720).
 * - Any failure or exhausted budget degrades to a labelled distance estimate, never an error.
 */

const PROVIDER: CommuteProvider = transitous;
const TTL_DAYS: Record<CommuteMode, number> = { car: 30, bus: 7, train: 7 };
const DAILY_CAP = Number(process.env.TRANSITOUS_DAILY_CAP || 500);
const DISABLED = process.env.COMMUTE_PROVIDER === "estimate";

export interface CommuteQuery {
  origin: LatLng;
  dests: LatLng[];
  modes?: readonly CommuteMode[];
  departure: Departure;
  /** Max provider requests this call may make (keeps one page view from burning the budget). */
  maxCalls?: number;
}

export interface CommuteBatch {
  /** destKey -> per-mode values. */
  times: Map<string, CommuteResult>;
  origin: LatLng & { key: string };
  bucket: string;
  /** True when at least one value is a fallback estimate. */
  estimated: boolean;
}

async function callsToday(): Promise<number> {
  return db.geoProviderCall.count({
    where: { provider: PROVIDER.name, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
  });
}

function withTraffic(mode: CommuteMode, v: { seconds: number | null; transfers?: number | null }, dep: Departure) {
  const out: CommuteValue = { seconds: v.seconds, source: "transitous" };
  if (v.transfers != null) out.transfers = v.transfers;
  if (mode === "car" && v.seconds != null) out.peakSeconds = Math.round(v.seconds * trafficFactor(dep));
  return out;
}

export async function getCommuteTimes(q: CommuteQuery): Promise<CommuteBatch> {
  const origin = roundOrigin(q.origin);
  const bucket = departureKey(q.departure);
  const modes = q.modes ?? MODES;
  const uniq = new Map<string, LatLng>();
  for (const d of q.dests) uniq.set(destKey(d), d);
  const keys = [...uniq.keys()];
  const times = new Map<string, CommuteResult>(keys.map((k) => [k, {}]));
  let estimated = false;
  if (!keys.length) return { times, origin, bucket, estimated };

  const cached = await db.commuteCache.findMany({
    where: {
      originKey: origin.key,
      timeBucket: bucket,
      mode: { in: [...modes] },
      destKey: { in: keys },
      expiresAt: { gt: new Date() },
    },
  });
  for (const c of cached) {
    const mode = c.mode as CommuteMode;
    const r = times.get(c.destKey);
    if (r) r[mode] = withTraffic(mode, c, q.departure);
  }

  let budget = q.maxCalls ?? 3;
  let remainingToday = DISABLED ? 0 : Math.max(0, DAILY_CAP - (await callsToday()));
  const at = nextDeparture(q.departure);
  // Plan every request up front (budget is decided synchronously), then run them in parallel so a
  // page waits for the slowest mode, not the sum of all three.
  const jobs: { mode: CommuteMode; chunk: string[]; call: boolean }[] = [];
  for (const mode of modes) {
    const missing = keys.filter((k) => !times.get(k)![mode]);
    for (let i = 0; i < missing.length; i += PROVIDER.batchSize) {
      const call = budget > 0 && remainingToday > 0;
      if (call) {
        budget--;
        remainingToday--;
      }
      jobs.push({ mode, chunk: missing.slice(i, i + PROVIDER.batchSize), call });
    }
  }
  await Promise.all(
    jobs.map(async ({ mode, chunk, call }) => {
      let results: { seconds: number | null; transfers?: number }[] | null = null;
      if (call) {
        try {
          results = await PROVIDER.matrix(
            origin,
            chunk.map((k) => uniq.get(k)!),
            mode,
            { at, bucket: q.departure },
          );
          await db.geoProviderCall.create({ data: { provider: PROVIDER.name, kind: mode, ok: true } });
        } catch (e) {
          console.warn("commute provider failed", mode, e instanceof Error ? e.message : e);
          await db.geoProviderCall.create({ data: { provider: PROVIDER.name, kind: mode, ok: false } }).catch(() => {});
          results = null;
        }
      }
      if (results) {
        const expiresAt = new Date(Date.now() + TTL_DAYS[mode] * 86400_000);
        const rows = chunk.map((k, j) => {
          const v = results![j];
          times.get(k)![mode] = withTraffic(mode, v, q.departure);
          return {
            originKey: origin.key,
            destKey: k,
            mode,
            timeBucket: bucket,
            seconds: v.seconds,
            transfers: v.transfers ?? null,
            provider: PROVIDER.name,
            expiresAt,
          };
        });
        // Replace expired rows for these keys, then insert (one round trip each, not one per point).
        try {
          await db.commuteCache.deleteMany({
            where: { originKey: origin.key, timeBucket: bucket, mode, destKey: { in: chunk } },
          });
          await db.commuteCache.createMany({ data: rows, skipDuplicates: true });
        } catch (e) {
          console.warn("commute cache write failed", e instanceof Error ? e.message : e);
        }
      } else {
        estimated = true;
        for (const k of chunk) times.get(k)![mode] = estimateCommute(origin, uniq.get(k)!, mode, q.departure);
      }
    }),
  );
  return { times, origin, bucket, estimated };
}

export { bestSeconds } from "./best";
