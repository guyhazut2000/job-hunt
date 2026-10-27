import { describe, expect, it } from "vitest";
import { MANUAL_COMPANIES } from "@/lib/companies/manual";
import {
  careersLink,
  isManualCompany,
  isSyncFailing,
  matchesFilter,
  parseCompanyFilter,
  safeHttpUrl,
} from "@/lib/companies/status";
import { JOB_SOURCES } from "@/lib/ingestion/sources";

describe("manual company list", () => {
  it("has unique slugs that don't clash with automatic sources", () => {
    const slugs = MANUAL_COMPANIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const auto = new Set(JOB_SOURCES.map((s) => s.slug));
    expect(slugs.filter((s) => auto.has(s))).toEqual([]);
  });
  it("links only to official https careers pages (never LinkedIn)", () => {
    for (const c of MANUAL_COMPANIES) {
      expect(safeHttpUrl(c.careersUrl), c.slug).toBe(new URL(c.careersUrl).toString());
      expect(c.careersUrl).toMatch(/^https:\/\//);
      expect(c.careersUrl).not.toMatch(/linkedin|google\./i);
      expect(c.notesHe && c.notesEn, c.slug).toBeTruthy();
    }
  });
  it("includes the companies we couldn't sync", () => {
    const slugs = MANUAL_COMPANIES.map((c) => c.slug);
    for (const s of ["broadcom", "amdocs", "dell", "hippo", "snyk", "vayyar"]) expect(slugs).toContain(s);
  });
});

describe("company sync status", () => {
  const auto = { syncMode: "AUTO" as const, atsProvider: "GREENHOUSE" as const, atsBoardId: "acme", syncFailures: 0 };
  it("treats MANUAL mode, MANUAL provider or a missing board as manual", () => {
    expect(isManualCompany(auto)).toBe(false);
    expect(isManualCompany({ ...auto, syncMode: "MANUAL" })).toBe(true);
    expect(isManualCompany({ ...auto, atsProvider: "MANUAL" })).toBe(true);
    expect(isManualCompany({ ...auto, atsBoardId: null })).toBe(true);
  });
  it("flags AUTO companies after repeated failures, keeping them listed", () => {
    expect(isSyncFailing({ ...auto, syncFailures: 2 })).toBe(false);
    expect(isSyncFailing({ ...auto, syncFailures: 3 })).toBe(true);
    expect(isSyncFailing({ ...auto, syncMode: "MANUAL", syncFailures: 9 })).toBe(false);
    expect(matchesFilter({ ...auto, syncFailures: 9 }, "auto")).toBe(true);
  });
  it("filters all / auto / manual", () => {
    expect(parseCompanyFilter("manual")).toBe("manual");
    expect(parseCompanyFilter(["auto"])).toBe("auto");
    expect(parseCompanyFilter("bogus")).toBe("all");
    expect(matchesFilter(auto, "manual")).toBe(false);
    expect(matchesFilter({ ...auto, syncMode: "MANUAL" }, "manual")).toBe(true);
    expect(matchesFilter(auto, "all")).toBe(true);
  });
  it("prefers the careers page and rejects unsafe links", () => {
    expect(careersLink({ careersUrl: "https://acme.com/careers", website: "https://acme.com" })).toBe(
      "https://acme.com/careers",
    );
    expect(careersLink({ careersUrl: "https://www.linkedin.com/company/acme", website: "https://acme.com" })).toBe(
      "https://acme.com/",
    );
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("ftp://acme.com")).toBeNull();
  });
});
