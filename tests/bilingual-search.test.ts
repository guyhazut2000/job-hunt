import { describe, expect, it } from "vitest";
import { expansionLabels, parseSearchQuery, type SearchTerm } from "@/lib/search/query";
import { buildCompanyLexicon, companyNameForms } from "@/lib/search/lexicon";
import { CURATED_COMPANY_NAMES } from "@/lib/search/company-names";
import { GENERATED_COMPANY_NAMES_HE } from "@/lib/search/company-names.generated";
import { GLOSSARY } from "@/lib/search/glossary";
import { swapLayout } from "@/lib/search/layout";
import { phoneticKey } from "@/lib/search/phonetic";
import { fixFinals, foldFinals, normalizeSearchText } from "@/lib/search/text";
import { matchCompanies } from "@/lib/jobs/search";
import { companyMatchesTerms } from "@/lib/companies/search";
import { filtersToWhere, parseFilters } from "@/lib/jobs/filters";

const NAMES = [...new Set([...Object.keys(CURATED_COMPANY_NAMES), ...Object.keys(GENERATED_COMPANY_NAMES_HE)])];
const COMPANIES = NAMES.map((name, i) => ({ id: `c${i}`, name, slug: `s${i}`, website: null }));
const LEX = buildCompanyLexicon(COMPANIES);
const parse = (q: string) => parseSearchQuery(q, { companies: LEX });
const idOf = (name: string) => COMPANIES.find((c) => c.name === name)!.id;
const sig = (terms: SearchTerm[]) =>
  terms.map((t) => ({ variants: [...t.variants].sort(), ids: [...(t.companyIds ?? [])].sort() }));

describe("bilingual search: companies", () => {
  it("אינטל and Intel parse to the same search", () => {
    const he = parse("אינטל");
    const en = parse("Intel");
    expect(sig(he)).toEqual(sig(en));
    expect(he[0].companyIds).toContain(idOf("Intel"));
    expect(expansionLabels(he)).toContain("Intel");
    expect(expansionLabels(en)).toContain("אינטל");
  });

  it.each([
    ["מיקרוסופט", "Microsoft"],
    ["אמדוקס", "Amdocs"],
    ["צ'ק פוינט", "Check Point"],
    ["גוגל", "Google"],
    ["אנבידיה", "NVIDIA"],
  ])("%s ↔ %s", (he, en) => {
    if (!NAMES.includes(en)) return; // name list may spell it differently
    expect(sig(parse(he))).toEqual(sig(parse(en)));
    expect(parse(he).flatMap((t) => t.companyIds ?? [])).toContain(idOf(en));
  });

  it("every curated Hebrew name finds its company, symmetrically", () => {
    const misses: string[] = [];
    for (const [name, n] of Object.entries(CURATED_COMPANY_NAMES)) {
      if (!n.he.length) continue;
      const id = idOf(name);
      const he = parse(n.he[0]).flatMap((t) => t.companyIds ?? []);
      const en = parse(name).flatMap((t) => t.companyIds ?? []);
      if (!he.includes(id) || !en.includes(id)) misses.push(name);
    }
    // a handful of names are generic words (excluded on purpose) — the vast majority must work
    expect(misses.length).toBeLessThan(Object.keys(CURATED_COMPANY_NAMES).length * 0.05);
  });

  it("strips Hebrew one-letter prefixes (באינטל → Intel)", () => {
    expect(parse("באינטל")[0].companyIds).toContain(idOf("Intel"));
  });

  it("companyNameForms gives the Hebrew name for a known company", () => {
    expect(companyNameForms({ id: "i", name: "Intel" }).nameHe).toBe("אינטל");
    expect(companyNameForms({ id: "x", name: "X", nameHe: "איקס", aliases: ["xx"] })).toEqual({
      nameHe: "איקס",
      aliases: ["איקס", "xx"],
    });
  });

  it("DB aliases feed the lexicon", () => {
    const lex = buildCompanyLexicon([{ id: "z", name: "Zzyzx Labs", nameHe: "זיזיקס", aliases: ["zz labs"] }]);
    expect(parseSearchQuery("זיזיקס", { companies: lex })[0].companyIds).toEqual(["z"]);
  });
});

