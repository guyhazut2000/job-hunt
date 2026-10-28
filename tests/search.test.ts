import { describe, expect, it } from "vitest";
import {
  highlightSegments,
  highlightTerms,
  MAX_TERMS,
  normalizeSearchText,
  parseSearchQuery,
} from "@/lib/search/query";
import { domainOf, matchCompanies, rankJob, searchWhere, techTagsFor } from "@/lib/jobs/search";
import { companyMatchesTerms } from "@/lib/companies/search";
import { compareJobs, effectiveSort, filtersToWhere, parseFilters } from "@/lib/jobs/filters";

const raws = (q: string) => parseSearchQuery(q).map((t) => t.raw);
const variants = (q: string) => parseSearchQuery(q).flatMap((t) => t.variants);

describe("search: Hebrew/English normalization", () => {
  it("lowercases, strips Latin diacritics and collapses whitespace", () => {
    expect(normalizeSearchText("  Café   DevOps\tEngineer ")).toBe("cafe devops engineer");
    expect(normalizeSearchText("Zürich NAÏVE")).toBe("zurich naive");
  });
  it("strips niqqud and cantillation, keeps letters", () => {
    expect(normalizeSearchText("מְפַתֵּחַ")).toBe("מפתח");
    expect(normalizeSearchText("שָׁלוֹם")).toBe("שלום");
  });
  it("unifies geresh/gershayim/curly quotes and maqaf", () => {
    expect(normalizeSearchText("ג׳וניור")).toBe("ג'וניור");
    expect(normalizeSearchText("ג’וניור")).toBe("ג'וניור");
    expect(normalizeSearchText("מנכ״ל")).toBe('מנכ"ל');
    expect(normalizeSearchText("פול־סטאק")).toBe("פול-סטאק");
  });
});

describe("search: query parsing", () => {
  it("returns no terms for empty or punctuation-only input", () => {
    expect(parseSearchQuery(undefined)).toEqual([]);
    expect(parseSearchQuery("   ")).toEqual([]);
    expect(parseSearchQuery("- , !")).toEqual([]);
  });
  it("splits words, de-duplicates and drops one-letter noise but keeps c# / c++", () => {
    expect(raws("DevOps devops a Kubernetes")).toEqual(["devops", "kubernetes"]);
    expect(raws("c# c++ node.js")).toEqual(["c#", "c++", "node.js"]);
  });
  it("keeps quoted phrases and known multi-word Hebrew phrases together", () => {
    expect(raws('"site reliability" aws')).toEqual(["site reliability", "aws"]);
    expect(raws("דבאופס בתל אביב")).toEqual(["תל אביב", "דבאופס"]);
  });
  it("expands Hebrew roles and cities to their English equivalents", () => {
    expect(variants("דבאופס")).toContain("devops");
    expect(variants("תל אביב")).toContain("tel aviv");
    expect(variants("מפתח")).toEqual(expect.arrayContaining(["developer", "engineer"]));
  });
  it("strips a one-letter Hebrew prefix only for known words", () => {
    expect(variants("בחיפה")).toEqual(expect.arrayContaining(["חיפה", "haifa"]));
    // An unknown word starting with ב is left alone (no blind stripping).
    expect(variants("בננות")).toEqual(["בננות"]);
  });
  it("adds both apostrophe spellings for geresh words", () => {
    expect(variants("ג׳וניור")).toEqual(expect.arrayContaining(["ג'וניור", "ג׳וניור"]));
  });
  it("caps the number of terms and the query length", () => {
    expect(parseSearchQuery("aa bb cc dd ee ff gg hh")).toHaveLength(MAX_TERMS);
    expect(parseSearchQuery("x".repeat(500))[0].raw).toHaveLength(100);
  });
  it("highlight terms are unique, ≥2 chars, longest first", () => {
    const h = highlightTerms(parseSearchQuery("דבאופס devops"));
    expect(h[0].length).toBeGreaterThanOrEqual(h[h.length - 1].length);
    expect(new Set(h).size).toBe(h.length);
  });
});

describe("search: Prisma where builder", () => {
  it("emits one AND clause per term with case-insensitive ORs over every field", () => {
    const where = searchWhere(parseSearchQuery("devops haifa"));
    expect(where).toHaveLength(2);
    const or = where[0].OR!;
    for (const field of ["title", "location", "department", "description"])
      expect(or).toContainEqual({ [field]: { contains: "devops", mode: "insensitive" } });
    expect(or).toContainEqual({ company: { name: { contains: "devops", mode: "insensitive" } } });
  });
  it("matches canonical tech tags and pre-resolved company ids", () => {
    const terms = parseSearchQuery("kubernetes monday");
    expect(techTagsFor(terms[0])).toEqual(["Kubernetes"]);
    const where = searchWhere(terms, { kubernetes: [], monday: ["c1"] });
    expect(where[0].OR).toContainEqual({ techStack: { hasSome: ["Kubernetes"] } });
    expect(where[1].OR).toContainEqual({ companyId: { in: ["c1"] } });
    // Pre-resolved: no relational company filter (keeps the OR index-friendly).
    expect(JSON.stringify(where)).not.toContain('"company"');
  });
  it("combines with the other filters through filtersToWhere", () => {
    const f = parseFilters({ q: "devops", level: "SENIOR" });
    const where = filtersToWhere(f, { companyMatches: { devops: [] } });
    expect(JSON.stringify(where)).toContain("devops");
    expect(JSON.stringify(where)).toContain("SENIOR");
  });
});

