import { describe, expect, it } from "vitest";
import { BOT_PROTECTED, ESTABLISHED_MANUAL, ESTABLISHED_SOURCES } from "@/lib/companies/established";
import { MANUAL_COMPANIES } from "@/lib/companies/manual";
import { JOB_SOURCES } from "@/lib/ingestion/sources";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";

describe("established employers", () => {
  const all = [...ESTABLISHED_MANUAL, ...ESTABLISHED_SOURCES];
  it("are merged into the manual and automatic lists", () => {
    const manual = new Set(MANUAL_COMPANIES.map((c) => c.slug));
    const auto = new Set(JOB_SOURCES.map((s) => s.slug));
    for (const c of ESTABLISHED_MANUAL) expect(manual.has(c.slug), c.slug).toBe(true);
    for (const s of ESTABLISHED_SOURCES) expect(auto.has(s.slug), s.slug).toBe(true);
    expect(MANUAL_COMPANIES.some((c) => "hub" in c)).toBe(false);
  });
  it("have unique slugs and official https links (never LinkedIn)", () => {
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
    for (const c of all) {
      expect(c.website, c.slug).toMatch(/^https:\/\//);
      expect(c.careersUrl, c.slug).toMatch(/^https:\/\//);
      expect(`${c.website} ${c.careersUrl}`, c.slug).not.toMatch(/linkedin|lnkd\.in/i);
    }
    for (const s of BOT_PROTECTED)
      expect(
        all.some((c) => c.slug === s),
        s,
      ).toBe(true);
  });
  it("only use supported providers", () => {
    for (const s of ESTABLISHED_SOURCES) expect(SUPPORTED_PROVIDERS, s.slug).toContain(s.provider);
  });
  it("cover the companies that were missing, including the MATAM hub", () => {
    const slugs = all.map((c) => c.slug);
    for (const s of ["onecity", "one-technologies", "integrity-software", "matrix", "comm-it"]) {
      expect(slugs).toContain(s);
    }
    expect(all.filter((c) => c.hub === "matam").length).toBeGreaterThanOrEqual(15);
  });
});
