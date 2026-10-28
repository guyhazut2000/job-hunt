import { type CommuteMode, type LatLng } from "./keys";
import type { CommuteProvider } from "./types";

/**
 * Transitous (https://transitous.org) — community-run MOTIS 2 routing over public GTFS feeds,
 * including Israel's (Israel Railways, Dan, Egged, Metropoline, ...), plus OSM street routing.
 * Free, no key; usage policy: open-source non-commercial apps, light use (talk to them above
 * ~720 routing requests/day), identifying User-Agent, visible link to https://transitous.org/sources/.
 * We send at most one matrix request per (rounded origin, mode, departure bucket) and cache it.
 */
const BASE = process.env.TRANSITOUS_BASE_URL || "https://api.transitous.org";
export const GEO_USER_AGENT =
  process.env.GEO_USER_AGENT || "job-hunt/0.1 (jobs map; +https://github.com/guyhazut2000/job-hunt)";

const TRAIN_MODES = [
  "RAIL",
  "REGIONAL_RAIL",
  "REGIONAL_FAST_RAIL",
  "SUBURBAN",
  "HIGHSPEED_RAIL",
  "LONG_DISTANCE",
  "TRAM",
  "SUBWAY",
  "METRO",
].join(",");

const pt = (p: LatLng) => `${p.lat.toFixed(5)};${p.lng.toFixed(5)}`;

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

export const transitous: CommuteProvider = {
  name: "transitous",
  batchSize: 100,
  async matrix(origin, dests, mode: CommuteMode, departure) {
    const many = dests.map(pt).join(",");
    if (mode === "car") {
      const url =
        `${BASE}/api/v1/one-to-many?one=${pt(origin)}&many=${many}` +
        `&mode=CAR&max=10800&maxMatchingDistance=500&arriveBy=false`;
      const rows = (await getJson(url)) as Duration[];
      if (!Array.isArray(rows) || rows.length !== dests.length) throw new Error("transitous: bad car response");
      return rows.map((r) => ({ seconds: typeof r?.duration === "number" ? Math.round(r.duration) : null }));
    }
    const params = new URLSearchParams({
      time: departure.at.toISOString(),
      maxTravelTime: "180",
      maxMatchingDistance: "500",
      arriveBy: "false",
      transitModes: mode === "bus" ? "BUS,COACH" : TRAIN_MODES,
    });
    // Train stations are sparser: allow up to 30 min walking at each end.
    if (mode === "train") {
      params.set("maxPreTransitTime", "1800");
      params.set("maxPostTransitTime", "1800");
    }
    const url = `${BASE}/api/experimental/one-to-many-intermodal?one=${pt(origin)}&many=${many}&${params}`;
    const body = (await getJson(url, 20_000)) as { transit_durations?: Duration[][]; street_durations?: Duration[] };
    const rows = body?.transit_durations;
    if (!Array.isArray(rows) || rows.length !== dests.length) throw new Error("transitous: bad transit response");
    return rows.map((options, i) => {
      const best = (options ?? [])
        .filter((o) => typeof o?.duration === "number")
        .sort((a, b) => a.duration! - b.duration!)[0];
      // Walking only (destination right next to the origin) when that beats any transit option.
      const walk = body.street_durations?.[i]?.duration;
      if (typeof walk === "number" && (!best || walk <= best.duration!))
        return { seconds: Math.round(walk), transfers: 0 };
      return best ? { seconds: Math.round(best.duration!), transfers: best.transfers } : { seconds: null };
    });
  },
};
