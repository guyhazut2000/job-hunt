import type { WorkMode } from "@prisma/client";
import { haversineKm } from "../commute/estimate";
import { parseLocation } from "../geo/geocode";

/** Commute criterion (#109). Kept apart from criteria.ts so the gazetteer never reaches client bundles. */
export interface Point {
  lat: number;
  lng: number;
}

/** The user's home point from the profile's free-text city (Hebrew or English, offline gazetteer); null = unknown. */
export function homePoint(city: string | null | undefined): Point | null {
  const p = parseLocation(city)[0];
  return p ? { lat: p.lat, lng: p.lng } : null;
}

/** Every point a job may be at: its geocoded pin plus each city its location text mentions. */
export function jobPointsOf(job: { location: string; geoLat?: number | null; geoLng?: number | null }): Point[] {
  const pts: Point[] = parseLocation(job.location).map((p) => ({ lat: p.lat, lng: p.lng }));
  if (job.geoLat != null && job.geoLng != null) pts.push({ lat: job.geoLat, lng: job.geoLng });
  return pts;
}

/** Straight-line km under which a commute counts as fully short, and above which it scores 0. */
export const COMMUTE_NEAR_KM = 10;
export const COMMUTE_FAR_KM = 80;

/**
 * Commute (#109): straight-line distance home → nearest job location (approximate, city level).
 * Remote = 100; ≤10km = 100, linear to 0 at 80km; hybrid halves the penalty (fewer office days).
 * Null (skipped, never penalized) when the home city or the job location is unknown.
 */
export function commuteValue(
  home: Point | null,
  job: { location: string; workMode: WorkMode; geoLat?: number | null; geoLng?: number | null },
): number | null {
  if (!home) return null;
  if (job.workMode === "REMOTE") return 100;
  const pts = jobPointsOf(job);
  if (!pts.length) return null;
  const km = Math.min(...pts.map((p) => haversineKm(home, p)));
  const span = COMMUTE_FAR_KM - COMMUTE_NEAR_KM;
  const base = Math.max(0, Math.min(100, 100 - ((km - COMMUTE_NEAR_KM) / span) * 100));
  return Math.round(job.workMode === "HYBRID" ? 100 - (100 - base) / 2 : base);
}
