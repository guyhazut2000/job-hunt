import { db } from "@/lib/db";
import { GEO_USER_AGENT } from "@/lib/commute/transitous";
import { inServiceArea } from "@/lib/commute/keys";
import { parseLocation } from "./geocode";
import { normText } from "./text";

/**
 * Address geocoding for saved places and admin office overrides — never for bulk job data (that is
 * offline, see geocode.ts). Follows the Nominatim usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/): server-side only, identifying
 * User-Agent, ≤ 1 request/second across all instances (tracked in GeoProviderCall), and every
 * answer (hits and misses) cached forever in GeocodeCache. Falls back to the offline gazetteer
 * (city centre) when Nominatim is unavailable.
 */

const BASE = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const PROVIDER = "nominatim";

export interface AddressHit {
  lat: number;
  lng: number;
  label: string;
  provider: "nominatim" | "gazetteer";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  for (let i = 0; i < 5; i++) {
    const last = await db.geoProviderCall.findFirst({
      where: { provider: PROVIDER },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const wait = last ? 1100 - (Date.now() - last.createdAt.getTime()) : 0;
    if (wait <= 0) return;
    await sleep(Math.min(wait, 1100));
  }
}

export function cacheKey(address: string): string {
  return normText(address).replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function geocodeAddress(address: string): Promise<AddressHit | null> {
  const query = cacheKey(address);
  if (!query) return null;
  const cached = await db.geocodeCache.findUnique({ where: { query } });
  if (cached) {
    return cached.lat != null && cached.lng != null
      ? { lat: cached.lat, lng: cached.lng, label: cached.label ?? address, provider: "nominatim" }
      : gazetteer(address);
  }
  let hit: AddressHit | null = null;
  let ok = false;
  try {
    await throttle();
    await db.geoProviderCall.create({ data: { provider: PROVIDER, kind: "search", ok: true } });
    const url = `${BASE}/search?${new URLSearchParams({
      q: address.slice(0, 300),
      format: "jsonv2",
      limit: "1",
      countrycodes: "il",
      "accept-language": "he,en",
    })}`;
    const res = await fetch(url, {
      headers: { "User-Agent": GEO_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    ok = true;
    const r = rows[0];
    if (r) {
      const p = { lat: Number(r.lat), lng: Number(r.lon) };
      if (inServiceArea(p)) hit = { ...p, label: r.display_name, provider: "nominatim" };
    }
  } catch (e) {
    console.warn("nominatim failed", e instanceof Error ? e.message : e);
  }
  if (ok) {
    await db.geocodeCache
      .create({
        data: { query, lat: hit?.lat ?? null, lng: hit?.lng ?? null, label: hit?.label ?? null, provider: PROVIDER },
      })
      .catch(() => {});
  }
  return hit ?? gazetteer(address);
}

/** Offline fallback: centre of the first recognised city / hub in the text. */
export function gazetteer(address: string): AddressHit | null {
  const p = parseLocation(address)[0];
  return p ? { lat: p.lat, lng: p.lng, label: p.label, provider: "gazetteer" } : null;
}
