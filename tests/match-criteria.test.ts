import { describe, expect, it } from "vitest";
import {
  companySizeValue,
  defaultEmployment,
  employmentValue,
  industriesOf,
  industryValue,
  locationValue,
  salaryValue,
  seniorityValue,
  techValue,
  workModeValue,
} from "@/lib/ranking/criteria";
import {
  criteriaJson,
  DEFAULT_WEIGHTS,
  EMPTY_PREFS,
  matchCore,
  normalizePrefs,
  personalScore,
  WEIGHT_KEYS,
  type PersonalInput,
} from "@/lib/ranking/personal";
import { rankingStrings } from "@/lib/i18n/ranking";

const now = new Date("2026-11-04T08:00:00Z");
const base = (over: Partial<PersonalInput> = {}): PersonalInput => ({
  job: { id: "j", title: "Backend Engineer", techStack: [], postedAt: now, companyId: "c", company: { name: "Acme" } },
  match: null,
  include: [],
  exclude: [],
  inText: () => false,
  companyResponded: false,
  weights: DEFAULT_WEIGHTS,
  now,
  ...over,
});

describe("criterion evaluators", () => {
  it("salary: only with both sides; ≥ expected = 100; short scales down", () => {
    expect(salaryValue(null, 30000)).toBeNull();
    expect(salaryValue(30000, null)).toBeNull();
    expect(salaryValue(30000, 35000)).toBe(100);
    expect(salaryValue(30000, 27000)).toBe(70);
    expect(salaryValue(30000, 10000)).toBe(0);
  });
  it("seniority: exact / adjacent / far; no target = no data", () => {
    expect(seniorityValue("SENIOR", [])).toBeNull();
    expect(seniorityValue("SENIOR", ["SENIOR"])).toBe(100);
    expect(seniorityValue("SENIOR", ["MID"])).toBe(50);
    expect(seniorityValue("SENIOR", ["JUNIOR"])).toBe(0);
  });
  it("location: remote always fits; unknown region = no data", () => {
    expect(locationValue({ location: "Haifa", workMode: "ONSITE" }, [])).toBeNull();
    expect(locationValue({ location: "Anywhere", workMode: "REMOTE" }, ["tel_aviv"])).toBe(100);
    expect(locationValue({ location: "Tel Aviv", workMode: "ONSITE" }, ["tel_aviv"])).toBe(100);
    expect(locationValue({ location: "Haifa", workMode: "ONSITE" }, ["tel_aviv"])).toBe(0);
    expect(locationValue({ location: "Somewhere", workMode: "ONSITE" }, ["tel_aviv"])).toBeNull();
  });
  it("work model: hybrid is half-way", () => {
    expect(workModeValue("REMOTE", [])).toBeNull();
    expect(workModeValue("REMOTE", ["REMOTE"])).toBe(100);
    expect(workModeValue("HYBRID", ["REMOTE"])).toBe(50);
    expect(workModeValue("ONSITE", ["REMOTE"])).toBe(0);
  });
  it("employment: default excludes internships unless targeting intern roles", () => {
    expect(defaultEmployment(["SENIOR"])).not.toContain("INTERNSHIP");
    expect(defaultEmployment(["INTERN"])).toContain("INTERNSHIP");
    expect(employmentValue("INTERNSHIP", defaultEmployment([]))).toBe(0);
    expect(employmentValue("FULL_TIME", defaultEmployment([]))).toBe(100);
    expect(employmentValue("FULL_TIME", [])).toBeNull();
  });
  it("industry: maps free text (he/en); unknown company or no preference = no data", () => {
    expect(industriesOf("Cybersecurity")).toEqual(["cyber"]);
    expect(industriesOf("Fintech / Payments")).toContain("fintech");
    expect(industriesOf("Mobile gaming")).toContain("gaming");
    expect(industriesOf("Medical devices")).toContain("health");
    expect(industriesOf(null)).toEqual([]);
    expect(industryValue([], ["cyber"])).toBeNull();
    expect(industryValue(["cyber"], [])).toBeNull();
    expect(industryValue(["cyber"], ["cyber", "fintech"])).toBe(100);
    expect(industryValue(["gaming"], ["cyber"])).toBe(20);
  });
  it("company size: unknown = no data; mid is adjacent", () => {
    expect(companySizeValue(null, ["startup"])).toBeNull();
    expect(companySizeValue("startup", [])).toBeNull();
    expect(companySizeValue("startup", ["startup"])).toBe(100);
    expect(companySizeValue("mid", ["startup"])).toBe(50);
    expect(companySizeValue("enterprise", ["startup"])).toBe(0);
  });
  it("tech: overlap nudged by wanted/avoided; no stack = no data", () => {
    expect(techValue({ techStack: [], skillShare: 80, wanted: [], avoid: [] })).toBeNull();
    expect(techValue({ techStack: ["Go"], skillShare: null, wanted: [], avoid: [] })).toBeNull();
    expect(techValue({ techStack: ["Go", "React"], skillShare: 50, wanted: ["go"], avoid: [] })).toBe(60);
    expect(techValue({ techStack: ["PHP"], skillShare: 20, wanted: [], avoid: ["php"] })).toBe(0);
  });
});

