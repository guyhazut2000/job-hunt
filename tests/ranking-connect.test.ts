import { beforeEach, describe, expect, it, vi } from "vitest";
import { commuteValue, homePoint, jobPointsOf } from "@/lib/ranking/commute";
import { DEFAULT_WEIGHTS, normalizePrefs, personalScore, WEIGHT_KEYS } from "@/lib/ranking/personal";

/** #109: commute criterion, step-up page and saved-search alerts on the personal ranking. */

const store = vi.hoisted(() => ({
  searches: [] as unknown[],
  jobs: [] as unknown[],
  rankRows: [] as { job: { id: string }; personal: { score: number } }[],
  rankCalls: [] as unknown[],
  notified: [] as Record<string, unknown>[],
  profile: null as unknown,
  hidden: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/notifications/create", () => ({
  notify: vi.fn(async (_u: string, n: Record<string, unknown>) => (store.notified.push(n), { id: "n" })),
}));
vi.mock("@/lib/search/lexicon-server", () => ({ loadCompanyLexicon: vi.fn(async () => undefined) }));
vi.mock("@/lib/ranking/server", () => ({
  getRankingPrefs: vi.fn(async () => null),
  rankPersonal: vi.fn(async (opts: unknown) => {
    store.rankCalls.push(opts);
    return { rows: store.rankRows, hidden: store.hidden };
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    savedSearch: {
      findMany: vi.fn(async () => store.searches),
      updateMany: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    job: { count: vi.fn(async () => store.jobs.length), findMany: vi.fn(async () => store.jobs) },
    company: { findMany: vi.fn(async () => []) },
    profile: { findUnique: vi.fn(async () => store.profile) },
  },
}));

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Job ${id}`,
  location: "Tel Aviv",
  company: { name: "Acme" },
  ...extra,
});

describe("commute criterion", () => {
  it("is a criterion, on by default with importance 2", () => {
    expect(WEIGHT_KEYS).toContain("commute");
    expect(DEFAULT_WEIGHTS.commute).toBe(2);
    expect(normalizePrefs({}).off).not.toContain("commute");
  });
  it("resolves Hebrew and English home cities to the same place", () => {
    const he = homePoint("רמת גן");
    const en = homePoint("Ramat Gan");
    expect(he).not.toBeNull();
    expect(he).toEqual(en);
    expect(homePoint("חיפה")).toEqual(homePoint("Haifa"));
  });
  it("skips (null) when the home city or the job location is unknown", () => {
    expect(commuteValue(null, { location: "Tel Aviv", workMode: "ONSITE" })).toBeNull();
    expect(commuteValue(homePoint("Tel Aviv"), { location: "Israel", workMode: "ONSITE" })).toBeNull();
    expect(homePoint("")).toBeNull();
    expect(homePoint("Narnia")).toBeNull();
  });
  it("scores near jobs high, far jobs low, remote full, hybrid softened", () => {
    const home = homePoint("תל אביב");
    expect(commuteValue(home, { location: "Ramat Gan", workMode: "ONSITE" })).toBe(100);
    expect(commuteValue(home, { location: "חיפה", workMode: "ONSITE" })).toBe(0);
    expect(commuteValue(home, { location: "Haifa", workMode: "REMOTE" })).toBe(100);
    expect(commuteValue(home, { location: "Haifa", workMode: "HYBRID" })).toBe(50);
    const mid = commuteValue(home, { location: "Netanya", workMode: "ONSITE" })!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });
  it("uses the nearest of several job locations and the geocoded pin", () => {
    const home = homePoint("Haifa");
    expect(commuteValue(home, { location: "Tel Aviv / חיפה", workMode: "ONSITE" })).toBe(100);
    expect(jobPointsOf({ location: "Israel", geoLat: 32, geoLng: 34.8 })).toHaveLength(1);
  });
  it("appears in the breakdown; no data is skipped, not penalized", () => {
    const base = {
      job: { id: "j", title: "Dev", techStack: [], postedAt: new Date(), companyId: "c", company: { name: "A" } },
      match: 80,
      include: [],
      exclude: [],
      inText: () => false,
      companyResponded: false,
      weights: DEFAULT_WEIGHTS,
    };
    const without = personalScore({ ...base, values: { commute: null } });
    const row = without.criteria.find((c) => c.key === "commute")!;
    expect(row.value).toBeNull();
    expect(row.points).toBe(0);
    const far = personalScore({ ...base, values: { commute: 0 } });
    const near = personalScore({ ...base, values: { commute: 100 } });
    expect(near.score).toBeGreaterThan(without.score - 1);
    expect(far.score).toBeLessThan(without.score);
    const off = personalScore({ ...base, values: { commute: 0 }, off: ["commute"] });
    expect(off.score).toBe(without.score);
  });
});

describe("saved-search alerts use the personal ranking", () => {
  beforeEach(() => {
    store.rankCalls = [];
    store.notified = [];
    store.hidden = 0;
    store.searches = [
      {
        id: "s1",
        userId: "u1",
        name: "react",
        query: "q=react&minMatch=65",
        lastCheckedAt: new Date("2026-11-01"),
        user: { locale: "he", profile: { skills: ["react"], skillItems: [] } },
      },
    ];
    store.jobs = [job("a"), job("b"), job("c")];
  });

  it("filterByPersonal keeps everything without a threshold and applies min-match / fit to the personal score", async () => {
    const { filterByPersonal, FIT_THRESHOLD } = await import("@/lib/notifications/saved-search");
    const rows = [{ personal: { score: 90 } }, { personal: { score: 60 } }];
    expect(filterByPersonal(rows, {})).toHaveLength(2);
    expect(filterByPersonal(rows, { minMatch: 70 })).toHaveLength(1);
    expect(filterByPersonal(rows, { fit: true })).toHaveLength(FIT_THRESHOLD <= 60 ? 2 : 1);
  });

  it("ranks new jobs with rankPersonal, orders best first and keeps those above min-match", async () => {
    store.rankRows = [
      { job: job("c"), personal: { score: 92 } },
      { job: job("a"), personal: { score: 75 } },
      { job: job("b"), personal: { score: 40 } },
    ];
    const { runSavedSearchAlerts } = await import("@/lib/notifications/saved-search");
    const sum = await runSavedSearchAlerts(new Date("2026-11-04T10:00:00Z"));
    expect(store.rankCalls).toHaveLength(1);
    expect((store.rankCalls[0] as { where: unknown }).where).toEqual({ id: { in: ["a", "b", "c"] } });
    expect(sum.jobs).toBe(2);
    const data = store.notified[0].data as { jobIds: string[] };
    expect(data.jobIds).toEqual(["c", "a"]);
  });

  it("drops jobs the user's keywords hide (rankPersonal leaves them out)", async () => {
    store.searches = [{ ...(store.searches[0] as object), query: "q=react" }];
    store.rankRows = [{ job: job("b"), personal: { score: 30 } }];
    const { runSavedSearchAlerts } = await import("@/lib/notifications/saved-search");
    const sum = await runSavedSearchAlerts(new Date("2026-11-04T10:00:00Z"));
    expect(sum.jobs).toBe(1);
  });
});

describe("step-up page uses the personal ranking", () => {
  const sj = (id: string) => ({
    id,
    title: "Senior Backend Engineer",
    roleCategory: "backend",
    seniority: "SENIOR",
    techStack: [],
    location: "Tel Aviv",
    workMode: "ONSITE",
    description: "",
    postedAt: new Date("2026-11-01"),
    companyId: "c1",
    company: { name: "Acme" },
  });
  beforeEach(() => {
    store.rankCalls = [];
    store.hidden = 0;
    store.profile = {
      targetRoles: ["backend"],
      seniority: "MID",
      yearsExperience: 3,
      experience: [],
      skills: [],
      skillItems: [],
    };
    store.jobs = [sj("a"), sj("b"), sj("c")];
  });

  it("orders by personal score and attaches the 'why' breakdown", async () => {
    store.rankRows = [
      { job: sj("b"), personal: { score: 88 } },
      { job: sj("c"), personal: { score: 61 } },
      { job: sj("a"), personal: { score: 20 } },
    ];
    const { loadStepUps } = await import("@/lib/career/server");
    const r = await loadStepUps("u1");
    expect(store.rankCalls).toHaveLength(1);
    expect(r.rows.map((x) => x.job.id)).toEqual(["b", "c", "a"]);
    expect(r.rows[0].personal?.score).toBe(88);
  });

  it("drops jobs hidden by the user's keywords and counts them", async () => {
    store.hidden = 1;
    store.rankRows = [
      { job: sj("a"), personal: { score: 70 } },
      { job: sj("c"), personal: { score: 50 } },
    ];
    const { loadStepUps } = await import("@/lib/career/server");
    const r = await loadStepUps("u1");
    expect(r.rows.map((x) => x.job.id)).toEqual(["a", "c"]);
    expect(r.hidden).toBe(1);
  });
});