describe("search: companies", () => {
  const companies = [
    { id: "c1", name: "monday.com", website: "https://www.monday.com" },
    { id: "c2", name: "Wix", website: "https://wix.com" },
    { id: "c3", name: "Mondelez", website: null },
  ];
  it("resolves companies by name or domain", () => {
    expect(domainOf("https://www.monday.com/careers")).toBe("monday.com");
    expect(domainOf("wix.com")).toBe("wix.com");
    expect(domainOf("")).toBeNull();
    expect(matchCompanies(parseSearchQuery("monday"), companies)).toEqual({ monday: ["c1"] });
    expect(matchCompanies(parseSearchQuery("wix.com"), companies)).toEqual({ "wix.com": ["c2"] });
  });
  it("company page search covers name, domain, field, HQ and ATS (all terms required)", () => {
    const c = {
      name: "Snyk",
      website: "https://snyk.io",
      industry: "Cybersecurity",
      hqLocation: "Tel Aviv",
      atsProvider: "GREENHOUSE",
    };
    expect(companyMatchesTerms(c, parseSearchQuery("snyk.io"))).toBe(true);
    expect(companyMatchesTerms(c, parseSearchQuery("greenhouse"))).toBe(true);
    expect(companyMatchesTerms(c, parseSearchQuery("תל אביב cyber"))).toBe(true);
    expect(companyMatchesTerms(c, parseSearchQuery("snyk haifa"))).toBe(false);
    expect(companyMatchesTerms(c, [])).toBe(true);
  });
});

describe("search: relevance ranking", () => {
  const job = (id: string, title: string, company: string, techStack: string[] = [], location = "Tel Aviv") => ({
    id,
    title,
    location,
    department: null,
    techStack,
    company: { name: company },
    postedAt: new Date("2026-10-01"),
  });
  it("ranks title > company > skills > location > description-only", () => {
    const terms = parseSearchQuery("devops");
    const jobs = [
      job("desc", "Backend Engineer", "Acme"),
      job("tech", "Platform Engineer", "Acme", ["DevOps"]),
      job("title", "Senior DevOps Engineer", "Acme"),
      job("company", "Engineer", "DevOps Inc"),
    ];
    const order = jobs
      .map((j) => ({ job: j, score: 0, rank: rankJob(j, terms) }))
      .sort(compareJobs("relevance"))
      .map((x) => x.job.id);
    expect(order).toEqual(["title", "company", "tech", "desc"]);
  });
  it("prefers whole words and titles starting with the term", () => {
    const terms = parseSearchQuery("data");
    expect(rankJob(job("a", "Data Engineer", "X"), terms)).toBeGreaterThan(
      rankJob(job("b", "Big Data Engineer", "X"), terms),
    );
    expect(rankJob(job("b", "Big Data Engineer", "X"), terms)).toBeGreaterThan(
      rankJob(job("c", "Metadata Engineer", "X"), terms),
    );
  });
  it("matches Hebrew queries against English titles via synonyms", () => {
    expect(rankJob(job("a", "DevOps Engineer", "X"), parseSearchQuery("דבאופס"))).toBeGreaterThanOrEqual(100);
  });
  it("defaults to relevance sort only while searching", () => {
    expect(effectiveSort(parseFilters({ q: "devops" }), true)).toBe("relevance");
    expect(effectiveSort(parseFilters({ q: "devops", sort: "newest" }), true)).toBe("newest");
    expect(effectiveSort(parseFilters({ sort: "relevance" }), false)).toBe("newest");
    expect(effectiveSort(parseFilters({ sort: "relevance" }), true)).toBe("match");
  });
});

describe("search: highlighting", () => {
  const marked = (text: string, q: string) =>
    highlightSegments(text, highlightTerms(parseSearchQuery(q)))
      .filter((s) => s.hit)
      .map((s) => s.text);
  it("marks case-insensitive hits and keeps the original text intact", () => {
    const segs = highlightSegments("Senior DevOps Engineer", ["devops"]);
    expect(segs.map((s) => s.text).join("")).toBe("Senior DevOps Engineer");
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(["DevOps"]);
  });
  it("handles diacritics, niqqud and Hebrew synonyms", () => {
    expect(marked("Café Lead", "cafe")).toEqual(["Café"]);
    expect(marked("מְפַתֵּחַ בכיר", "מפתח")).toEqual(["מְפַתֵּחַ"]);
    expect(marked("DevOps Engineer", "דבאופס")).toEqual(["DevOps"]);
  });
  it("returns a single plain segment without terms", () => {
    expect(highlightSegments("abc", [])).toEqual([{ text: "abc", hit: false }]);
  });
});
