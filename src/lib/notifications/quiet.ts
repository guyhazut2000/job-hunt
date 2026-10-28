/** Quiet hours, evaluated in Israel time regardless of the server's zone. */
export const NOTIFY_TZ = "Asia/Jerusalem";

export interface QuietPrefs {
  quietEnabled: boolean;
  /** Hour 0–23 the quiet window starts (inclusive). */
  quietStart: number;
  /** Hour 0–23 it ends (exclusive). start > end wraps midnight; start === end = no window. */
  quietEnd: number;
  /** Friday 16:00 → Saturday 20:00 is quiet too. */
  quietShabbat: boolean;
}

export const DEFAULT_QUIET: QuietPrefs = { quietEnabled: true, quietStart: 22, quietEnd: 7, quietShabbat: false };

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: NOTIFY_TZ,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
});
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day of week (0 = Sunday), hour and minute in Israel time. */
export function israelClock(d: Date): { day: number; hour: number; minute: number } {
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { day: DAYS.indexOf(parts.weekday), hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}

function inWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function isQuiet(p: QuietPrefs, d: Date): boolean {
  const { day, hour } = israelClock(d);
  if (p.quietShabbat && ((day === 5 && hour >= 16) || (day === 6 && hour < 20))) return true;
  return p.quietEnabled && inWindow(hour, p.quietStart, p.quietEnd);
}

/** The first moment at or after `d` that is outside quiet hours (15-minute steps, max 3 days). */
export function nextAllowedAt(p: QuietPrefs, d: Date): Date {
  if (!isQuiet(p, d)) return d;
  const step = 15 * 60_000;
  // Snap to the next quarter hour, then walk forward.
  let t = Math.ceil(d.getTime() / step) * step;
  for (let i = 0; i < 4 * 24 * 3; i++, t += step) {
    if (!isQuiet(p, new Date(t))) return new Date(t);
  }
  return new Date(t);
}

export function clampHour(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}
