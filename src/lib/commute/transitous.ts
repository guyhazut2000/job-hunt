import { type CommuteMode, type LatLng } from "./keys";
import type { CommuteProvider, TransitLeg, TransitRoute } from "./types";

/**
 * Transitous (https://transitous.org) — community-run MOTIS 2 routing over public GTFS feeds,
 * including Israel's (Israel Railways, Dan, Egged, Metropoline, light rail, ...), plus OSM street
 * routing. Free, no key; usage policy: open-source non-commercial apps, light use (talk to them
 * above ~720 routing requests/day), identifying User-Agent, visible link to
 * https://transitous.org/sources/. We send at most one matrix request per (rounded origin, mode,
 * departure bucket) and cache it.
 */
const BASE = process.env.TRANSITOUS_BASE_URL || "https://api.transitous.org";
export const GEO_USER_AGENT =
  process.env.GEO_USER_AGENT || "job-hunt/0.1 (jobs map; +https://github.com/guyhazut2000/job-hunt)";

/**
 * Public-transport search settings, shared by the matrix and the itinerary call:
 * - every transit mode (bus, train, light rail, …) so trips can combine them with transfers;
 * - up to 25 min walking to the first stop and from the last one;
 * - up to 4 transfers;
 * - a 5-hour window, so rural origins with an infrequent first bus still get a route. Matrix
 *   durations count from the requested departure time (they include waiting for the first trip).
 */
export const TRANSIT_PARAMS = {
  transitModes: "TRANSIT",
  maxTransfers: "4",
  maxPreTransitTime: "1500",
  maxPostTransitTime: "1500",
  maxMatchingDistance: "500",
} as const;
export const TRANSIT_MAX_TRAVEL_MINUTES = 300;

const pt = (p: LatLng) => `${p.lat.toFixed(5)};${p.lng.toFixed(5)}`;
const ptComma = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

async function getJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": GEO_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`transitous ${res.status}`);
  return res.json();
}

type Duration = { duration?: number; transfers?: number };

/** Build the one-to-many-intermodal URL for combined public transport. */
export function transitMatrixUrl(origin: LatLng, dests: LatLng[], at: Date, base = BASE): string {
  const params = new URLSearchParams({
    ...TRANSIT_PARAMS,
    time: at.toISOString(),
    maxTravelTime: String(TRANSIT_MAX_TRAVEL_MINUTES),
    arriveBy: "false",
  });
  return `${base}/api/experimental/one-to-many-intermodal?one=${pt(origin)}&many=${dests.map(pt).join(",")}&${params}`;
}

/** Fastest option per destination; walking only when it beats every transit option. */
export function parseTransitMatrix(
  body: { transit_durations?: Duration[][]; street_durations?: Duration[] },
  n: number,
): { seconds: number | null; transfers?: number }[] {
  const rows = body?.transit_durations;
  if (!Array.isArray(rows) || rows.length !== n) throw new Error("transitous: bad transit response");
  return rows.map((options, i) => {
    const best = (options ?? [])
      .filter((o) => typeof o?.duration === "number")
      .sort((a, b) => a.duration! - b.duration! || (a.transfers ?? 0) - (b.transfers ?? 0))[0];
    const walk = body.street_durations?.[i]?.duration;
    if (typeof walk === "number" && (!best || walk <= best.duration!))
      return { seconds: Math.round(walk), transfers: 0 };
    return best ? { seconds: Math.round(best.duration!), transfers: best.transfers ?? 0 } : { seconds: null };
  });
}

const RAIL = new Set([
  "RAIL",
  "REGIONAL_RAIL",
  "REGIONAL_FAST_RAIL",
  "SUBURBAN",
  "HIGHSPEED_RAIL",
  "LONG_DISTANCE",
  "NIGHT_RAIL",
]);
export function legKind(mode: string): TransitLeg["kind"] {
  if (mode === "WALK") return "walk";
  if (mode === "BUS" || mode === "COACH") return "bus";
  if (RAIL.has(mode)) return "rail";
  if (mode === "TRAM") return "light_rail";
  if (mode === "SUBWAY" || mode === "METRO") return "subway";
  return "other";
}

