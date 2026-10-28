import vercelConfig from "../../../vercel.json";

/**
 * "Last scan" indicator (jobs list + map header). Built from the per-company `IngestionRun` rows the
 * daily ingest crons already write (src/lib/ingestion/run.ts) — no extra bookkeeping.
 *
 * A scan = every run that finished within SCAN_WINDOW_MS before the newest finished run. The daily
 * crons (vercel.json) are split across ~1.5 h, so one window covers a whole daily cycle.
 */
export const SCAN_WINDOW_MS = 3 * 60 * 60 * 1000;
/** Older than this (a daily cron plus slack) = the scan is stale. */
export const STALE_AFTER_MS = 26 * 60 * 60 * 1000;
export const LAST_SCAN_TAG = "last-scan";

export interface ScanRunRow {
  companyId: string | null;
  finishedAt: Date | string;
  created: number;
  updated: number;
  error: string | null;
}

/** JSON-safe (it goes through unstable_cache and into a client component). */
export interface ScanSummary {
  /** ISO time the newest run of the scan finished. */
  finishedAt: string;
  /** ISO time the oldest run of the scan finished. */
  startedAt: string;
  companies: number;
  failed: number;
  created: number;
  updated: number;
}

export type ScanStatus = "ok" | "partial" | "stale";

/** Collapse the runs of the latest scan window. A company counts as failed when its newest run errored. */
export function summarizeScan(rows: ScanRunRow[]): ScanSummary | null {
  if (!rows.length) return null;
  const t = (r: ScanRunRow) => new Date(r.finishedAt).getTime();
  const sorted = [...rows].sort((a, b) => t(a) - t(b));
  const latest = t(sorted[sorted.length - 1]);
  const inWindow = sorted.filter((r) => t(r) >= latest - SCAN_WINDOW_MS);
  const lastByCompany = new Map<string, ScanRunRow>();
  for (const r of inWindow) lastByCompany.set(r.companyId ?? "?", r);
  return {
    finishedAt: new Date(latest).toISOString(),
    startedAt: new Date(t(inWindow[0])).toISOString(),
    companies: lastByCompany.size,
    failed: [...lastByCompany.values()].filter((r) => r.error).length,
    created: inWindow.reduce((n, r) => n + r.created, 0),
    updated: inWindow.reduce((n, r) => n + r.updated, 0),
  };
}

export function scanStatus(scan: Pick<ScanSummary, "finishedAt" | "failed">, now: Date = new Date()): ScanStatus {
  if (now.getTime() - new Date(scan.finishedAt).getTime() > STALE_AFTER_MS) return "stale";
  return scan.failed > 0 ? "partial" : "ok";
}

/** UTC minute-of-day of every daily ingest cron in vercel.json ("m h * * *" only). */
export function ingestCronMinutes(crons: { path: string; schedule: string }[] = vercelConfig.crons): number[] {
  const out = new Set<number>();
  for (const c of crons) {
    if (!c.path.startsWith("/api/cron/ingest")) continue;
    const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(c.schedule.trim());
    if (m) out.add(Number(m[2]) * 60 + Number(m[1]));
  }
  return [...out].sort((a, b) => a - b);
}

/** Next time a daily ingest cron fires after `now` (Vercel cron schedules are UTC). */
export function nextScheduledScan(now: Date = new Date(), minutes: number[] = ingestCronMinutes()): Date | null {
  if (!minutes.length) return null;
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const offset of [0, 1]) {
    for (const m of minutes) {
      const at = day + offset * 86_400_000 + m * 60_000;
      if (at > now.getTime()) return new Date(at);
    }
  }
  return null;
}

/** "3 hours ago" / "לפני 3 שעות" — coarse, localized. */
export function formatRelative(d: Date | string, locale: string, now: Date = new Date()): string {
  const diff = Math.round((new Date(d).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "minute");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86_400), "day");
}
