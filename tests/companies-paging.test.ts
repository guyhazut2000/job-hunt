import { describe, expect, it } from "vitest";
import { groupByLetter } from "@/lib/alpha";
import { COMPANIES_PAGE_SIZE as N, companiesHref, pageGroups, parseShow } from "@/lib/companies/paging";

const names = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(3, "0")}`);

describe("parseShow", () => {
  it("defaults to one batch and rounds up to whole batches", () => {
    expect(parseShow(undefined, 900)).toBe(N);
    expect(parseShow("", 900)).toBe(N);
    expect(parseShow("1", 900)).toBe(N);
    expect(parseShow(String(N + 1), 900)).toBe(2 * N);
    expect(parseShow([String(2 * N), "5"], 900)).toBe(2 * N);
  });
  it("clamps junk, negatives and huge values", () => {
    expect(parseShow("abc", 900)).toBe(N);
    expect(parseShow("-50", 900)).toBe(N);
    expect(parseShow("999999", 100)).toBe(Math.ceil(100 / N) * N);
    expect(parseShow("999999", 0)).toBe(N);
  });
});

describe("pageGroups", () => {
  const groups = groupByLetter([...names(30, "A"), ...names(30, "B"), ...names(30, "אבג")], (x) => x);

  it("cuts after `show` cards, keeping a partial section", () => {
    const p = pageGroups(groups, N);
    expect(p.total).toBe(90);
    expect(p.shown).toBe(N);
    expect(p.groups.map((g) => [g.letter, g.items.length])).toEqual([
      ["A", 30],
      ["B", N - 30],
    ]);
    expect(p.nextShow).toBe(2 * N);
  });

  it("has no next batch once everything is shown", () => {
    const p = pageGroups(groups, 2 * N);
    expect(p.shown).toBe(90);
    expect(p.nextShow).toBeNull();
    expect(p.groups.flatMap((g) => g.items)).toHaveLength(90);
  });

  it("knows how many to load so a letter's whole section renders", () => {
    const p = pageGroups(groups, N);
    expect(p.showFor.get("A")).toBe(N);
    expect(p.showFor.get("B")).toBe(2 * N);
    expect(p.showFor.get("א")).toBe(2 * N);
  });

  it("works for an empty list", () => {
    const p = pageGroups([], N);
    expect(p).toMatchObject({ total: 0, shown: 0, nextShow: null, groups: [] });
  });
});

describe("companiesHref", () => {
  it("keeps filter + search, drops the default batch and 'all'", () => {
    expect(companiesHref({})).toBe("/companies");
    expect(companiesHref({ sync: "all", show: N })).toBe("/companies");
    expect(companiesHref({ sync: "manual", q: "אינטל", show: 2 * N })).toBe(
      `/companies?sync=manual&q=${encodeURIComponent("אינטל")}&show=${2 * N}`,
    );
    expect(companiesHref({ show: 3 * N, hash: "letter-he-1" })).toBe(`/companies?show=${3 * N}#letter-he-1`);
  });
});
