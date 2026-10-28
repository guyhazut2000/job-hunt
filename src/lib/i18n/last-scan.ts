import type { Locale } from "./dictionaries";

const en = {
  label: "Last scan",
  never: "No scan yet",
  exact: "Finished {time} (Israel time)",
  newJobs: "{n} new jobs",
  companies: "{n} companies checked",
  failed: "{n} failed",
  next: "Next scan: {time}",
  status: { ok: "All sources OK", partial: "Some sources failed", stale: "Scan is overdue" },
  details: "Scan details",
  companyScanned: "Scanned {time}",
};

export type LastScanStrings = typeof en;

const he: LastScanStrings = {
  label: "סריקה אחרונה",
  never: "עדיין לא בוצעה סריקה",
  exact: "הסתיימה ב-{time} (שעון ישראל)",
  newJobs: "{n} משרות חדשות",
  companies: "{n} חברות נבדקו",
  failed: "{n} נכשלו",
  next: "הסריקה הבאה: {time}",
  status: { ok: "כל המקורות תקינים", partial: "חלק מהמקורות נכשלו", stale: "הסריקה באיחור" },
  details: "פרטי הסריקה",
  companyScanned: "נסרקה {time}",
};

export function lastScanStrings(locale: Locale): LastScanStrings {
  return locale === "he" ? he : en;
}
