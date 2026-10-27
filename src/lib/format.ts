/** All user-facing dates render in Israel time, regardless of the server's zone (Vercel runs in UTC). */
export const APP_TIME_ZONE = "Asia/Jerusalem";

export function formatDate(d: Date, locale: string, opts: Intl.DateTimeFormatOptions = {}) {
  return d.toLocaleDateString(locale, { timeZone: APP_TIME_ZONE, day: "numeric", month: "short", ...opts });
}

export function formatDateTime(d: Date, locale: string) {
  return d.toLocaleString(locale, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3d", "2w" style age, localized via Intl.RelativeTimeFormat. */
export function formatAge(d: Date, locale: string, now: Date = new Date()) {
  const days = Math.max(0, Math.round((now.getTime() - d.getTime()) / 86_400_000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (days < 7) return rtf.format(-days, "day");
  if (days < 60) return rtf.format(-Math.round(days / 7), "week");
  return rtf.format(-Math.round(days / 30), "month");
}
