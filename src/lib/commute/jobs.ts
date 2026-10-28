import type { GeoPlace } from "@/lib/geo/geocode";
import { type JobPointInput, jobPoints } from "@/lib/geo/job-points";
import { bestSeconds } from "./best";
import { type CommuteMode, type Departure, type LatLng, MODES, destKey } from "./keys";
import { getCommuteTimes } from "./service";
import type { CommuteResult } from "./types";

/**
 * Per-mode best value over several places (a multi-city job's commute is its closest office).
 * A routed value beats a distance estimate; otherwise the faster one wins.
 */
export function mergeBest(results: (CommuteResult | undefined)[]): CommuteResult {
  const out: CommuteResult = {};
  for (const mode of MODES) {
    for (const r of results) {
      const v = r?.[mode];
      if (!v) continue;
      const cur = out[mode];
      const routed = (x: typeof v) => x.source === "transitous" && x.seconds != null;
      if (!cur || (routed(v) && !routed(cur))) out[mode] = v;
      else if (routed(v) === routed(cur) && v.seconds != null && (cur.seconds == null || v.seconds < cur.seconds))
        out[mode] = v;
    }
  }
  return out;
}

export interface JobCommute {
  points: GeoPlace[];
  commute: CommuteResult;
}

/**
 * Commute for a set of jobs from one origin: resolves every job's points, asks the commute service
 * once for all distinct points (cached + batched), and folds the result back per job.
 */
export async function commuteForJobs<T extends JobPointInput & { id: string }>(
  jobs: T[],
  opts: { origin: LatLng; departure: Departure; modes?: readonly CommuteMode[]; maxCalls?: number },
) {
  const points = new Map<string, GeoPlace[]>();
  const dests: LatLng[] = [];
  for (const j of jobs) {
    const ps = jobPoints(j);
    points.set(j.id, ps);
    dests.push(...ps);
  }
  const batch = await getCommuteTimes({ ...opts, dests });
  const byJob = new Map<string, JobCommute>();
  for (const j of jobs) {
    const ps = points.get(j.id) ?? [];
    byJob.set(j.id, { points: ps, commute: mergeBest(ps.map((p) => batch.times.get(destKey(p)))) });
  }
  return { byJob, batch };
}

/** Seconds used by the commute filter/sort: the chosen mode, or the fastest mode. */
export const commuteSeconds = (c: JobCommute | undefined, mode?: CommuteMode) => bestSeconds(c?.commute, mode);
