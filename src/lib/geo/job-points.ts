import { type CompanyGeo, type GeoPlace, officePlace, placeByKey } from "./geocode";

/** Fields needed to place a job on the map (`geoPlaces` is written by the geocode backfill). */
export interface JobPointInput {
  geoPlaces: string[];
  geoPrecision: string | null;
  company: CompanyGeo;
}

/** Resolve a job's stored place keys to points (company office keys use the live office override). */
export function jobPoints(j: JobPointInput): GeoPlace[] {
  const out: GeoPlace[] = [];
  for (const key of j.geoPlaces) {
    const p = key.startsWith("co:") ? officePlace(j.company) : placeByKey(key);
    if (!p) continue;
    out.push(j.geoPrecision === "hq" ? { ...p, precision: "hq" } : p);
  }
  return out;
}

/** Selects the company fields `jobPoints` needs. */
export const companyGeoSelect = {
  id: true,
  hqLocation: true,
  officeAddress: true,
  officeLat: true,
  officeLng: true,
  officeCity: true,
} as const;
