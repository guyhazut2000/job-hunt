import { describe, expect, it } from "vitest";
import {
  formatRelative,
  ingestCronMinutes,
  nextScheduledScan,
  scanStatus,
  summarizeScan,
  type ScanRunRow,
} from "@/lib/ingestion/last-scan";
import { lastScanStrings } from "@/lib/i18n/last-scan";

const row = (finishedAt: string, extra: Partial<ScanRunRow> = {}): ScanRunRow => ({
  companyId: "c1",
  finishedAt,
  created: 0,
  updated: 0,
  error: null,
  ...extra,
});

describe("summarizeScan", () => {
  it("returns null with no runs", () => {
    expect(summarizeScan([])).toBeNull();
  });

  it("keeps only the latest window and counts new jobs and companies", () => {
    const s = summarizeScan([
      row("2026-10-27T13:00:00Z", { companyId: "old", created: 400 }),
      row("2026-10-28T04:01:00Z", { companyId: "a", created: 5, updated: 10 }),
      row("2026-10-28T04:30:00Z", { companyId: "b", created: 2 }),
      row("2026-10-28T05:25:00Z", { companyId: "c", created: 1 }),
    ])!;
    expect(s.finishedAt).toBe("2026-10-28T05:25:00.000Z");
    expect(s.startedAt).toBe("2026-10-28T04:01:00.000Z");
    expect(s.companies).toBe(3);
    expect(s.created).toBe(8);
    expect(s.updated).toBe(10);
    expect(s.failed).toBe(0);
  });

  it("counts a company as failed only when its newest run in the window errored", () => {
    const s = summarizeScan([
      row("2026-10-28T04:00:00Z", { companyId: "a", error: "timeout" }),
      row("2026-10-28T05:20:00Z", { companyId: "a" }),
      row("2026-10-28T04:10:00Z", { companyId: "b" }),
      row("2026-10-28T05:21:00Z", { companyId: "b", error: "500" }),
    ])!;
    expect(s.companies).toBe(2);
    expect(s.failed).toBe(1);
  });
});

describe("scanStatus", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  it("is ok / partial / stale", () => {
    expect(scanStatus({ finishedAt: "2026-10-28T05:00:00Z", failed: 0 }, now)).toBe("ok");
    expect(scanStatus({ finishedAt: "2026-10-28T05:00:00Z", failed: 2 }, now)).toBe("partial");
    expect(scanStatus({ finishedAt: "2026-10-27T09:59:00Z", failed: 0 }, now)).toBe("stale");
  });
});

describe("next scheduled scan", () => {
  it("reads the daily ingest crons from vercel.json", () => {
    const mins = ingestCronMinutes();
    expect(mins.length).toBeGreaterThan(0);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });

  it("returns the next cron after now, rolling over to tomorrow", () => {
    const crons = [
      { path: "/api/cron/ingest?provider=GREENHOUSE", schedule: "0 4 * * *" },
      { path: "/api/cron/ingest?provider=WORKDAY", schedule: "40 4 * * *" },
      { path: "/api/cron/email-sync", schedule: "0 5 * * *" },
    ];
    const mins = ingestCronMinutes(crons);
    expect(mins).toEqual([240, 280]);
    expect(nextScheduledScan(new Date("2026-10-28T04:10:00Z"), mins)?.toISOString()).toBe("2026-10-28T04:40:00.000Z");
    expect(nextScheduledScan(new Date("2026-10-28T11:00:00Z"), mins)?.toISOString()).toBe("2026-10-29T04:00:00.000Z");
    expect(nextScheduledScan(new Date(), [])).toBeNull();
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  it("formats hours ago in Hebrew and English", () => {
    expect(formatRelative("2026-10-28T09:00:00Z", "he-IL", now)).toBe("לפני 3 שעות");
    expect(formatRelative("2026-10-28T09:00:00Z", "en-GB", now)).toBe("3 hours ago");
    expect(formatRelative("2026-10-28T11:40:00Z", "en-GB", now)).toBe("20 minutes ago");
    expect(formatRelative("2026-10-26T12:00:00Z", "en-GB", now)).toBe("2 days ago");
  });

  it("has matching HE/EN strings", () => {
    expect(Object.keys(lastScanStrings("he"))).toEqual(Object.keys(lastScanStrings("en")));
  });
});
