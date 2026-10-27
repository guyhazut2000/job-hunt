import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseClickEvent } from "@/lib/events";
import {
  linkedinCompanyJobsUrl,
  linkedinCompanyLinkFor,
  linkedinCompanySearchUrl,
  normalizeLinkedinCompanyUrl,
} from "@/lib/linkedin/company";

// These helpers only build outbound URLs. Any network call to LinkedIn/Google is a bug.
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (/(^|\.)(linkedin|google)\.com/i.test(new URL(url).hostname)) throw new Error(`blocked fetch: ${url}`);
    throw new Error(`unexpected fetch in unit test: ${url}`);
  }) as typeof fetch;
});
afterAll(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  globalThis.fetch = realFetch;
});

const CID = "cmvqnfqvy00069gk7d2x0aeu5";

describe("normalizeLinkedinCompanyUrl", () => {
  it.each([
    ["https://www.linkedin.com/company/wiz-inc", "https://www.linkedin.com/company/wiz-inc/"],
    ["https://il.linkedin.com/company/wiz-inc/about/?trk=public", "https://www.linkedin.com/company/wiz-inc/"],
    ["linkedin.com/company/monday.com/jobs/", "https://www.linkedin.com/company/monday.com/"],
    ["http://linkedin.com/showcase/aws-israel", "https://www.linkedin.com/showcase/aws-israel/"],
    ["https://www.linkedin.com/school/technion/", "https://www.linkedin.com/school/technion/"],
    ["  check-point-software-technologies ", "https://www.linkedin.com/company/check-point-software-technologies/"],
    ["https://www.linkedin.com/company/AT&T", "https://www.linkedin.com/company/AT&T/"],
  ])("accepts %s", (raw, want) => {
    expect(normalizeLinkedinCompanyUrl(raw)).toBe(want);
  });

  it("percent-encodes Hebrew slugs and round-trips already-encoded ones", () => {
    const want = `https://www.linkedin.com/company/${encodeURIComponent("אלביט")}/`;
    expect(normalizeLinkedinCompanyUrl("https://www.linkedin.com/company/אלביט")).toBe(want);
    expect(normalizeLinkedinCompanyUrl(want)).toBe(want);
  });

  it.each([
    "",
    null,
    undefined,
    "https://evil.com/company/wiz",
    "https://linkedin.com.evil.com/company/wiz",
    "https://www.linkedin.com/in/someone",
    "https://www.linkedin.com/jobs/view/4012345678",
    "https://www.linkedin.com/company/",
    "https://www.linkedin.com/company/wiz/people/extra/deep",
    "javascript:alert(1)",
    "wiz inc",
    "https://www.linkedin.com/company/%E0%A4%A",
  ])("rejects %s", (raw) => {
    expect(normalizeLinkedinCompanyUrl(raw)).toBeNull();
  });
});

describe("company search URLs", () => {
  it("builds a company search with the cleaned name", () => {
    const u = new URL(linkedinCompanySearchUrl("Wix.com Ltd."));
    expect(u.origin + u.pathname).toBe("https://www.linkedin.com/search/results/companies/");
    expect(u.searchParams.get("keywords")).toBe("Wix.com");
  });

  it("encodes Hebrew, quotes and ampersands", () => {
    const url = linkedinCompanySearchUrl('אלביט מערכות בע"מ');
    expect(url).not.toMatch(/[^\x20-\x7e]/); // fully ASCII (percent-encoded)
    expect(new URL(url).searchParams.get("keywords")).toBe("אלביט מערכות");
    const amp = new URL(linkedinCompanySearchUrl("AT&T Israel"));
    expect(amp.searchParams.get("keywords")).toBe("AT&T Israel");
    expect(amp.search).toContain("AT%26T");
  });

  it("builds a company jobs search in Israel", () => {
    const u = new URL(linkedinCompanyJobsUrl("NVIDIA Corporation"));
    expect(u.origin + u.pathname).toBe("https://www.linkedin.com/jobs/search/");
    expect(u.searchParams.get("keywords")).toBe("NVIDIA");
    expect(u.searchParams.get("location")).toBe("Israel");
    expect(new URL(linkedinCompanyJobsUrl("מובילאיי")).searchParams.get("keywords")).toBe("מובילאיי");
  });
});

describe("linkedinCompanyLinkFor", () => {
  it("prefers a valid stored page", () => {
    expect(linkedinCompanyLinkFor({ name: "Wiz", linkedinUrl: "https://www.linkedin.com/company/wiz-inc/" })).toEqual({
      kind: "company_page",
      url: "https://www.linkedin.com/company/wiz-inc/",
    });
  });
  it("falls back to search when missing or invalid", () => {
    for (const linkedinUrl of [null, undefined, "", "https://example.com/wiz"]) {
      const l = linkedinCompanyLinkFor({ name: "Wiz", linkedinUrl });
      expect(l.kind).toBe("company_search");
      expect(l.url).toBe("https://www.linkedin.com/search/results/companies/?keywords=Wiz");
    }
  });
});

describe("company click events", () => {
  it("accepts company clicks with companyId (and optional jobId)", () => {
    expect(
      parseClickEvent({ event: "company_linkedin_click", companyId: CID, kind: "company_search", placement: "list" }),
    ).toEqual({ event: "company_linkedin_click", companyId: CID, kind: "company_search", placement: "list" });
    expect(
      parseClickEvent({ event: "company_linkedin_click", companyId: CID, jobId: CID, kind: "company_page" }),
    ).toEqual({ event: "company_linkedin_click", companyId: CID, jobId: CID, kind: "company_page", placement: "page" });
  });
  it("rejects malformed company clicks", () => {
    expect(parseClickEvent({ event: "company_linkedin_click", kind: "company_page" })).toBeNull();
    expect(parseClickEvent({ event: "company_linkedin_click", companyId: "../x", kind: "company_page" })).toBeNull();
    expect(parseClickEvent({ event: "company_linkedin_click", companyId: CID, kind: "exact" })).toBeNull();
    expect(parseClickEvent({ event: "job_linkedin_click", companyId: CID, kind: "search" })).toBeNull();
    expect(parseClickEvent({ event: "job_linkedin_click", jobId: CID, kind: "company_jobs" })).toBeNull();
  });
});
