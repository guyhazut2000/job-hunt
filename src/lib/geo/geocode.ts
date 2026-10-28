import { CITIES } from "@/lib/ingestion/location";
import gazetteer from "./il-places.json";
import { HUB_ALIASES, HUB_BY_KEY, HUB_BY_LABEL } from "./places";
import { normText } from "./text";

/**
 * Offline geocoding for job locations. ATS boards give city-level text ("Tel Aviv / Yokneam",
 * "Herzliya, Israel", "רמת גן"), so this resolves each city to a curated hub point, else a GeoNames
 * centroid. No network calls: safe to run for every job during ingest.
 */

export type GeoPrecision = "office" | "hub" | "city" | "hq";

export interface GeoPlace {
  key: string;
  label: string;
  he: string;
  lat: number;
  lng: number;
  precision: GeoPrecision;
  area?: { en: string; he: string };
}

interface GazetteerRow {
  n: string;
  he: string | null;
  lat: number;
  lng: number;
  pop: number;
  x: number;
  a: string[];
}

const ROWS = gazetteer as GazetteerRow[];
const slug = (s: string) => normText(s).replace(/'/g, "").replace(/\s+/g, "-");

/** alias -> best row (rows are sorted by population, so the first wins). Neighbourhoods rank last. */
const ALIAS_INDEX = (() => {
  const m = new Map<string, GazetteerRow>();
  for (const pass of [0, 1]) for (const r of ROWS) if (r.x === pass) for (const a of r.a) if (!m.has(a)) m.set(a, r);
  return m;
})();
/**
 * Loose Latin transliteration key: Hebrew place names have many romanizations ("Beit Yanai",
 * "Bet Yannay"; "Kiryat"/"Qiryat"; "Tzur"/"Tsur"), so compare on a squashed form too.
 */
export function fuzzKey(s: string): string {
  return normText(s)
    .replace(/'/g, "")
    .replace(/\bbeit\b/g, "bet")
    .replace(/\bkfar\b/g, "kefar")
    .replace(/q/g, "k")
    .replace(/t[sz]/g, "z")
    .replace(/[ck]h/g, "h")
    .replace(/ei|ey/g, "e")
    .replace(/y/g, "i")
    .replace(/h\b/g, "")
    .replace(/([a-z])\1+/g, "$1");
}

const FUZZ_INDEX = (() => {
  const m = new Map<string, GazetteerRow>();
  for (const pass of [0, 1])
    for (const r of ROWS)
      if (r.x === pass)
        for (const a of r.a) {
          if (!/^[a-z' ]+$/.test(a)) continue;
          const k = fuzzKey(a);
          if (k.length >= 4 && !m.has(k)) m.set(k, r);
        }
  return m;
})();

const ROW_BY_KEY = new Map<string, GazetteerRow>(ROWS.map((r) => [`gn:${slug(r.n)}`, r]));

function hubPlace(key: string): GeoPlace | null {
  const h = HUB_BY_KEY.get(key);
  return h ? { key: h.key, label: h.label, he: h.he, lat: h.lat, lng: h.lng, precision: "hub", area: h.area } : null;
}

function rowPlace(r: GazetteerRow): GeoPlace {
  return { key: `gn:${slug(r.n)}`, label: r.n, he: r.he ?? r.n, lat: r.lat, lng: r.lng, precision: "city" };
}

/** Resolve a place key stored on a job (hub:* or gn:*) back to its point. */
export function placeByKey(key: string): GeoPlace | null {
  if (key.startsWith("hub:")) return hubPlace(key);
  const r = ROW_BY_KEY.get(key);
  return r ? rowPlace(r) : null;
}

const GENERIC = new Set([
  "israel",
  "ישראל",
  "remote",
  "hybrid",
  "office",
  "onsite",
  "on site",
  "il",
  "isr",
  "district",
  "center",
  "central",
  "north",
  "south",
  "home",
  "anywhere",
  "מרכז",
  "צפון",
  "דרום",
  "מחוז",
]);

/** Longest gazetteer alias inside one segment (whole words only). */
function gazetteerMatch(segment: string): GazetteerRow | null {
  const s = normText(segment);
  if (!s || GENERIC.has(s)) return null;
  const exact = ALIAS_INDEX.get(s) ?? FUZZ_INDEX.get(fuzzKey(s));
  if (exact) return exact;
  const words = s.split(" ");
  // Try the longest word windows first; short single words must be 4+ letters to avoid noise.
  for (let len = Math.min(words.length, 4); len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const w = words.slice(i, i + len).join(" ");
      if (GENERIC.has(w) || (len === 1 && w.length < 4)) continue;
      const row = ALIAS_INDEX.get(w) ?? FUZZ_INDEX.get(fuzzKey(w));
      if (row) return row;
    }
  }
  return null;
}

/**
 * All places a location string mentions, in order, deduped. Known cities resolve to their hub;
 * unknown names go through the gazetteer. Returns [] for "Israel", "Remote" and unrecognised text.
 */
export function parseLocation(location: string | null | undefined): GeoPlace[] {
  if (!location?.trim()) return [];
  const out: GeoPlace[] = [];
  const add = (p: GeoPlace | null) => {
    if (p && !out.some((o) => o.key === p.key)) out.push(p);
  };
  const segments = location.split(/\s*(?:\/|;|\||,|\n|·| - | – )\s*/).filter(Boolean);
  for (const seg of segments) {
    const n = normText(seg);
    if (!n || GENERIC.has(n)) continue;
    const alias = HUB_ALIASES[n];
    if (alias) {
      add(hubPlace(alias));
      continue;
    }
    // Known Israeli cities (same regexes as ingestion), in order of appearance within the segment.
    const cities = CITIES.map(([label, re]) => ({ label, idx: seg.search(re) }))
      .filter((c) => c.idx >= 0)
      .sort((a, b) => a.idx - b.idx);
    if (cities.length) {
      for (const c of cities) {
        const h = HUB_BY_LABEL.get(c.label);
        if (h) add(hubPlace(h.key));
      }
      continue;
    }
    const aliasHit = Object.entries(HUB_ALIASES).find(([a]) => new RegExp(`(^| )${a}( |$)`).test(n));
    if (aliasHit) {
      add(hubPlace(aliasHit[1]));
      continue;
    }
    const row = gazetteerMatch(seg);
    if (row) add(rowPlace(row));
  }
  return out;
}

export interface CompanyGeo {
  id: string;
  hqLocation?: string | null;
  officeLat?: number | null;
  officeLng?: number | null;
  officeAddress?: string | null;
  /** Canonical city the office override applies to (null = all of the company's jobs). */
  officeCity?: string | null;
}

export interface JobGeo {
  places: GeoPlace[];
  /** Precision of the primary (first) place. */
  precision: GeoPrecision | null;
}

/** Office override as a place. */
export function officePlace(c: CompanyGeo): GeoPlace | null {
  if (c.officeLat == null || c.officeLng == null) return null;
  return {
    key: `co:${c.id}`,
    label: c.officeAddress || c.officeCity || "Office",
    he: c.officeAddress || c.officeCity || "משרד",
    lat: c.officeLat,
    lng: c.officeLng,
    precision: "office",
  };
}

/**
 * Geocode one job: its location text, refined by the company's office override, falling back to
 * the company HQ for country-only locations ("Israel"). Remote jobs still get places (they are just
 * not drawn on the map).
 */
export function geocodeJob(location: string | null | undefined, company?: CompanyGeo | null): JobGeo {
  let places = parseLocation(location);
  const office = company ? officePlace(company) : null;
  if (office) {
    const city = company?.officeCity ? HUB_BY_LABEL.get(company.officeCity)?.key : null;
    if (!places.length) places = [office];
    else if (!city) places = [office, ...places.slice(1)];
    else places = places.map((p) => (p.key === city ? office : p));
  }
  if (!places.length && company?.hqLocation) {
    places = parseLocation(company.hqLocation).map((p) => ({ ...p, precision: "hq" as const }));
  }
  return { places, precision: places[0]?.precision ?? null };
}

/** Kept for the backfill: true when the stored geo was computed from a different location string. */
export function geoSourceKey(location: string | null | undefined, company?: CompanyGeo | null): string {
  return [
    location ?? "",
    company?.hqLocation ?? "",
    company?.officeLat ?? "",
    company?.officeLng ?? "",
    company?.officeCity ?? "",
  ].join("|");
}
