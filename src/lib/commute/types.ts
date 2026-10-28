import type { CommuteMode, Departure, LatLng } from "./keys";

export interface CommuteValue {
  /** Door-to-door seconds (car: free-flow). null = no route found. */
  seconds: number | null;
  /** Car only: upper end of the range with typical traffic for the departure bucket. */
  peakSeconds?: number;
  transfers?: number;
  /** "transitous" = routed; "estimate" = distance-based fallback (provider down / over budget). */
  source: "transitous" | "estimate";
}

export type CommuteResult = Partial<Record<CommuteMode, CommuteValue>>;

/** A routing backend (pluggable: Transitous today; ORS, Google Routes or a self-hosted OTP later). */
export interface CommuteProvider {
  name: string;
  /** One origin to many destinations for one mode. Returns seconds|null per destination, same order. */
  matrix(
    origin: LatLng,
    dests: LatLng[],
    mode: CommuteMode,
    departure: { at: Date; bucket: Departure },
  ): Promise<{ seconds: number | null; transfers?: number }[]>;
  /** Max destinations per request. */
  batchSize: number;
}
