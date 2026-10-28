import type { WorkMode } from "@prisma/client";
import type { CommuteResult } from "@/lib/commute/types";
import type { GeoPrecision } from "./geocode";
import { type JobPointInput, jobPoints } from "./job-points";

export interface MapJob {
  id: string;
  title: string;
  score?: number;
  workMode: WorkMode;
}

/** One map marker = one company at one place (office override, tech hub, or city). */
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Routing destination (un-jittered place point). */
  dest: { lat: number; lng: number };
  company: { name: string; slug: string };
  place: string;
  precision: GeoPrecision;
  jobs: MapJob[];
  commute?: CommuteResult;
}

export interface MarkerRow extends JobPointInput {
  id: string;
  title: string;
  workMode: WorkMode;
  company: JobPointInput["company"] & { name: string; slug: string };
}

/** Small deterministic offset so companies sharing a hub/city point don't stack at full zoom. */
export function jitter(seed: string): { dLat: number; dLng: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const a = ((h >>> 0) % 3600) / 3600;
  const r = 0.0015 + (((h >>> 12) % 1000) / 1000) * 0.0035; // ~150–550 m
  return { dLat: r * Math.sin(a * 2 * Math.PI), dLng: r * Math.cos(a * 2 * Math.PI) * 1.18 };
}

/**
 * Group jobs into company×place markers. Remote jobs are excluded (counted); hybrid and on-site
 * jobs are shown at every place they list. Jobs with no known point are counted as unmapped.
 */
export function buildMarkers(rows: MarkerRow[], locale: "en" | "he", scores?: Map<string, number>) {
  const markers = new Map<string, MapMarker>();
  let remote = 0;
  let unmapped = 0;
  for (const r of rows) {
    if (r.workMode === "REMOTE") {
      remote++;
      continue;
    }
    const points = jobPoints(r);
    if (!points.length) {
      unmapped++;
      continue;
    }
    const job: MapJob = { id: r.id, title: r.title, workMode: r.workMode, score: scores?.get(r.id) };
    for (const p of points) {
      const id = `${r.company.id}|${p.key}`;
      let m = markers.get(id);
      if (!m) {
        const j = p.precision === "office" ? { dLat: 0, dLng: 0 } : jitter(id);
        m = {
          id,
          lat: Number((p.lat + j.dLat).toFixed(5)),
          lng: Number((p.lng + j.dLng).toFixed(5)),
          dest: { lat: p.lat, lng: p.lng },
          company: { name: r.company.name, slug: r.company.slug },
          place: locale === "he" ? p.he : p.label,
          precision: p.precision,
          jobs: [],
        };
        markers.set(id, m);
      }
      m.jobs.push(job);
    }
  }
  const list = [...markers.values()];
  for (const m of list) m.jobs.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title));
  return { markers: list, remote, unmapped };
}
