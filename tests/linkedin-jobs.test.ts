import { describe, expect, it } from "vitest";
import { parseClickEvent } from "@/lib/events";
import { fixtureJobResults } from "@/lib/linkedin/fixtures";
import {
  buildLinkedinJobQuery,
  EXACT_MIN_CONFIDENCE,
  isExactLinkedinJobUrl,
  linkedinJobSearchUrl,
  linkedinLinkFor,
  needsLinkedinCheck,
  normalizeLinkedinJobUrl,
  pickLinkedinJob,
  RECHECK_FOUND_MS,
  RECHECK_MISS_MS,
  scoreJobResult,
  titleCoverage,
} from "@/lib/linkedin/jobs";
import { linkedinJobsConfig, withinBudget } from "@/lib/linkedin/resolve";

const job = { title: "Senior Backend Engineer", company: "Wiz" };
const r = (title: string, url: string, description = "") => ({ title, url, description });

describe("normalizeLinkedinJobUrl", () => {
  it.each([
    ["https://www.linkedin.com/jobs/view/4012345678", "4012345678"],
    ["https://www.linkedin.com/jobs/view/4012345678/", "4012345678"],
    ["https://il.linkedin.com/jobs/view/senior-backend-engineer-at-wiz-4012345678?trk=public_jobs", "4012345678"],
    ["http://linkedin.com/jobs/view/3999999999/#x", "3999999999"],
  ])("accepts %s", (url, id) => {
    expect(normalizeLinkedinJobUrl(url)).toEqual({ id, url: `https://www.linkedin.com/jobs/view/${id}/` });
  });

  it.each([
    "https://www.linkedin.com/jobs/search/?keywords=wiz",
    "https://www.linkedin.com/jobs/wiz-jobs",
    "https://www.linkedin.com/company/wiz/jobs/",
    "https://www.linkedin.com/in/someone-123456789",
    "https://www.linkedin.com/jobs/view/abc",
    "https://www.linkedin.com/jobs/view/12345",
    "https://www.linkedin.com/jobs/view/4012345678/apply",
    "https://linkedin.com.evil.example/jobs/view/4012345678",
    "https://evil-linkedin.com/jobs/view/4012345678",
    "https://lnkd.in/abc",
    "javascript:alert(1)//linkedin.com/jobs/view/4012345678",
    "not a url",
  ])("rejects %s", (url) => {
    expect(normalizeLinkedinJobUrl(url)).toBeNull();
  });

  it("isExactLinkedinJobUrl only trusts the normalized form", () => {
    expect(isExactLinkedinJobUrl("https://www.linkedin.com/jobs/view/4012345678/")).toBe(true);
    expect(isExactLinkedinJobUrl("https://il.linkedin.com/jobs/view/4012345678")).toBe(false);
    expect(isExactLinkedinJobUrl(null)).toBe(false);
  });
});

describe("matching", () => {
  it("title coverage ignores brackets, stopwords and Sr./Jr.", () => {
    expect(titleCoverage("Sr. Backend Engineer (Tel Aviv)", "Wiz hiring Senior Backend Engineer in Israel")).toBe(1);
    expect(titleCoverage("Senior Backend Engineer", "Frontend Engineer")).toBeCloseTo(1 / 3);
  });

  it("scores the two common Brave title shapes high", () => {
    const a = r(
      "Wiz hiring Senior Backend Engineer in Tel Aviv-Yafo, Tel Aviv District, Israel | LinkedIn",
      "https://il.linkedin.com/jobs/view/4012345678",
    );
    const b = r("Senior Backend Engineer - Wiz - LinkedIn", "https://www.linkedin.com/jobs/view/4012345679");
    expect(scoreJobResult(a, job)).toBeGreaterThanOrEqual(EXACT_MIN_CONFIDENCE);
    expect(scoreJobResult(b, job)).toBeGreaterThanOrEqual(EXACT_MIN_CONFIDENCE);
  });

  it("rejects wrong company, similar names and weak title matches", () => {
    const wrongCo = r(
      "Wixel hiring Senior Backend Engineer in Israel | LinkedIn",
      "https://www.linkedin.com/jobs/view/4012345678",
    );
    const weak = r("Wiz hiring Sales Engineer in Tel Aviv | LinkedIn", "https://www.linkedin.com/jobs/view/4012345678");
    expect(scoreJobResult(wrongCo, job)).toBeLessThan(EXACT_MIN_CONFIDENCE);
    expect(scoreJobResult(weak, job)).toBeLessThan(EXACT_MIN_CONFIDENCE);
  });

  it("picks the best valid /jobs/view/ result and ignores non-posting URLs", () => {
    const results = [
      r(
        "Wiz hiring Senior Backend Engineer in Israel | LinkedIn",
        "https://www.linkedin.com/jobs/search/?keywords=wiz",
      ),
      r("Wiz | LinkedIn", "https://www.linkedin.com/company/wiz"),
      r("Acme hiring Senior Backend Engineer in Israel | LinkedIn", "https://www.linkedin.com/jobs/view/1111111111"),
      r(
        "Wiz hiring Senior Backend Engineer in Tel Aviv, Israel | LinkedIn",
        "https://il.linkedin.com/jobs/view/x-2222222222",
      ),
    ];
    const hit = pickLinkedinJob(results, job);
    expect(hit?.url).toBe("https://www.linkedin.com/jobs/view/2222222222/");
    expect(hit?.title).toBe("Wiz hiring Senior Backend Engineer in Tel Aviv, Israel");
    expect(pickLinkedinJob(results.slice(0, 3), job)).toBeNull();
  });

  it("mock fixtures produce both found and not-found jobs", () => {
    const titles = [
      "Backend Engineer",
      "Data Engineer",
      "Product Manager",
      "QA Lead",
      "DevOps Engineer",
      "SRE",
      "Designer",
      "CTO",
    ];
    const found = titles.map((t) =>
      pickLinkedinJob(fixtureJobResults(t, "CloudNest").results, { title: t, company: "CloudNest" }),
    );
    expect(found.some(Boolean)).toBe(true);
    expect(found.some((f) => f === null)).toBe(true);
  });
});

