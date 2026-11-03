import { describe, expect, it } from "vitest";
import {
  compilePrefs,
  DEFAULT_WEIGHTS,
  excludedBy,
  keywordHit,
  normalizePrefs,
  personalScore,
  recencyPoints,
  splitKeywords,
  type PersonalInput,
  type RankJob,
} from "@/lib/ranking/personal";
import { parseSearchQuery } from "@/lib/search/query";
import { effectiveSort, needsScoring, parseFilters, SORTS } from "@/lib/jobs/filters";
import { rankingStrings, reasonText } from "@/lib/i18n/ranking";
import { jobSearchStrings } from "@/lib/i18n/job-search";

const now = new Date("2026-11-03T10:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const job = (over: Partial<RankJob> = {}): RankJob => ({
  id: "j1",
  title: "Senior Frontend Engineer",
  techStack: ["React", "TypeScript"],
  department: "R&D",
  postedAt: daysAgo(2),
  companyId: "c1",
  company: { name: "Acme" },
  ...over,
});
const parse = (q: string) => parseSearchQuery(q);
const input = (over: Partial<PersonalInput> & { prefs?: unknown } = {}): PersonalInput => {
  const prefs = normalizePrefs(over.prefs ?? {});
  const c = compilePrefs(prefs, parse);
  return {
    job: job(),
    match: 70,
    missingSkills: 1,
    include: c.include,
    exclude: c.exclude,
    inText: () => false,
    companyResponded: false,
    weights: prefs.weights,
    now,
    ...over,
  };
};

describe("normalizePrefs", () => {
  it("fills defaults and survives junk", () => {
    expect(normalizePrefs(null).weights).toEqual(DEFAULT_WEIGHTS);
    expect(normalizePrefs({ include: "nope" }).include).toEqual([]);
  });
  it("drops duplicates (case/space-insensitive) and words that are both wanted and excluded", () => {
    const p = normalizePrefs({
      include: [{ term: "React" }, { term: " react " }, { term: "Node", weight: 3, must: true }],
      exclude: ["PHP", "php", "node"],
      weights: { recency: 0 },
    });
    expect(p.include.map((k) => k.term)).toEqual(["React", "Node"]);
    expect(p.include[1]).toMatchObject({ weight: 3, must: true });
    expect(p.exclude).toEqual(["PHP"]);
    expect(p.weights).toEqual({ ...DEFAULT_WEIGHTS, recency: 0 });
  });
  it("rejects out-of-range weights", () => {
    expect(normalizePrefs({ include: [{ term: "x", weight: 9 }] }).include).toEqual([]);
  });
});

describe("splitKeywords", () => {
  it("splits on commas, semicolons and new lines, de-duplicated", () => {
    expect(splitKeywords("React, node;\n React ,גו")).toEqual(["React", "node", "גו"]);
  });
});

describe("keyword hits", () => {
  it("ranks the place: title > tech > company > description", () => {
    expect(keywordHit(parse("frontend"), job(), false)).toBe("title");
    expect(keywordHit(parse("typescript"), job(), false)).toBe("tech");
    expect(keywordHit(parse("acme"), job(), false)).toBe("company");
    expect(keywordHit(parse("graphql"), job(), true)).toBe("text");
    expect(keywordHit(parse("graphql"), job(), false)).toBeNull();
  });
  it("treats Hebrew and English as the same word (bilingual search, #67)", () => {
    expect(keywordHit(parse("ריאקט"), job(), false)).toBe("tech");
  });
  it("excludes only on title/tech/company/department, not description mentions", () => {
    expect(excludedBy(parse("senior"), job())).toBe(true);
    expect(excludedBy(parse("php"), job())).toBe(false);
  });
});