describe("combined score", () => {
  it("missing data never penalizes: a job with no salary data scores the same as without the criterion", () => {
    const a = personalScore(base({ values: { salary: null, seniority: 100 } }));
    const b = personalScore(base({ values: { seniority: 100 }, off: ["salary"] }));
    expect(a.score).toBe(b.score);
    const row = a.criteria.find((c) => c.key === "salary")!;
    expect(row).toMatchObject({ on: true, value: null, points: 0 });
  });
  it("a bad criterion lowers and a good one raises the score", () => {
    const good = personalScore(base({ values: { salary: 100, seniority: 100 } }));
    const bad = personalScore(base({ values: { salary: 0, seniority: 100 } }));
    expect(good.score).toBeGreaterThan(bad.score);
  });
  it("all criteria off → score 0, nothing scored, nothing hidden", () => {
    const r = personalScore(
      base({ match: 90, values: { salary: 100, tech: 100 }, companyResponded: true, off: [...WEIGHT_KEYS] }),
    );
    expect(r.score).toBe(0);
    expect(r.hidden).toBe(false);
    expect(r.criteria.every((c) => !c.on && c.points === 0)).toBe(true);
    expect(r.reasons).toEqual([]);
  });
  it("breakdown lists every criterion and points add up to the score (±rounding)", () => {
    const r = personalScore(
      base({ match: 80, values: { salary: 60, seniority: 100, tech: 70, workMode: 50, referral: 100 } }),
    );
    expect(r.criteria.map((c) => c.key)).toEqual([...WEIGHT_KEYS]);
    const sum = r.criteria.reduce((a, c) => a + c.points, 0);
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(WEIGHT_KEYS.length);
  });
  it("importance changes the order", () => {
    const pay = { values: { salary: 100, tech: 0 } };
    const tech = { values: { salary: 0, tech: 100 } };
    const w = (k: "salary" | "tech") => ({
      ...DEFAULT_WEIGHTS,
      salary: k === "salary" ? 3 : 1,
      tech: k === "tech" ? 3 : 1,
    });
    expect(personalScore(base({ ...pay, weights: w("salary") })).score).toBeGreaterThan(
      personalScore(base({ ...tech, weights: w("salary") })).score,
    );
    expect(personalScore(base({ ...tech, weights: w("tech") })).score).toBeGreaterThan(
      personalScore(base({ ...pay, weights: w("tech") })).score,
    );
  });
});

describe("matchCore (no double counting)", () => {
  const m = { score: 78, parts: { skills: 40, role: 15, seniority: 20, location: 0, bonus: 3 } };
  it("is the full match when every split criterion is off", () => {
    expect(matchCore(m, true, () => false)).toBe(78);
  });
  it("is the role part only when tech/seniority/location/work model are on", () => {
    expect(matchCore(m, true, () => true)).toBe(100);
    expect(matchCore(m, false, () => true)).toBeNull();
  });
  it("adds back the part of a switched-off criterion", () => {
    expect(matchCore(m, true, (k) => k !== "tech")).toBe(Math.round(((15 + 43) / 65) * 100));
  });
});

describe("prefs", () => {
  it("defaults: every criterion on, empty preferences (derived from the profile)", () => {
    const p = normalizePrefs({});
    expect(p.off).toEqual([]);
    expect(p.weights).toEqual(DEFAULT_WEIGHTS);
    expect(criteriaJson(p)).toEqual({ off: [], salaryMin: null, industries: [], employment: [], companyTypes: [] });
  });
  it("reads the criteria Json column of a DB row and drops junk", () => {
    const p = normalizePrefs({
      include: [],
      exclude: [],
      weights: { salary: 3 },
      defaultSort: false,
      criteria: {
        off: ["domain", "domain"],
        salaryMin: 32000,
        industries: ["cyber", "cyber"],
        employment: ["FULL_TIME"],
      },
    });
    expect(p.off).toEqual(["domain"]);
    expect(p.salaryMin).toBe(32000);
    expect(p.industries).toEqual(["cyber"]);
    expect(p.weights.salary).toBe(3);
    expect(normalizePrefs({ criteria: { industries: ["nope"] } })).toEqual(EMPTY_PREFS);
  });
  it("has Hebrew and English names for every criterion", () => {
    for (const l of ["he", "en"] as const) {
      const s = rankingStrings(l);
      for (const k of WEIGHT_KEYS) {
        expect(s.weightNames[k]).toBeTruthy();
        expect(s.weightHelp[k]).toBeTruthy();
      }
    }
    expect(rankingStrings("he").noData).toBe("אין נתון");
    expect(rankingStrings("he").reset).toBe("אפס לברירת מחדל");
  });
});
