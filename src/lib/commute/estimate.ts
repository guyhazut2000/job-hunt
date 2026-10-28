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
 * Rough fallback when no routing provider answers: road distance ≈ 1.3 × straight line, average
 * door-to-door speeds of ~50 km/h by car, ~20 km/h by bus and ~30 km/h by train (incl. access and
 * waiting). Always labelled "estimate" in the UI.
 */
export function estimateCommute(origin: LatLng, dest: LatLng, mode: CommuteMode, dep: Departure): CommuteValue {
  const km = haversineKm(origin, dest) * 1.3;
  const speeds: Record<CommuteMode, number> = { car: 50, bus: 20, train: 30 };
  const fixed: Record<CommuteMode, number> = { car: 5, bus: 12, train: 20 };
  const seconds = Math.round((km / speeds[mode]) * 3600 + fixed[mode] * 60);
  if (mode === "car") return { seconds, peakSeconds: Math.round(seconds * trafficFactor(dep)), source: "estimate" };
  return { seconds, source: "estimate" };
}
