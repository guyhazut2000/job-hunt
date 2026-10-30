import { describe, expect, it } from "vitest";
import {
  appFacts,
  computeStats,
  median,
  sourceKey,
  weekStart,
  type StatsApp,
  type StatsChange,
} from "@/lib/stats/search-stats";
import { statsStrings } from "@/lib/i18n/stats";

const NOW = new Date("2026-10-30T10:00:00Z");
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000);
let seq = 0;
function app(p: Partial<StatsApp> = {}): StatsApp {
  seq++;
  return {
    id: `a${seq}`,
    title: `Role ${seq}`,
    company: "Acme",
    status: "APPLIED",
    createdAt: d(30),
    appliedAt: d(30),
    statusChangedAt: null,
    source: "APP",
    jobId: `j${seq}`,
    domain: "software",
    provider: "GREENHOUSE",
    changes: [],
    ...p,
  };
}
const ch = (
  from: StatsChange["fromStatus"],
  to: StatsChange["toStatus"],
  daysAgo: number,
  p: Partial<StatsChange> = {},
): StatsChange => ({
  fromStatus: from,
  toStatus: to,
  source: "MANUAL",
  at: d(daysAgo),
  undone: false,
  ...p,
});

describe("appFacts", () => {
  it("counts a rejection as a response and records the stage", () => {
    const f = appFacts(
      app({ status: "REJECTED", changes: [ch("APPLIED", "SCREENING", 25), ch("SCREENING", "REJECTED", 20)] }),
    );
    expect(f.applied && f.responded && f.rejected).toBe(true);
    expect(f.interviewed).toBe(false);
    expect(f.rejectedAt).toBe("SCREENING");
    expect(f.daysToResponse).toBe(5);
  });

  it("keeps the furthest stage reached even after a later rejection", () => {
    const f = appFacts(
      app({ status: "REJECTED", changes: [ch("APPLIED", "INTERVIEW", 20), ch("INTERVIEW", "REJECTED", 10)] }),
    );
    expect(f.interviewed).toBe(true);
    expect(f.reached).toBe("INTERVIEW");
    expect(f.rejectedAt).toBe("INTERVIEW");
  });

  it("ignores undone email changes", () => {
    const f = appFacts(app({ changes: [ch("APPLIED", "INTERVIEW", 10, { source: "EMAIL_AUTO", undone: true })] }));
    expect(f.responded).toBe(false);
    expect(f.responseByEmail).toBe(false);
  });

  it("flags responses detected from email", () => {
    const f = appFacts(
      app({ status: "SCREENING", changes: [ch("APPLIED", "SCREENING", 22, { source: "EMAIL_AUTO" })] }),
    );
    expect(f.responseByEmail).toBe(true);
    expect(f.daysToResponse).toBe(8);
  });

  it("falls back to statusChangedAt when there is no history", () => {
    const f = appFacts(app({ status: "INTERVIEW", statusChangedAt: d(27) }));
    expect(f.responded && f.interviewed).toBe(true);
    expect(f.daysToResponse).toBe(3);
  });

  it("treats saved jobs as not applied", () => {
    const f = appFacts(app({ status: "SAVED", appliedAt: null }));
    expect(f.applied).toBe(false);
    expect(f.appliedDate).toBeNull();
  });
});

