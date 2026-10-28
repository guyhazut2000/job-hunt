import type { CommuteMode, Departure, LatLng } from "./keys";

export interface CommuteValue {
  /** Door-to-door seconds (car: free-flow). null = no route and no estimate possible. */
  seconds: number | null;
  /** Car only: upper end of the range with typical traffic for the departure bucket. */
  peakSeconds?: number;
  transfers?: number;
  /** "transitous" = routed; "estimate" = distance-based fallback. */
  source: "transitous" | "estimate";
  /**
   * Why a value is an estimate: "unavailable" = provider down / over the daily budget;
   * "no-route" = the router found no timetable route (e.g. no service near the origin in the
   * search window). Shown differently in the UI; never presented as "unreachable".
   */
  estimateReason?: "unavailable" | "no-route";
}

export type CommuteResult = Partial<Record<CommuteMode, CommuteValue>>;

/** One leg of a public-transport itinerary (consecutive walks merged). */
export interface TransitLeg {
  kind: "walk" | "bus" | "rail" | "light_rail" | "subway" | "other";
  /** Line number / short name when meaningful (buses, light rail). */
  line?: string;
  seconds: number;
}

/** A concrete public-transport itinerary (from Transitous /plan), for the leg breakdown. */
export interface TransitRoute {
  /** Travel time from leaving the origin to arriving (excludes waiting at home). */
  seconds: number;
  transfers: number;
  walkSeconds: number;
  /** ISO instants. */
  departAt: string;
  arriveAt: string;
  legs: TransitLeg[];
}

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
  /** One concrete public-transport itinerary with legs, or null when there is none. */
  route?(origin: LatLng, dest: LatLng, at: Date): Promise<TransitRoute | null>;
  /** Max destinations per request. */
  batchSize: number;
}