describe("personalScore", () => {
  it("hides jobs with an exclude word or a missing must-have", () => {
    expect(personalScore(input({ prefs: { exclude: ["Senior"] } }))).toMatchObject({
      hidden: true,
      excludedTerm: "Senior",
    });
    const r = personalScore(input({ prefs: { include: [{ term: "Python", must: true }] } }));
    expect(r.hidden).toBe(true);
    expect(r.reasons[0]).toEqual({ key: "mustMissing", term: "Python" });
  });

  it("keyword hits raise the score, title more than description", () => {
    const prefs = { include: [{ term: "frontend" }] };
    const base = personalScore(input()).score;
    const title = personalScore(input({ prefs })).score;
    const desc = personalScore(input({ prefs: { include: [{ term: "graphql" }] }, inText: () => true })).score;
    const none = personalScore(input({ prefs: { include: [{ term: "graphql" }] } })).score;
    expect(title).toBeGreaterThan(desc);
    expect(desc).toBeGreaterThan(none);
    expect(base).toBeGreaterThan(none); // no keywords → keyword part not counted at all
  });

  it("weights change the ordering; weight 0 ignores a part", () => {
    const old = { job: job({ postedAt: daysAgo(60) }) };
    const fresh = { job: job({ postedAt: daysAgo(1) }), match: 40 };
    const matchHeavy = { prefs: { weights: { match: 3, recency: 0, response: 0 } } };
    expect(personalScore(input({ ...old, ...matchHeavy })).score).toBeGreaterThan(
      personalScore(input({ ...fresh, ...matchHeavy })).score,
    );
    const recencyHeavy = { prefs: { weights: { match: 0, recency: 3, response: 0 } } };
    expect(personalScore(input({ ...fresh, ...recencyHeavy })).score).toBeGreaterThan(
      personalScore(input({ ...old, ...recencyHeavy })).score,
    );
  });

  it("likely-response: the company answered before + few gaps", () => {
    const a = personalScore(input({ companyResponded: true, missingSkills: 0 }));
    const b = personalScore(input({ companyResponded: false, missingSkills: 5 }));
    expect(a.parts.response).toBe(100);
    expect(b.parts.response).toBe(20); // fresh posting only
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.reasons.map((r) => r.key)).toEqual(expect.arrayContaining(["responded", "gaps", "match", "fresh"]));
  });

  it("works without a profile (match part dropped) and stays within 0..100", () => {
    const r = personalScore(input({ match: null, missingSkills: null }));
    expect(r.parts.match).toBeNull();
    expect(r.reasons.some((x) => x.key === "match")).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("reasons are sorted by points and keyword points add up to the keyword share", () => {
    const r = personalScore(input({ prefs: { include: [{ term: "frontend", weight: 3 }, { term: "react" }] } }));
    const pts = r.reasons.map((x) => ("points" in x ? x.points : 0));
    expect([...pts].sort((a, b) => b - a)).toEqual(pts);
    const kw = r.reasons.filter((x): x is Extract<typeof x, { key: "keyword" }> => x.key === "keyword");
    expect(kw[0]).toMatchObject({ term: "frontend", place: "title" });
    expect(kw[1]).toMatchObject({ term: "react", place: "tech" });
    expect(kw[0].points).toBeGreaterThan(kw[1].points);
  });

  it("recency buckets", () => {
    expect([0, 5, 10, 20, 90].map((d) => recencyPoints(daysAgo(d), now))).toEqual([100, 80, 55, 30, 10]);
  });
});

describe("personal sort", () => {
  it("is a sort key with Hebrew/English labels", () => {
    expect(SORTS).toContain("personal");
    expect(jobSearchStrings("he").sorts.personal).toBe("התאמה אישית");
    expect(jobSearchStrings("en").sorts.personal).toBe("Personal fit");
  });
  it("needs a signed-in user; default only when opted in and not searching", () => {
    const f = parseFilters({ sort: "personal" });
    expect(effectiveSort(f, true)).toBe("match");
    expect(effectiveSort(f, true, { personal: true })).toBe("personal");
    expect(effectiveSort(parseFilters({}), true, { personal: true })).toBe("match");
    expect(effectiveSort(parseFilters({}), false, { personal: true, personalDefault: true })).toBe("personal");
    expect(effectiveSort(parseFilters({ q: "react" }), true, { personal: true, personalDefault: true })).toBe(
      "relevance",
    );
    expect(effectiveSort(parseFilters({ sort: "newest" }), true, { personal: true, personalDefault: true })).toBe(
      "newest",
    );
    expect(needsScoring(parseFilters({}), true, { personal: true, personalDefault: true })).toBe(false);
  });
});

describe("reason texts", () => {
  it("renders every reason in Hebrew", () => {
    const s = rankingStrings("he");
    expect(reasonText({ key: "keyword", term: "React", place: "title", points: 10 }, s)).toBe("“React” בכותרת");
    expect(reasonText({ key: "fresh", days: 0, points: 5 }, s)).toBe("פורסמה היום");
    expect(reasonText({ key: "fresh", days: 3, points: 5 }, s)).toBe("פורסמה לפני 3 ימים");
    expect(reasonText({ key: "gaps", missing: 0, points: 5 }, s)).toBe("אין פערים בכישורים");
    expect(reasonText({ key: "match", score: 82, points: 40 }, s)).toBe("התאמה לפרופיל 82%");
  });
});
