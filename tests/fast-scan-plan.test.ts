import { describe, expect, it } from "vitest";
import { planScan, type ScanCandidate } from "@/lib/ingestion/run";
import { FAST_SCAN_STALE_MS } from "@/lib/ingestion/fast-scan";

const NOW = Date.parse("2026-10-30T10:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000);
const c = (
  id: string,
  atsProvider: ScanCandidate["atsProvider"],
  last: Date | null,
  syncFailures = 0,
): ScanCandidate => ({
  id,
  atsProvider,
  lastSyncedAt: last,
  syncFailures,
});

describe("planScan (fast-scan queue)", () => {
  const companies = [
    c("fresh-comeet", "COMEET", ago(10)),
    c("old-comeet", "COMEET", ago(300)),
    c("never", "COMEET", null),
    c("fresh-gh", "GREENHOUSE", ago(59)),
    c("stale-gh", "GREENHOUSE", ago(61)),
    c("failing-gh", "GREENHOUSE", ago(5), 2),
  ];

  it("without a freshness window queues every board, stalest first", () => {
    const { byProvider, fresh } = planScan(companies, { now: NOW });
    expect(fresh).toBe(0);
    expect(byProvider.get("COMEET")).toEqual(["never", "old-comeet", "fresh-comeet"]);
    expect(byProvider.get("GREENHOUSE")).toEqual(["stale-gh", "fresh-gh", "failing-gh"]);
  });

  it("skips boards synced within the window but keeps never-synced and failing ones", () => {
    const { byProvider, fresh } = planScan(companies, { now: NOW, staleAfterMs: FAST_SCAN_STALE_MS });
    expect(fresh).toBe(2);
    expect(byProvider.get("COMEET")).toEqual(["never", "old-comeet"]);
    expect(byProvider.get("GREENHOUSE")).toEqual(["stale-gh", "failing-gh"]);
  });

  it("right after a full run nothing is left to scan (remaining can reach 0)", () => {
    const all = Array.from({ length: 154 }, (_, i) => c(`b${i}`, "COMEET", ago(20)));
    const { byProvider, fresh } = planScan(all, { now: NOW, staleAfterMs: FAST_SCAN_STALE_MS });
    expect(fresh).toBe(154);
    expect(byProvider.size).toBe(0);
  });
});
