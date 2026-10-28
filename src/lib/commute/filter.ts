import type { CommuteMode } from "./keys";
import { bestSeconds } from "./best";
import type { CommuteResult } from "./types";

/**
 * Commute filter/sort over jobs that may sit at several places (multi-city postings): a job's
 * commute is its fastest place. Jobs without a point (remote / unknown) have no commute: they are
 * dropped by a max-commute filter and sorted last.
 */
export function jobCommuteSeconds(
  placeKeys: string[],
  times: Map<string, CommuteResult>,
  mode?: CommuteMode,
): number | null {
  let best: number | null = null;
  for (const k of placeKeys) {
    const s = bestSeconds(times.get(k), mode);
    if (s != null && (best == null || s < best)) best = s;
  }
  return best;
}

export function filterByCommute<T>(items: T[], secondsOf: (item: T) => number | null, maxMinutes: number | null): T[] {
  if (!maxMinutes) return items;
  return items.filter((i) => {
    const s = secondsOf(i);
    return s != null && s <= maxMinutes * 60;
  });
}

export function sortByCommute<T>(items: T[], secondsOf: (item: T) => number | null): T[] {
  return items
    .map((item, idx) => ({ item, idx, s: secondsOf(item) }))
    .sort((a, b) => (a.s ?? Infinity) - (b.s ?? Infinity) || a.idx - b.idx)
    .map((x) => x.item);
}

/** Allowed max-commute values for the filter (minutes). */
export const MAX_COMMUTE_OPTIONS = [20, 30, 45, 60, 90] as const;
