import { db } from "@/lib/db";
import { geocodeJob, geoSourceKey } from "./geocode";

export interface GeocodeRunResult {
  scanned: number;
  updated: number;
  /** Active jobs with coordinates after the run, and all active jobs. */
  withGeo: number;
  active: number;
}

/**
 * (Re)geocode active jobs whose location, company HQ or office override changed since the last run
 * (`all` = every active job). Offline (gazetteer + curated hubs), so it is cheap enough to run after
 * every ingest. Jobs sharing the same inputs are written in one updateMany.
 */
export async function geocodeJobs(options: { all?: boolean } = {}): Promise<GeocodeRunResult> {
  const jobs = await db.job.findMany({
    where: { isActive: true },
    select: {
      id: true,
      location: true,
      geoSource: true,
      company: {
        select: { id: true, hqLocation: true, officeAddress: true, officeLat: true, officeLng: true, officeCity: true },
      },
    },
  });
  const groups = new Map<string, { ids: string[]; location: string; company: (typeof jobs)[number]["company"] }>();
  for (const j of jobs) {
    const source = geoSourceKey(j.location, j.company);
    if (!options.all && j.geoSource === source) continue;
    const key = `${j.company.id}\u0000${source}`;
    const g = groups.get(key);
    if (g) g.ids.push(j.id);
    else groups.set(key, { ids: [j.id], location: j.location, company: j.company });
  }
  let updated = 0;
  const now = new Date();
  for (const g of groups.values()) {
    const geo = geocodeJob(g.location, g.company);
    const first = geo.places[0];
    const res = await db.job.updateMany({
      where: { id: { in: g.ids } },
      data: {
        geoLat: first?.lat ?? null,
        geoLng: first?.lng ?? null,
        geoPlaces: geo.places.map((p) => p.key),
        geoPrecision: geo.precision,
        geoSource: geoSourceKey(g.location, g.company),
        geocodedAt: now,
      },
    });
    updated += res.count;
  }
  const [withGeo, active] = await Promise.all([
    db.job.count({ where: { isActive: true, geoLat: { not: null } } }),
    db.job.count({ where: { isActive: true } }),
  ]);
  return { scanned: jobs.length, updated, withGeo, active };
}
