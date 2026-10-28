import { describe, expect, it } from "vitest";
import { parseSuggestion, suggestedBy } from "@/lib/discovery/suggest";
import { suggestCompanyStrings } from "@/lib/i18n/suggest-company";

describe("parseSuggestion", () => {
  it("normalizes the company site to its origin and domain", () => {
    expect(parseSuggestion("  ONE   City ", "onecity.co.il/careers")).toEqual({
      name: "ONE City",
      website: "https://onecity.co.il",
      domain: "onecity.co.il",
    });
    expect(parseSuggestion("Integrity", "https://www.integrity-software.co.il/jobs/")).toEqual({
      name: "Integrity",
      website: "https://www.integrity-software.co.il",
      domain: "integrity-software.co.il",
    });
  });
  it("rejects LinkedIn, Google, social links, other schemes and bad input", () => {
    expect(parseSuggestion("Acme", "https://www.linkedin.com/company/acme")).toBeNull();
    expect(parseSuggestion("Acme", "https://www.google.com/search?q=acme")).toBeNull();
    expect(parseSuggestion("Acme", "https://facebook.com/acme")).toBeNull();
    expect(parseSuggestion("Acme", "javascript:alert(1)")).toBeNull();
    expect(parseSuggestion("Acme", "ftp://acme.com")).toBeNull();
    expect(parseSuggestion("Acme", "not a url")).toBeNull();
    expect(parseSuggestion("A", "https://acme.com")).toBeNull();
    expect(parseSuggestion("Acme", "")).toBeNull();
    expect(parseSuggestion(null, null)).toBeNull();
  });
  it("tags suggestions with the user for rate limiting", () => {
    expect(suggestedBy("u1")).toBe("user:u1");
  });
  it("has the same strings in Hebrew and English", () => {
    expect(Object.keys(suggestCompanyStrings("en")).sort()).toEqual(Object.keys(suggestCompanyStrings("he")).sort());
  });
});
