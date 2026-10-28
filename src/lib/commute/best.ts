import type { CommuteMode } from "./keys";
import type { CommuteResult } from "./types";

/** Shortest seconds for one mode, or across modes when mode is omitted. */
export function bestSeconds(r: CommuteResult | undefined, mode?: CommuteMode): number | null {
  if (!r) return null;
  const vals = (mode ? [r[mode]] : Object.values(r)).map((v) => v?.seconds).filter((s): s is number => s != null);
  return vals.length ? Math.min(...vals) : null;
}
