import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  jobs: [] as unknown[],
  profile: null as null | { salaryMin: number | null; companyTypes: string[] },
  contacts: [] as { companyId: string }[],
  calls: { profile: 0, contact: 0, application: 0 },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/followup/server", () => ({ emailResponses: async () => new Set() }));
vi.mock("@/lib/search/lexicon-server", () => ({ loadCompanyLexicon: async () => undefined }));
vi.mock("@/lib/db", () => ({
  db: {
    job: { findMany: async () => store.jobs },
    application: {
      findMany: async () => {
        store.calls.application++;
        return [];
      },
    },
    profile: {
      findUnique: async () => {
        store.calls.profile++;
        return store.profile;
      },
    },
    contact: {
      findMany: async () => {
        store.calls.contact++;
        return store.contacts;
      },
    },
  },
}));

import { rankPersonal } from "@/lib/ranking/server";
import { EMPTY_PREFS, normalizePrefs, WEIGHT_KEYS } from "@/lib/ranking/personal";
import type { Candidate } from "@/lib/profile/score";

const now = new Date("2026-11-04T08:00:00Z");
const company = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: id,
  name: `Co ${id}`,
  industry: null,
  size: null,
  ...over,
});
const job = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: "Senior Backend Engineer",
  techStack: ["Go", "Postgres"],
  department: null,
  postedAt: now,
  companyId: `c-${id}`,
  company: company(`c-${id}`),
  seniority: "SENIOR",
  roleCategory: "backend",
  workMode: "HYBRID",
  employmentType: "FULL_TIME",
  location: "Tel Aviv",
  payMin: null,
  payMax: null,
  payCurrency: null,
  payPeriod: null,
  ...over,
});
const candidate: Candidate = {
  skills: [
    { name: "Go", level: "EXPERT", years: 4 },
    { name: "Postgres", level: "GOOD", years: 3 },
  ],
  targetRoles: ["backend"],
  targetSeniorities: ["SENIOR"],
  totalYears: 6,
  regions: ["tel_aviv"],
  workModes: ["HYBRID"],
  wantedTech: [],
  avoidTech: [],
} as unknown as Candidate;

const run = (prefs = EMPTY_PREFS, cand: Candidate | null = candidate) =>
  rankPersonal({ userId: "u", where: {}, prefs, candidate: cand, companies: [], now });

beforeEach(() => {
  store.jobs = [];
  store.profile = { salaryMin: null, companyTypes: [] };
  store.contacts = [];
  store.calls = { profile: 0, contact: 0, application: 0 };
});

describe("rankPersonal with seeker criteria", () => {
  it("an insider at the company and a matching industry lift a job; unknowns are 'no data'", async () => {
    store.jobs = [
      job("a", { company: company("c-a", { industry: "Cybersecurity" }) }),
      job("b", { company: company("c-b", { industry: "Mobile gaming" }) }),
    ];
    store.contacts = [{ companyId: "c-a" }];
    const { rows } = await run(normalizePrefs({ criteria: { industries: ["cyber"] } }));
    expect(rows.map((r) => r.job.id)).toEqual(["a", "b"]);
    const by = (id: string, k: string) =>
      rows.find((r) => r.job.id === id)!.personal.criteria.find((c) => c.key === k)!;
    expect(by("a", "referral").value).toBe(100);
    expect(by("b", "referral").value).toBeNull();
    expect(by("a", "domain").value).toBe(100);
    expect(by("b", "domain").value).toBe(20);
    expect(by("a", "salary").value).toBeNull(); // no salary floor anywhere → no data
  });

  it("salary uses the profile floor and the posted pay", async () => {
    store.profile = { salaryMin: 30000, companyTypes: [] };
    store.jobs = [
      job("rich", { payMin: 35000, payMax: 45000, payCurrency: "ILS", payPeriod: "month" }),
      job("poor", { payMin: 12000, payMax: 15000, payCurrency: "ILS", payPeriod: "month" }),
    ];
    const { rows } = await run();
    const sal = (id: string) => rows.find((r) => r.job.id === id)!.personal.parts.salary;
    expect(sal("rich")).toBe(100);
    expect(sal("poor")).toBeLessThan(100);
    expect(rows[0].job.id).toBe("rich");
  });

  it("works with zero setup and no profile, and skips queries for switched-off criteria", async () => {
    store.jobs = [job("a")];
    const off = normalizePrefs({ criteria: { off: [...WEIGHT_KEYS] } });
    const { rows } = await run(off, null);
    expect(rows[0].personal.score).toBe(0);
    expect(store.calls).toEqual({ profile: 0, contact: 0, application: 0 });
    const def = await run(EMPTY_PREFS, null);
    expect(def.rows[0].personal.score).toBeGreaterThan(0);
  });
});
