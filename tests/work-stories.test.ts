import { describe, expect, it } from "vitest";
import { DATA_STRUCTURES } from "@/lib/algo/data-structures";
import { DS_INDUSTRY, industryFor, PATTERN_INDUSTRY } from "@/lib/algo/industry";
import { PATTERNS } from "@/lib/algo/patterns";
import {
  filledCount,
  isEmptyStory,
  polishPrompt,
  spokenSeconds,
  storyInputSchema,
  templateAnswer,
  validatePolish,
} from "@/lib/stories/story";

const fields = {
  situation: "Our search box fired a request on every keystroke and the API was overloaded",
  built: "a debounce on the input plus an LRU cache of recent queries in a Map",
  why: "a Map gives O(1) lookups and keeps insertion order for eviction",
  result: "requests dropped by 80% and results felt instant",
};

describe("industry content", () => {
  it("covers every data structure and every pattern", () => {
    for (const d of DATA_STRUCTURES) expect(industryFor("ds", d.id), d.id).toBeTruthy();
    for (const p of PATTERNS) expect(industryFor("pattern", p.id), p.id).toBeTruthy();
    expect(Object.keys(DS_INDUSTRY).length).toBe(DATA_STRUCTURES.length);
    expect(Object.keys(PATTERN_INDUSTRY).length).toBe(PATTERNS.length);
  });
  it("has bilingual uses with tools and a complete example per item", () => {
    for (const e of [...Object.values(DS_INDUSTRY), ...Object.values(PATTERN_INDUSTRY)]) {
      expect(e.uses.length).toBeGreaterThanOrEqual(2);
      for (const u of e.uses) {
        expect(u.text.he).toMatch(/[\u0590-\u05FF]/);
        expect(u.text.en.length).toBeGreaterThan(5);
        expect(u.tools.length).toBeGreaterThan(0);
      }
      for (const lang of ["he", "en"] as const)
        for (const k of ["situation", "built", "why", "result"] as const)
          expect(e.example[lang][k].length).toBeGreaterThan(5);
    }
  });
  it("returns null for unknown ids", () => {
    expect(industryFor("ds", "nope")).toBeFalsy();
  });
});

describe("story helpers", () => {
  it("detects empty / filled", () => {
    expect(isEmptyStory({ situation: " ", built: "", why: "", result: "" })).toBe(true);
    expect(isEmptyStory(null)).toBe(true);
    expect(filledCount({ situation: "x", built: "", why: "y", result: "" })).toBe(2);
  });
  it("validates input lengths and kinds", () => {
    expect(storyInputSchema.safeParse({ kind: "ds", itemId: "heap", ...fields }).success).toBe(true);
    expect(storyInputSchema.safeParse({ kind: "x", itemId: "heap", ...fields }).success).toBe(false);
    expect(storyInputSchema.safeParse({ kind: "ds", itemId: "heap", ...fields, why: "a".repeat(601) }).success).toBe(
      false,
    );
  });
  it("builds a template answer only from the user's words", () => {
    const en = templateAnswer(fields, "Hash map", "en");
    expect(en).toContain("Hash map");
    expect(en).toContain("80%");
    expect(en).toContain(fields.built);
    const he = templateAnswer({ ...fields, why: "" }, "Hash map", "he");
    expect(he).toMatch(/^כן, השתמשתי ב-Hash map/);
    expect(he).not.toContain("בחרתי");
  });
  it("estimates spoken seconds", () => {
    expect(spokenSeconds(Array(150).fill("w").join(" "))).toBe(60);
  });
  it("prompt forbids inventing facts and includes the notes", () => {
    const msgs = polishPrompt(fields, "Hash map", "ds", "he");
    expect(msgs[0].content).toMatch(/Never add numbers/);
    expect(msgs[1].content).toContain(fields.result);
    expect(msgs[1].content).toMatch(/Hebrew/);
  });
});

describe("validatePolish (no invented facts)", () => {
  const good =
    "Yes. Our search box fired a request on every keystroke, and the API was overloaded. I added a debounce on the input and an LRU cache of recent queries in a Map, because a Map gives constant-time lookups and keeps insertion order for eviction. Requests dropped by 80% and results felt instant.";
  it("accepts a faithful rephrase", () => {
    expect(validatePolish(good, fields, "Hash map")).toBe(good);
  });
  it("rejects new numbers", () => {
    expect(validatePolish(good.replace("80%", "80% for 2 million users"), fields, "Hash map")).toBeNull();
  });
  it("rejects new tool names", () => {
    expect(validatePolish(good.replace("in a Map", "in Redis"), fields, "Hash map")).toBeNull();
  });
  it("rejects too short output and strips markdown", () => {
    expect(validatePolish("Yes.", fields, "Hash map")).toBeNull();
    expect(validatePolish(`**${good}**`, fields, "Hash map")).toBe(good);
  });
  it("accepts Hebrew answers that keep the user's terms", () => {
    const he =
      "כן. תיבת החיפוש שלנו שלחה בקשה על כל הקשה והשרת קרס. הוספתי debounce וקאש LRU של שאילתות אחרונות ב-Map, כי זה נותן חיפוש מהיר ושומר על סדר ההכנסה. הבקשות ירדו ב-80% והתוצאות הרגישו מיידיות.";
    expect(validatePolish(he, fields, "Hash map")).toBe(he);
  });
});
