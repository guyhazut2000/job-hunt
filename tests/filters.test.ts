import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  clearedFilters,
  compareJobs,
  effectiveSort,
  filtersToQuery,
  filtersToWhere,
  fitCompanies,
  needsScoring,
  parseFilters,
  sortToOrderBy,
  withoutValue,
} from "@/lib/jobs/filters";
import { splitLocations } from "@/lib/jobs/facets";
import { canUseAiReview } from "@/lib/billing";

describe("job filters: parsing", () => {
  it("drops invalid values from untrusted params", () => {
    const f = parseFilters({ role: "hacker", seniority: "GOD", workMode: "REMOTE", page: "-3", q: "  react " });
    expect(f).toMatchObject({ role: undefined, seniority: undefined, workMode: ["REMOTE"], page: 1, q: "react" });
  });
  it("accepts repeated keys and comma lists, de-duplicated, invalid dropped", () => {
    const f = parseFilters({ level: ["SENIOR", "LEAD,SENIOR", "BOSS"], fn: "data,engineering,nope", type: "CONTRACT" });
    expect(f.level).toEqual(["SENIOR", "LEAD"]);
    expect(f.fn).toEqual(["data", "engineering"]);
    expect(f.type).toEqual(["CONTRACT"]);
  });
  it("keeps legacy single-value links working", () => {
    const f = parseFilters({ location: "Haifa", company: "wix", seniority: "SENIOR" });
    expect(f.city).toEqual(["Haifa"]);
    expect(f.company).toEqual(["wix"]);
    expect(f.seniority).toBe("SENIOR");
  });
  it("validates posted / minMatch / fit / hide / sort", () => {
    expect(
      parseFilters({ posted: "7d", minMatch: "65", fit: "1", hide: ["applied", "x"], sort: "title" }),
    ).toMatchObject({ posted: "7d", minMatch: 65, fit: true, hide: ["applied"], sort: "title" });
    expect(parseFilters({ posted: "2y", minMatch: "66", fit: "yes", sort: "salary" })).toMatchObject({
      posted: undefined,
      minMatch: undefined,
      fit: undefined,
      sort: undefined,
    });
  });
  it("does not split free text on commas", () => {
    expect(parseFilters({ q: "node, react" }).q).toBe("node, react");
  });
});

describe("job filters: where clause", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("builds a prisma where clause", () => {
    const where = filtersToWhere(parseFilters({ role: "backend", tech: "Go", location: "Haifa" }));
    expect(where).toMatchObject({
      isActive: true,
      roleCategory: "backend",
      techStack: { has: "Go" },
      AND: [{ OR: [{ location: { contains: "Haifa", mode: "insensitive" } }] }],
    });
  });
  it("uses IN for multi-selects and OR for cities", () => {
    const where = filtersToWhere(
      parseFilters({
        fn: ["data", "qa"],
        level: "SENIOR",
        workMode: ["HYBRID", "REMOTE"],
        type: "FULL_TIME",
        company: ["a", "b"],
        city: ["Haifa", "Tel Aviv"],
      }),
    );
    expect(where).toMatchObject({
      jobFunction: { in: ["data", "qa"] },
      level: { in: ["SENIOR"] },
      workMode: { in: ["HYBRID", "REMOTE"] },
      employmentType: { in: ["FULL_TIME"] },
      company: { slug: { in: ["a", "b"] } },
    });
    expect(where.AND).toEqual([
      {
        OR: [
          { location: { contains: "Haifa", mode: "insensitive" } },
          { location: { contains: "Tel Aviv", mode: "insensitive" } },
        ],
      },
    ]);
  });
  it("parses and filters by job domain, dropping unknown values", () => {
    const f = parseFilters({ domain: ["devops", "hardware,bogus"] });
    expect(f.domain).toEqual(["devops", "hardware"]);
    expect(filtersToWhere(f).domain).toEqual({ in: ["devops", "hardware"] });
    expect(filtersToWhere(parseFilters({})).domain).toBeUndefined();
  });
  it("filters by posted window relative to now", () => {
    expect(filtersToWhere(parseFilters({ posted: "7d" }), { now }).postedAt).toEqual({
      gte: new Date("2026-10-20T12:00:00Z"),
    });
  });
  it("hides tracked jobs only for a signed-in user", () => {
    expect(filtersToWhere(parseFilters({ hide: "saved" })).applications).toBeUndefined();
    expect(filtersToWhere(parseFilters({ hide: "saved" }), { userId: "u1" }).applications).toEqual({
      none: { userId: "u1" },
    });
    expect(filtersToWhere(parseFilters({ hide: "applied" }), { userId: "u1" }).applications).toMatchObject({
      none: { userId: "u1", status: { in: expect.not.arrayContaining(["SAVED"]) } },
    });
  });
  it("combines text search with the city OR", () => {
    const where = filtersToWhere(parseFilters({ q: "react", city: "Haifa" }));
    expect(where.AND).toHaveLength(2);
  });
});

