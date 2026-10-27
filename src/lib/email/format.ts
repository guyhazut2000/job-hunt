import { APP_TIME_ZONE } from "./config";

export function formatIsraelTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatIsraelDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(date);
}
