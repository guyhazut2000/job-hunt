/** Israel wall-clock helpers for user-entered times (datetime-local inputs carry no zone). */
import { NOTIFY_TZ } from "./quiet";

const wallFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: NOTIFY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function wallParts(d: Date) {
  const p = Object.fromEntries(wallFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

/** Israel offset from UTC at instant `d`, in ms (+2h winter, +3h summer). */
function offsetAt(d: Date): number {
  const w = wallParts(d);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min) - Math.floor(d.getTime() / 60_000) * 60_000;
}

/** "2026-11-05T14:00" (Israel wall time) → the UTC instant. Null when unparsable. */
export function israelLocalToUtc(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let t = asUtc - offsetAt(new Date(asUtc));
  // Re-check at the result (DST switch between the guess and the answer).
  t = asUtc - offsetAt(new Date(t));
  return new Date(t);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" in Israel time, for a datetime-local input's value. */
export function toIsraelLocalInput(d: Date): string {
  const w = wallParts(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${w.y}-${p(w.m)}-${p(w.d)}T${p(w.h)}:${p(w.min)}`;
}
