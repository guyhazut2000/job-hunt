/**
 * Commute keys: origin rounding (privacy + cache sharing), destination keys, departure buckets.
 * Pure functions, unit-tested in tests/commute.test.ts.
 */

export const MODES = ["car", "bus", "train"] as const;
export type CommuteMode = (typeof MODES)[number];
export const isMode = (s: string | null | undefined): s is CommuteMode => MODES.includes(s as CommuteMode);

/** Grid step for origins: 0.002° ≈ 220 m (lat) / 190 m (lng at 32°N). */
export const ORIGIN_GRID = 0.002;

export interface LatLng {
  lat: number;
  lng: number;
}

/** True for a plausible point in/near Israel (keeps junk params away from providers). */
export function inServiceArea(p: LatLng): boolean {
  return p.lat > 29.3 && p.lat < 33.5 && p.lng > 34.0 && p.lng < 36.0;
}

/** Snap an origin to the ~200 m grid. The rounded point is what we route from and cache under. */
export function roundOrigin(p: LatLng): LatLng & { key: string } {
  const snap = (v: number) => Math.round(v / ORIGIN_GRID) * ORIGIN_GRID;
  const lat = Number(snap(p.lat).toFixed(3));
  const lng = Number(snap(p.lng).toFixed(3));
  return { lat, lng, key: `${lat.toFixed(3)},${lng.toFixed(3)}` };
}

/** Destination key (job points are already city/hub level; 4 decimals ≈ 10 m). */
export function destKey(p: LatLng): string {
  return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
}

/** Parse "lat,lng" from a URL param. */
export function parseLatLng(s: string | null | undefined): LatLng | null {
  if (!s) return null;
  const m = s.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const p = { lat: Number(m[1]), lng: Number(m[2]) };
  return inServiceArea(p) ? p : null;
}

// ---------- Departure buckets ----------

/** Israeli week: Sun–Thu workdays, Friday short day, Saturday (little/no public transport). */
export const DAY_TYPES = ["sun-thu", "fri", "sat"] as const;
export type DayType = (typeof DAY_TYPES)[number];

export interface Departure {
  day: DayType;
  /** Minutes after midnight, Israel time, on the 30-minute grid. */
  minutes: number;
}

export const DEFAULT_DEPARTURE: Departure = { day: "sun-thu", minutes: 8 * 60 + 30 };

/** "sun-thu-0830" <-> Departure. Times snap down to the 30-minute grid. */
export function parseDeparture(s: string | null | undefined): Departure {
  const m = s?.match(/^(sun-thu|fri|sat)-(\d{2})(\d{2})$/);
  if (!m) return DEFAULT_DEPARTURE;
  const h = Number(m[2]);
  const min = Number(m[3]);
  if (h > 23 || min > 59) return DEFAULT_DEPARTURE;
  return { day: m[1] as DayType, minutes: Math.floor((h * 60 + min) / 30) * 30 };
}

export function departureKey(d: Departure): string {
  const hh = String(Math.floor(d.minutes / 60)).padStart(2, "0");
  const mm = String(d.minutes % 60).padStart(2, "0");
  return `${d.day}-${hh}${mm}`;
}

export function departureLabel(d: Departure): string {
  return departureKey(d)
    .slice(-4)
    .replace(/^(\d\d)(\d\d)$/, "$1:$2");
}

const TZ = "Asia/Jerusalem";

/** Offset (ms) of Israel time from UTC at a given instant. */
function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Israel-local calendar date + weekday for an instant. */
function israelDate(at: Date): { y: number; m: number; d: number; dow: number; minutes: number } {
  const local = new Date(at.getTime() + tzOffsetMs(at));
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    dow: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

const dayMatches = (day: DayType, dow: number) =>
  day === "sun-thu" ? dow >= 0 && dow <= 4 : day === "fri" ? dow === 5 : dow === 6;

/**
 * The next instant (UTC Date) matching a departure bucket, strictly after `now` (Israel time).
 * Default bucket: the next Sun–Thu at 08:30.
 */
export function nextDeparture(dep: Departure, now = new Date()): Date {
  const today = israelDate(now);
  for (let i = 0; i < 8; i++) {
    const base = Date.UTC(today.y, today.m, today.d + i);
    const dow = new Date(base).getUTCDay();
    if (!dayMatches(dep.day, dow)) continue;
    if (i === 0 && dep.minutes <= today.minutes) continue;
    const localMs = base + dep.minutes * 60_000;
    // Local wall time -> UTC (two passes handle DST edges).
    let utc = localMs - tzOffsetMs(new Date(localMs));
    utc = localMs - tzOffsetMs(new Date(utc));
    return new Date(utc);
  }
  return now;
}

/** Sun–Thu rush hours, when free-flow car times are most optimistic. */
export function isPeak(dep: Departure): boolean {
  if (dep.day !== "sun-thu") return false;
  return (
    (dep.minutes >= 6 * 60 + 30 && dep.minutes < 9 * 60 + 30) || (dep.minutes >= 15 * 60 + 30 && dep.minutes < 19 * 60)
  );
}

/** Multiplier applied to free-flow car time for the upper end of the shown range. */
export function trafficFactor(dep: Departure): number {
  return isPeak(dep) ? 1.6 : dep.day === "sun-thu" ? 1.25 : 1.1;
}
