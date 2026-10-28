import { trafficFactor, type CommuteMode, type Departure, type LatLng } from "./keys";
import type { CommuteValue } from "./types";

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rough fallback when routing can't answer: road distance ≈ 1.3 × straight line, average
 * door-to-door speeds of ~50 km/h by car and ~22 km/h by public transport (bus + train mix,
 * incl. walking, waiting and transfers). Always labelled "estimate" in the UI.
 */
export function estimateCommute(
  origin: LatLng,
  dest: LatLng,
  mode: CommuteMode,
  dep: Departure,
  reason: NonNullable<CommuteValue["estimateReason"]> = "unavailable",
): CommuteValue {
  const km = haversineKm(origin, dest) * 1.3;
  const speeds: Record<CommuteMode, number> = { car: 50, transit: 22 };
  const fixed: Record<CommuteMode, number> = { car: 5, transit: 15 };
  const seconds = Math.round((km / speeds[mode]) * 3600 + fixed[mode] * 60);
  const base: CommuteValue = { seconds, source: "estimate", estimateReason: reason };
  if (mode === "car") base.peakSeconds = Math.round(seconds * trafficFactor(dep));
  return base;
}