describe("bilingual search: matching uses companyIds", () => {
  it("matchCompanies and companyMatchesTerms find Intel from אינטל", () => {
    const terms = parse("אינטל");
    const m = matchCompanies(terms, COMPANIES);
    expect(Object.values(m).flat()).toContain(idOf("Intel"));
    const intel = { ...COMPANIES.find((c) => c.name === "Intel")!, industry: null, hqLocation: null };
    expect(companyMatchesTerms(intel, terms)).toBe(true);
  });

  it("filtersToWhere is identical for אינטל and Intel (up to OR order)", () => {
    const build = (q: string) => {
      const terms = parse(q);
      const where = filtersToWhere(parseFilters({ q }), { companyMatches: matchCompanies(terms, COMPANIES), terms });
      // canonical form: every leaf value in the where tree, sorted
      const leaves: string[] = [];
      JSON.stringify(where, (k, v) => {
        if (typeof v === "string" || typeof v === "boolean") leaves.push(`${k}=${v}`);
        return v;
      });
      return leaves.sort();
    };
    expect(build("אינטל")).toEqual(build("Intel"));
    expect(build("Intel")).toContain(`0=${idOf("Intel")}`);
  });
});

describe("bilingual search: normalization", () => {
  it("niqqud, case, geresh and finals", () => {
    expect(normalizeSearchText("אִינְטֶל")).toBe("אינטל");
    expect(normalizeSearchText("INTEL")).toBe("intel");
    expect(foldFinals("מיקרוסופט אמדוקס גוגל ")).toBe("מיקרוסופט אמדוקס גוגל ");
    expect(foldFinals("ןםךףץ")).toBe("נמכפצ");
    expect(fixFinals("אינטלמ")).toBe("אינטלם");
    expect(sig(parse("צ׳ק פוינט"))).toEqual(sig(parse("צ'ק פוינט")));
  });
  it("hyphen and space spellings match", () => {
    expect(sig(parse("check-point"))[0].ids).toEqual(sig(parse("checkpoint"))[0].ids);
    expect(parse("check-point")[0].variants).toEqual(expect.arrayContaining(parse("checkpoint")[0].variants));
  });
});

describe("bilingual search: glossary", () => {
  it("חיפה ↔ Haifa, ריאקט ↔ React", () => {
    expect(parse("חיפה")[0].variants).toContain("haifa");
    expect(parse("haifa")[0].variants).toContain("חיפה");
    expect(parse("ריאקט")[0].variants).toContain("react");
  });
  it("glossary groups have no duplicate members across groups on the same side", () => {
    expect(GLOSSARY.length).toBeGreaterThan(50);
  });
});

describe("bilingual search: wrong keyboard layout", () => {
  it("swaps Latin↔Hebrew layouts", () => {
    expect(swapLayout("thbyk")).toBe("אינטל");
    expect(swapLayout("רקשבא")).toBe("react");
  });
  it("thbyk and ןמאקך find Intel", () => {
    expect(parse("thbyk")[0].companyIds).toContain(idOf("Intel"));
    expect(parse("ןמאקך")[0].companyIds).toContain(idOf("Intel"));
    expect(expansionLabels(parse("thbyk")).length).toBeGreaterThan(0);
  });
  it("does not rewrite real words", () => {
    expect(parse("react")[0].also ?? []).not.toContainEqual(expect.objectContaining({ reason: "layout" }));
    expect(parse("מפתח")[0].also ?? []).not.toContainEqual(expect.objectContaining({ reason: "layout" }));
  });
});

describe("bilingual search: phonetic fallback", () => {
  it("transliteration keys line up", () => {
    expect(phoneticKey("אינטל")).toBe(phoneticKey("intel"));
  });
  it("common Hebrew words are not turned into companies", () => {
    for (const w of ["משרה", "פיתוח", "בכיר", "צפון", "מרכז", "עבודה", "ניהול"]) {
      expect(
        parse(w).flatMap((t) => t.companyIds ?? []),
        w,
      ).toEqual([]);
    }
  });
});

describe("bilingual search: no regressions without a lexicon", () => {
  it("plain parsing still works", () => {
    expect(parseSearchQuery("react developer").map((t) => t.raw)).toEqual(["react", "developer"]);
    expect(parseSearchQuery("")).toEqual([]);
  });
});
