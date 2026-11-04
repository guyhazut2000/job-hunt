import { describe, expect, it } from "vitest";
import { pageItems, parseShow, showHref } from "@/lib/ui/paging";
import { countToInclude, matchesQuery, nextBatch, revealMore, visibleWithPinned } from "@/lib/ui/show-more";
import { fillD, densityStrings } from "@/lib/i18n/density";

describe("parseShow", () => {
  it("defaults to one batch and rounds up to whole batches", () => {
    expect(parseShow(undefined, 300, 24)).toBe(24);
    expect(parseShow("30", 300, 24)).toBe(48);
    expect(parseShow(["72", "5"], 300, 24)).toBe(72);
  });
  it("clamps junk, negatives and huge numbers", () => {
    expect(parseShow("abc", 300, 24)).toBe(24);
    expect(parseShow("-5", 300, 24)).toBe(24);
    expect(parseShow("999999", 300, 24)).toBe(312);
    expect(parseShow("999999", 0, 24)).toBe(24);
  });
});

describe("pageItems", () => {
  const all = Array.from({ length: 50 }, (_, i) => i);
  it("slices and reports the next batch", () => {
    const p = pageItems(all, 24, 24);
    expect(p.items).toHaveLength(24);
    expect(p).toMatchObject({ shown: 24, total: 50, nextShow: 48 });
  });
  it("has no next batch on the last page", () => {
    const p = pageItems(all, 72, 24);
    expect(p).toMatchObject({ shown: 50, total: 50, nextShow: null });
    expect(p.items.at(-1)).toBe(49);
  });
});

describe("showHref", () => {
  it("keeps other params and drops show on the first batch", () => {
    expect(showHref("/companies/x", { tab: "jobs", show: "48" }, 24, 24)).toBe("/companies/x?tab=jobs");
    expect(showHref("/companies/x", { tab: "jobs" }, 48, 24, { hash: "jobs" })).toBe(
      "/companies/x?tab=jobs&show=48#jobs",
    );
  });
  it("supports a custom key and repeated params", () => {
    expect(showHref("/n", { f: ["a", "b"], more: "2" }, 60, 30, { key: "more" })).toBe("/n?f=a&f=b&more=60");
  });
});

describe("show more", () => {
  it("reveals in steps without passing the total", () => {
    expect(revealMore(20, 67, 20)).toBe(40);
    expect(revealMore(60, 67, 20)).toBe(67);
    expect(nextBatch(60, 67, 20)).toBe(7);
    expect(nextBatch(67, 67, 20)).toBe(0);
    expect(nextBatch(0, 5, 0)).toBe(1);
  });
  it("keeps pinned items visible in order", () => {
    const items = ["a", "b", "c", "d", "e"];
    const r = visibleWithPinned(items, 2, (x) => x === "d");
    expect(r.visible).toEqual(["a", "b", "d"]);
    expect(r.hidden).toBe(2);
  });
  it("finds the count that includes a deep-linked index", () => {
    expect(countToInclude(3, 5, 10)).toBe(5);
    expect(countToInclude(5, 5, 10)).toBe(15);
    expect(countToInclude(24, 5, 10)).toBe(25);
  });
  it("matches every word, case-insensitive", () => {
    expect(matchesQuery("Senior Backend · Stress Co 1", "stress back")).toBe(true);
    expect(matchesQuery("Senior Backend", "frontend")).toBe(false);
    expect(matchesQuery("anything", "  ")).toBe(true);
  });
});

describe("density strings", () => {
  it("has Hebrew and English with the same keys", () => {
    expect(Object.keys(densityStrings("he"))).toEqual(Object.keys(densityStrings("en")));
    expect(fillD(densityStrings("he").showing, { shown: 20, total: 300 })).toBe("מוצגים 20 מתוך 300");
  });
});