describe("computeStats", () => {
  it("handles no data", () => {
    const s = computeStats([], NOW);
    expect(s.counts.applied).toBe(0);
    expect(s.smallData).toBe(true);
    expect(s.rates.response).toBeNull();
    expect(s.bottleneck).toBeNull();
    expect(s.trend).toHaveLength(12);
    expect(s.timeToResponse.medianDays).toBeNull();
  });

  it("hides rates below the minimum", () => {
    const s = computeStats(
      [app(), app({ status: "SCREENING", statusChangedAt: d(20) }), app({ status: "SAVED", appliedAt: null })],
      NOW,
    );
    expect(s.counts.applied).toBe(2);
    expect(s.saved).toBe(1);
    expect(s.smallData).toBe(true);
    expect(s.rates.response).toBeNull();
    expect(s.bySource[0].responseRate).toBeNull();
  });

  it("computes funnel, rates, bottleneck and breakdowns", () => {
    const apps = [
      app({ company: "Wix", status: "APPLIED", createdAt: d(3), appliedAt: d(3) }),
      app({ company: "Wix", status: "APPLIED", createdAt: d(40), appliedAt: d(40) }),
      app({ company: "Wix", status: "REJECTED", changes: [ch("APPLIED", "REJECTED", 26, { source: "EMAIL_AUTO" })] }),
      app({ company: "Monday", status: "SCREENING", changes: [ch("APPLIED", "SCREENING", 28)] }),
      app({
        company: "Monday",
        status: "INTERVIEW",
        domain: "devops",
        changes: [ch("APPLIED", "INTERVIEW", 20, { source: "EMAIL_REVIEW" })],
      }),
      app({
        company: "Intel",
        status: "OFFER",
        domain: "hardware",
        provider: "WORKDAY",
        changes: [ch("APPLIED", "INTERVIEW", 25), ch("INTERVIEW", "OFFER", 5)],
      }),
    ];
    const s = computeStats(apps, NOW);
    expect(s.counts).toEqual({ applied: 6, responded: 4, interviewed: 2, offered: 1, rejected: 1 });
    expect(s.smallData).toBe(false);
    expect(s.rates.response).toBeCloseTo(4 / 6);
    expect(s.rates.rejection).toBeCloseTo(1 / 6);
    expect(s.steps.map((x) => x.rate)).toEqual([4 / 6, 0.5, null]);
    expect(s.bottleneck?.from).toBe("responded");
    expect(s.byCompany[0]).toMatchObject({ key: "Wix", applied: 3, responded: 1, responseRate: 1 / 3 });
    expect(s.bySource.map((r) => r.key)).toEqual(["GREENHOUSE", "WORKDAY"]);
    expect(s.byDomain.find((r) => r.key === "software")?.applied).toBe(4);
    expect(s.rejectedAt.APPLIED).toBe(1);
    expect(s.email).toEqual({ autoChanges: 1, reviewChanges: 1, undone: 0, responsesFromEmail: 2 });
    expect(s.timeToResponse.n).toBe(4);
    expect(s.timeToResponse.fastestDays).toBe(2);
    // Stuck: the 40-day-old application with no reply, and the 30-day applied rows.
    expect(s.stuck[0]).toMatchObject({ company: "Wix", status: "APPLIED", days: 40 });
    expect(s.stuck.some((x) => x.days === 3)).toBe(false);
    expect(s.waits.find((w) => w.stage === "APPLIED")).toMatchObject({ count: 2, stuck: 1 });
    // Weekly trend sums only the last 12 weeks.
    expect(s.trend.reduce((n, w) => n + w.applied, 0)).toBe(6);
  });
});

describe("helpers", () => {
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("weekStart uses Israel Sunday", () => {
    // Saturday 23:30 UTC = Sunday 01:30 in Israel.
    expect(weekStart(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(weekStart(new Date("2026-10-30T10:00:00Z"))).toBe("2026-10-25");
  });
  it("sourceKey", () => {
    expect(sourceKey(app({ provider: "LEVER" }))).toBe("LEVER");
    expect(sourceKey(app({ provider: null, jobId: null, source: "EMAIL" }))).toBe("EMAIL");
    expect(sourceKey(app({ provider: null, jobId: null }))).toBe("EXTERNAL");
  });
});

describe("stats strings", () => {
  it("has the same keys in both locales", () => {
    expect(Object.keys(statsStrings("he")).sort()).toEqual(Object.keys(statsStrings("en")).sort());
    expect(statsStrings("he").nav).toBe("סטטיסטיקה");
  });
});
