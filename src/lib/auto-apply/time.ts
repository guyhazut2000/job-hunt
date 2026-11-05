/** Calendar-day boundaries in a time zone. Auto-apply caps use Asia/Jerusalem. */

const ZONE = "Asia/Jerusalem";

function parts(now: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** UTC instant of 00:00 on the calendar day that `now` falls on in `timeZone`. */
export function zonedDayStart(now: Date, timeZone = ZONE): Date {
  const p = parts(now, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = asUtc - now.getTime();
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0) - offset);
}

/** Start of the next calendar day in the same zone. 26h clears both DST directions. */
export function nextZonedDay(start: Date, timeZone = ZONE): Date {
  return zonedDayStart(new Date(start.getTime() + 26 * 60 * 60 * 1000), timeZone);
}