type PlanLeg = { mode?: string; duration?: number; routeShortName?: string };
type PlanItinerary = { duration?: number; transfers?: number; startTime?: string; endTime?: string; legs?: PlanLeg[] };

/** Itinerary -> compact route (merged walks, line numbers for buses and light rail only). */
export function toRoute(it: PlanItinerary): TransitRoute | null {
  if (typeof it?.duration !== "number" || !it.startTime || !it.endTime || !Array.isArray(it.legs)) return null;
  const legs: TransitLeg[] = [];
  for (const l of it.legs) {
    const kind = legKind(l.mode ?? "");
    const seconds = Math.round(l.duration ?? 0);
    const prev = legs[legs.length - 1];
    if (kind === "walk" && prev?.kind === "walk") {
      prev.seconds += seconds;
      continue;
    }
    const line = l.routeShortName?.trim();
    legs.push({
      kind,
      seconds,
      ...((kind === "bus" || kind === "light_rail" || kind === "subway") && line && line.length <= 8 ? { line } : {}),
    });
  }
  // Drop walks under a minute (stop-to-stop shuffles) but keep the access/egress structure readable.
  const shown = legs.filter((l) => l.kind !== "walk" || l.seconds >= 60);
  return {
    seconds: Math.round(it.duration),
    transfers: it.transfers ?? Math.max(0, legs.filter((l) => l.kind !== "walk").length - 1),
    walkSeconds: legs.filter((l) => l.kind === "walk").reduce((a, l) => a + l.seconds, 0),
    departAt: it.startTime,
    arriveAt: it.endTime,
    legs: shown,
  };
}

/** Earliest arrival, then fewer transfers, then less walking. */
export function pickItinerary(its: PlanItinerary[]): TransitRoute | null {
  const routes = its.map(toRoute).filter((r): r is TransitRoute => !!r && r.legs.some((l) => l.kind !== "walk"));
  routes.sort(
    (a, b) =>
      Date.parse(a.arriveAt) - Date.parse(b.arriveAt) || a.transfers - b.transfers || a.walkSeconds - b.walkSeconds,
  );
  return routes[0] ?? null;
}

export const transitous: CommuteProvider = {
  name: "transitous",
  batchSize: 100,
  async matrix(origin, dests, mode: CommuteMode, departure) {
    if (mode === "car") {
      const url =
        `${BASE}/api/v1/one-to-many?one=${pt(origin)}&many=${dests.map(pt).join(",")}` +
        `&mode=CAR&max=10800&maxMatchingDistance=500&arriveBy=false`;
      const rows = (await getJson(url)) as Duration[];
      if (!Array.isArray(rows) || rows.length !== dests.length) throw new Error("transitous: bad car response");
      return rows.map((r) => ({ seconds: typeof r?.duration === "number" ? Math.round(r.duration) : null }));
    }
    const body = (await getJson(transitMatrixUrl(origin, dests, departure.at), 25_000)) as Parameters<
      typeof parseTransitMatrix
    >[0];
    return parseTransitMatrix(body, dests.length);
  },
  async route(origin, dest, at) {
    const params = new URLSearchParams({
      ...TRANSIT_PARAMS,
      fromPlace: ptComma(origin),
      toPlace: ptComma(dest),
      time: at.toISOString(),
      arriveBy: "false",
      searchWindow: "7200",
    });
    const body = (await getJson(`${BASE}/api/v5/plan?${params}`, 20_000)) as { itineraries?: PlanItinerary[] };
    if (!Array.isArray(body?.itineraries)) throw new Error("transitous: bad plan response");
    return pickItinerary(body.itineraries);
  },
};