describe("query + deep links", () => {
  it("builds the Brave query with quoted title and cleaned company", () => {
    expect(buildLinkedinJobQuery('Senior "Backend" Engineer (Platform) - Tel Aviv', "Wiz Ltd.")).toBe(
      'site:linkedin.com/jobs/view "Senior Backend Engineer" "Wiz"',
    );
  });

  it("builds a search deep link with keywords + location=Israel and no f_C by default", () => {
    const u = new URL(linkedinJobSearchUrl({ title: "Backend Engineer (TLV)", company: "CloudNest Ltd" }));
    expect(u.origin + u.pathname).toBe("https://www.linkedin.com/jobs/search/");
    expect(u.searchParams.get("keywords")).toBe("Backend Engineer CloudNest");
    expect(u.searchParams.get("location")).toBe("Israel");
    expect(u.searchParams.has("f_C")).toBe(false);
  });

  it("adds f_C only for a numeric company id", () => {
    expect(new URL(linkedinJobSearchUrl({ title: "x", company: "y", companyId: "1234" })).searchParams.get("f_C")).toBe(
      "1234",
    );
    expect(new URL(linkedinJobSearchUrl({ title: "x", company: "y", companyId: "wiz" })).searchParams.has("f_C")).toBe(
      false,
    );
  });

  it("linkedinLinkFor prefers a valid exact URL, else search", () => {
    const base = { title: "Backend Engineer", company: { name: "CloudNest" } };
    expect(linkedinLinkFor({ ...base, linkedinUrl: "https://www.linkedin.com/jobs/view/4012345678/" }).kind).toBe(
      "exact",
    );
    expect(linkedinLinkFor({ ...base, linkedinUrl: "https://evil.example/jobs/view/4012345678/" }).kind).toBe("search");
    expect(linkedinLinkFor({ ...base, linkedinUrl: null }).kind).toBe("search");
  });
});

describe("recheck + budget", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("checks unchecked jobs, retries misses weekly and re-validates hits monthly", () => {
    expect(needsLinkedinCheck({ linkedinCheckedAt: null }, now)).toBe(true);
    expect(needsLinkedinCheck({ linkedinCheckedAt: ago(RECHECK_MISS_MS - 1000) }, now)).toBe(false);
    expect(needsLinkedinCheck({ linkedinCheckedAt: ago(RECHECK_MISS_MS + 1000) }, now)).toBe(true);
    const url = "https://www.linkedin.com/jobs/view/1/";
    expect(needsLinkedinCheck({ linkedinUrl: url, linkedinCheckedAt: ago(RECHECK_MISS_MS + 1000) }, now)).toBe(false);
    expect(needsLinkedinCheck({ linkedinUrl: url, linkedinCheckedAt: ago(RECHECK_FOUND_MS + 1000) }, now)).toBe(true);
  });

  it("respects both the shared Brave cap and the job-link slice", () => {
    const cfg = { monthlyCap: 900, monthlyJobCap: 300 };
    expect(withinBudget({ total: 100, jobs: 50 }, cfg)).toBe(true);
    expect(withinBudget({ total: 900, jobs: 50 }, cfg)).toBe(false);
    expect(withinBudget({ total: 400, jobs: 300 }, cfg)).toBe(false);
  });

  it("config defaults and mock refusal on production", () => {
    const c = linkedinJobsConfig({});
    expect(c.enabled).toBe(false);
    expect(c.monthlyJobCap).toBe(300);
    expect(c.ingestBatch).toBe(10);
    expect(linkedinJobsConfig({ PEOPLE_SEARCH_MOCK: "1", VERCEL_ENV: "production" }).enabled).toBe(false);
  });
});

describe("click events", () => {
  it("accepts only whitelisted events/kinds", () => {
    expect(
      parseClickEvent({
        event: "job_linkedin_click",
        jobId: "cmvqnfqvy00069gk7d2x0aeu5",
        kind: "exact",
        placement: "card",
      }),
    ).toEqual({
      event: "job_linkedin_click",
      jobId: "cmvqnfqvy00069gk7d2x0aeu5",
      kind: "exact",
      placement: "card",
    });
    expect(parseClickEvent({ event: "signup", jobId: "cmvqnfqvy00069gk7d2x0aeu5", kind: "exact" })).toBeNull();
    expect(parseClickEvent({ event: "job_apply_click", jobId: "../../x", kind: "company" })).toBeNull();
    expect(parseClickEvent({ event: "job_apply_click", jobId: "cmvqnfqvy00069gk7d2x0aeu5", kind: "other" })).toBeNull();
    expect(parseClickEvent("nope")).toBeNull();
  });
});
