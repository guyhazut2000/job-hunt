import { describe, expect, it } from "vitest";
import { buildFilterQuery, CHOICE_DELAY, delayFor, sameQuery, TYPING_DELAY } from "@/lib/jobs/filter-query";

describe("buildFilterQuery", () => {
  const owned = ["posted", "city", "role", "sort", "q"];
  it("replaces the form's own fields and keeps the rest of the URL", () => {
    const q = buildFilterQuery("?sort=personal&posted=1d&view=map&city=Haifa", owned, [
      ["sort", "personal"],
      ["posted", "3d"],
      ["city", "Tel Aviv"],
      ["city", "Haifa"],
    ]);
    expect(q).toBe("?view=map&sort=personal&posted=3d&city=Tel+Aviv&city=Haifa");
  });
  it("drops empty values and resets pagination", () => {
    expect(
      buildFilterQuery("?page=4&posted=1d", owned, [
        ["posted", ""],
        ["role", ""],
      ]),
    ).toBe("");
    expect(buildFilterQuery("?page=2", owned, [["role", "BACKEND"]])).toBe("?role=BACKEND");
  });
  it("de-duplicates a value submitted twice", () => {
    expect(
      buildFilterQuery(
        "",
        ["company"],
        [
          ["company", "acme"],
          ["company", "acme"],
        ],
      ),
    ).toBe("?company=acme");
  });
});

describe("sameQuery", () => {
  it("ignores order, empty values and the page", () => {
    expect(sameQuery("?a=1&b=2", "b=2&a=1&page=3&c=")).toBe(true);
    expect(sameQuery("?a=1", "?a=2")).toBe(false);
    expect(sameQuery("", "?")).toBe(true);
  });
});

describe("delayFor", () => {
  it("waits longer for typing than for a click", () => {
    expect(delayFor({ tagName: "INPUT", type: "search" })).toBe(TYPING_DELAY);
    expect(delayFor({ tagName: "INPUT", type: "checkbox" })).toBe(CHOICE_DELAY);
    expect(delayFor({ tagName: "SELECT" })).toBe(CHOICE_DELAY);
    expect(CHOICE_DELAY).toBeGreaterThanOrEqual(600);
    expect(TYPING_DELAY).toBeLessThanOrEqual(800);
  });
});