describe("job sorting", () => {
  it("defaults to best match only with a profile", () => {
    expect(effectiveSort(parseFilters({}), true)).toBe("match");
    expect(effectiveSort(parseFilters({}), false)).toBe("newest");
    expect(effectiveSort(parseFilters({ sort: "match" }), false)).toBe("newest");
    expect(effectiveSort(parseFilters({ sort: "title" }), true)).toBe("title");
  });
  it("needs in-memory scoring only for match-based requests", () => {
    expect(needsScoring(parseFilters({}), true)).toBe(true);
    expect(needsScoring(parseFilters({ sort: "newest" }), true)).toBe(false);
    expect(needsScoring(parseFilters({ sort: "newest", minMatch: "50" }), true)).toBe(true);
    expect(needsScoring(parseFilters({ fit: "1" }), false)).toBe(false);
  });
  it("maps sorts to stable DB orderings", () => {
    expect(sortToOrderBy("newest")).toEqual([{ postedAt: "desc" }, { id: "asc" }]);
    expect(sortToOrderBy("updated")[0]).toEqual({ sourceUpdatedAt: { sort: "desc", nulls: "last" } });
    expect(sortToOrderBy("company")[0]).toEqual({ company: { name: "asc" } });
    expect(sortToOrderBy("title")).toEqual([{ title: "asc" }, { id: "asc" }]);
  });
  const mk = (id: string, score: number, name: string, title: string, posted: string, updated?: string) => ({
    score,
    job: {
      id,
      title,
      postedAt: new Date(posted),
      sourceUpdatedAt: updated ? new Date(updated) : null,
      company: { name },
    },
  });
  const rows = [
    mk("a", 60, "Wix", "Backend", "2026-10-01", "2026-10-25"),
    mk("b", 90, "Monday", "Data", "2026-10-20"),
    mk("c", 90, "Amdocs", "Analyst", "2026-10-22"),
  ];
  const order = (s: Parameters<typeof compareJobs>[0]) => [...rows].sort(compareJobs(s)).map((r) => r.job.id);
  it("sorts in memory consistently with the DB orderings", () => {
    expect(order("match")).toEqual(["c", "b", "a"]);
    expect(order("newest")).toEqual(["c", "b", "a"]);
    expect(order("updated")).toEqual(["a", "c", "b"]);
    expect(order("company")).toEqual(["c", "b", "a"]);
    expect(order("title")).toEqual(["c", "a", "b"]);
  });
});

describe("companies that fit", () => {
  it("keeps companies whose best role clears the threshold, best first", () => {
    const fits = fitCompanies(
      [
        { score: 80, job: { companyId: "x" } },
        { score: 40, job: { companyId: "x" } },
        { score: 66, job: { companyId: "y" } },
        { score: 64, job: { companyId: "z" } },
      ],
      65,
    );
    expect(fits).toEqual([
      { companyId: "x", best: 80, count: 1 },
      { companyId: "y", best: 66, count: 1 },
    ]);
  });
});

describe("filter URLs & chips", () => {
  it("serializes back to a query string without defaults", () => {
    expect(filtersToQuery({ role: "qa", page: 1 })).toBe("?role=qa");
    expect(filtersToQuery({ page: 2 })).toBe("?page=2");
  });
  it("round-trips arrays, booleans and sort", () => {
    const f = parseFilters({ level: ["SENIOR", "LEAD"], fit: "1", sort: "updated", city: "Tel Aviv" });
    const qs = filtersToQuery(f);
    expect(qs).toBe("?level=SENIOR&level=LEAD&city=Tel+Aviv&fit=1&sort=updated");
    expect(parseFilters(Object.fromEntries(groupParams(new URLSearchParams(qs))))).toEqual(f);
  });
  it("removes a single chip value and resets the page", () => {
    const f = parseFilters({ level: ["SENIOR", "LEAD"], page: "3", posted: "7d" });
    expect(withoutValue(f, "level", "SENIOR")).toMatchObject({ level: ["LEAD"], page: 1, posted: "7d" });
    expect(withoutValue(f, "posted")).toMatchObject({ posted: undefined, level: ["SENIOR", "LEAD"] });
  });
  it("clear-all keeps the sort", () => {
    const f = parseFilters({ level: "SENIOR", sort: "title", q: "x" });
    expect(filtersToQuery(clearedFilters(f))).toBe("?sort=title");
  });
  it("counts active filters but not sort/page", () => {
    expect(activeFilterCount(parseFilters({ level: ["SENIOR", "LEAD"], q: "x", sort: "title", page: "2" }))).toBe(3);
  });
});

describe("location facets", () => {
  it("splits multi-city locations and drops country-only values", () => {
    expect(splitLocations(["Herzliya / Tel Aviv", "Tel Aviv, Israel", "Israel", "Haifa"])).toEqual([
      ["Tel Aviv", 2],
      ["Haifa", 1],
      ["Herzliya", 1],
    ]);
  });
});

describe("billing", () => {
  it("limits free AI reviews", () => {
    expect(canUseAiReview("FREE", 2)).toBe(true);
    expect(canUseAiReview("FREE", 3)).toBe(false);
    expect(canUseAiReview("PRO", 999)).toBe(true);
  });
});

function groupParams(sp: URLSearchParams): [string, string[]][] {
  const m = new Map<string, string[]>();
  for (const [k, v] of sp) m.set(k, [...(m.get(k) ?? []), v]);
  return [...m.entries()];
}
