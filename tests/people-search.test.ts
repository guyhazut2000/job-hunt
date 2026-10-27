import { describe, expect, it, vi } from "vitest";
import { BraveError, braveWebSearch, createPacer, parseRateHeader, type BraveDeps } from "@/lib/people/brave";
import { peopleSearchConfig } from "@/lib/people/config";
import { fixtureResults } from "@/lib/people/fixtures";
import { buildPeopleQuery, GROUP_CATEGORY, PEOPLE_GROUPS } from "@/lib/people/groups";
import { checkLimits, expiryFrom, isFresh, queryHash } from "@/lib/people/limits";
import { CONFIDENCE_LOW, CONFIDENCE_SHOW, dice, mentionsCompany, scoreMatch } from "@/lib/people/match";
import {
  cleanText,
  firstName,
  initials,
  normalizeProfileUrl,
  parseFields,
  parseResults,
  plausibleName,
} from "@/lib/people/parse";

// All people below are synthetic.

describe("buildPeopleQuery", () => {
  it("targets linkedin.com/in, quotes the cleaned company and adds Israel", () => {
    expect(buildPeopleQuery("Wiz Ltd.", "RECRUITER")).toBe(
      'site:linkedin.com/in "Wiz" (recruiter OR "talent acquisition" OR sourcer OR "מגייסת" OR "מגייס") Israel',
    );
  });
  it("adds role keywords from the job for team-scoped groups only", () => {
    expect(buildPeopleQuery("Acme", "ENGINEER", "backend")).toContain('(Backend OR "בקאנד")');
    expect(buildPeopleQuery("Acme", "TEAM_LEAD", "backend")).toContain("Backend");
    expect(buildPeopleQuery("Acme", "FOUNDER", "backend")).not.toContain("Backend");
  });
  it("maps every group to an existing contact category", () => {
    for (const g of PEOPLE_GROUPS) expect(GROUP_CATEGORY[g]).toBeTruthy();
    expect(GROUP_CATEGORY.MANAGER).toBe("TEAM_LEAD");
    expect(GROUP_CATEGORY.ENGINEER).toBe("PEER");
  });
});

describe("normalizeProfileUrl", () => {
  it("canonicalises country subdomains, locale suffixes, queries and case", () => {
    expect(normalizeProfileUrl("https://il.linkedin.com/in/Dana-Example-12ab/?trk=x")).toEqual({
      url: "https://www.linkedin.com/in/dana-example-12ab",
      key: "dana-example-12ab",
    });
    expect(normalizeProfileUrl("https://www.linkedin.com/in/dana-example/he")?.key).toBe("dana-example");
    expect(normalizeProfileUrl("http://linkedin.com/in/yoni-sample")?.url).toBe(
      "https://www.linkedin.com/in/yoni-sample",
    );
  });
  it("keeps encoded unicode slugs", () => {
    const r = normalizeProfileUrl("https://il.linkedin.com/in/%D7%A0%D7%95%D7%A2%D7%94-x1");
    expect(r?.key).toBe("נועה-x1");
    expect(r?.url).toBe("https://www.linkedin.com/in/%D7%A0%D7%95%D7%A2%D7%94-x1");
  });
  it("rejects non-profile and look-alike URLs", () => {
    for (const u of [
      "https://www.linkedin.com/jobs/view/123",
      "https://www.linkedin.com/company/acme",
      "https://www.linkedin.com/in/dana/detail/skills",
      "https://www.linkedin.com/pub/dir/dana",
      "https://linkedin.com.evil.example/in/dana",
      "https://evil.example/in/dana",
      "javascript:alert(1)",
      "https://www.linkedin.com/in/",
      "not a url",
      null,
    ])
      expect(normalizeProfileUrl(u)).toBeNull();
  });
});

describe("parser", () => {
  it("cleans highlights and entities", () => {
    expect(cleanText("<strong>Dana</strong> &amp; co &#39;x&#39; &quot;y&quot;")).toBe("Dana & co 'x' \"y\"");
  });
  it("accepts names, rejects noise", () => {
    expect(plausibleName("Dana Example")).toBe(true);
    expect(plausibleName("נועה דוגמה")).toBe(true);
    expect(plausibleName("Acme is hiring")).toBe(false);
    expect(plausibleName("Top 10 Recruiters")).toBe(false);
  });
  it("splits title and description into fields", () => {
    const f = parseFields({
      title: "Dana Example - Senior Technical Recruiter - Acme | LinkedIn",
      description: "Recruiting at Acme · Experience: Acme · Location: Tel Aviv-Yafo, Israel · 500+ connections",
    });
    expect(f).toMatchObject({
      name: "Dana Example",
      titleParts: ["Senior Technical Recruiter", "Acme"],
      headline: "Senior Technical Recruiter · Acme",
      experience: "Acme",
      location: "Tel Aviv-Yafo, Israel",
    });
  });
  it("falls back to the description for a headline and handles Hebrew labels", () => {
    const f = parseFields({
      title: "Yoni Sample | LinkedIn",
      description: "Backend Team Lead at Acme · ניסיון: Acme · מיקום: חיפה, ישראל",
    });
    expect(f?.headline).toBe("Backend Team Lead at Acme");
    expect(f?.experience).toBe("Acme");
    expect(f?.location).toBe("חיפה, ישראל");
  });
  it("parses a fixture page: valid profiles only, deduped, scored", () => {
    const { results } = fixtureResults("Acme Ltd", "RECRUITER");
    const cards = parseResults(results, "Acme Ltd", "RECRUITER");
    const keys = cards.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(cards.some((c) => c.url.includes("/jobs/"))).toBe(false);
    const good = cards.filter((c) => c.confidence >= CONFIDENCE_SHOW);
    expect(good).toHaveLength(6);
    expect(good.every((c) => c.companyMatch && c.url.startsWith("https://www.linkedin.com/in/"))).toBe(true);
    const former = cards.find((c) => c.name === "Gal Formerson");
    expect(former && former.confidence < CONFIDENCE_LOW).toBe(true);
    const vendor = cards.find((c) => c.name === "Uri Elsewhere");
    expect(vendor?.companyMatch).toBe(false);
    expect(vendor && vendor.confidence < CONFIDENCE_SHOW).toBe(true);
  });
  it("derives first names and initials", () => {
    expect(firstName("Dana Example")).toBe("Dana");
    expect(initials("Dana Q. Example")).toBe("DE");
    expect(initials("נועה דוגמה")).toBe("נד");
    expect(initials("Mono")).toBe("MO");
  });
});

describe("company matching", () => {
  it("matches whole words only", () => {
    expect(mentionsCompany("Recruiter at Wix", "Wix.com Ltd.")).toBe(true);
    expect(mentionsCompany("Recruiter at Wixel", "Wix.com")).toBe(false);
    expect(mentionsCompany("Engineer @ Check Point", "Check Point Software Technologies Ltd")).toBe(false);
    expect(mentionsCompany("Engineer @ Check Point Software", "Check Point Software Technologies Ltd")).toBe(true);
  });
  it("dice similarity tolerates suffixes", () => {
    expect(dice("Acme", "Acme Ltd.")).toBe(1);
    expect(dice("Acme Inc", "Acme")).toBe(1);
    expect(dice("Globex", "Acme")).toBeLessThan(0.3);
  });
  it("penalises former employees", () => {
    const base = { titleParts: [], headline: "Product Lead at Other Corp", experience: null, location: "Israel" };
    const s = scoreMatch({ ...base, name: "X Y", description: "ex-Acme engineer" }, "Acme", "ENGINEER");
    expect(s.companyMatch).toBe(false);
    expect(s.confidence).toBeLessThan(CONFIDENCE_LOW);
  });
});

describe("cache + limits", () => {
  it("hashes query+page stably and case-insensitively", () => {
    expect(queryHash("Q", 0)).toBe(queryHash(" q ", 0));
    expect(queryHash("q", 0)).not.toBe(queryHash("q", 1));
  });
  it("respects TTL", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    const exp = expiryFrom(now, 168);
    expect(exp.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(isFresh({ expiresAt: exp }, now)).toBe(true);
    expect(isFresh({ expiresAt: exp }, new Date(exp.getTime() + 1))).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
  it("applies per-minute to all requests and caps only to API calls", () => {
    const cfg = { perMinute: 5, dailyCap: 10, monthlyCap: 100 };
    const c = { lastMinute: 0, lastDayUncached: 0, lastMonthUncached: 0 };
    expect(checkLimits(c, cfg, true)).toBeNull();
    expect(checkLimits({ ...c, lastMinute: 5 }, cfg, false)).toBe("rate_limited");
    expect(checkLimits({ ...c, lastDayUncached: 10 }, cfg, false)).toBeNull();
    expect(checkLimits({ ...c, lastDayUncached: 10 }, cfg, true)).toBe("daily_cap");
    expect(checkLimits({ ...c, lastMonthUncached: 100 }, cfg, true)).toBe("quota");
  });
  it("feature flag: off without a key; mock refused on Vercel production", () => {
    expect(peopleSearchConfig({}).enabled).toBe(false);
    expect(peopleSearchConfig({ BRAVE_SEARCH_API_KEY: " k " })).toMatchObject({ enabled: true, apiKey: "k" });
    expect(peopleSearchConfig({ PEOPLE_SEARCH_MOCK: "1" }).enabled).toBe(true);
    expect(peopleSearchConfig({ PEOPLE_SEARCH_MOCK: "1", VERCEL_ENV: "production" }).enabled).toBe(false);
    expect(peopleSearchConfig({ PEOPLE_SEARCH_CACHE_TTL_HOURS: "24" }).cacheTtlHours).toBe(24);
  });
});

describe("Brave client", () => {
  const fakeClock = () => {
    let t = 0;
    const sleeps: number[] = [];
    return {
      sleeps,
      deps: {
        now: () => t,
        sleep: async (ms: number) => {
          sleeps.push(ms);
          t += ms;
        },
      },
    };
  };
  const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  it("paces request starts to the minimum interval", async () => {
    const c = fakeClock();
    const pace = createPacer(1000, c.deps);
    await Promise.all([pace(), pace(), pace()]);
    expect(c.sleeps).toEqual([1000, 1000]);
  });

  it("parses rate-limit headers", () => {
    expect(parseRateHeader("1, 15000")).toEqual([1, 15000]);
    expect(parseRateHeader(null)).toEqual([]);
  });

  it("sends the key header, maps results, retries 429 with backoff", async () => {
    const c = fakeClock();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, {}, { "x-ratelimit-remaining": "0, 500", "x-ratelimit-reset": "1, 999" }))
      .mockResolvedValueOnce(
        res(200, {
          query: { more_results_available: true },
          web: { results: [{ title: "T", url: "https://www.linkedin.com/in/x", description: "D", extra: 1 }] },
        }),
      );
    const deps: BraveDeps = { ...c.deps, fetch: fetchMock };
    const page = await braveWebSearch("q", { apiKey: "test-key", page: 2, pace: async () => {} }, deps);
    expect(page).toEqual({
      results: [{ title: "T", url: "https://www.linkedin.com/in/x", description: "D" }],
      hasMore: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api.search.brave.com/res/v1/web/search");
    expect((url as URL).searchParams.get("offset")).toBe("2");
    expect(init.headers["X-Subscription-Token"]).toBe("test-key");
    expect(c.sleeps[0]).toBeGreaterThanOrEqual(1000);
  });

  it("stops on monthly quota exhaustion, auth errors and repeated 5xx", async () => {
    const c = fakeClock();
    const run = (r: () => Response) =>
      braveWebSearch("q", { apiKey: "k", page: 0, pace: async () => {} }, { ...c.deps, fetch: vi.fn(async () => r()) });
    await expect(run(() => res(429, {}, { "x-ratelimit-remaining": "1, 0" }))).rejects.toMatchObject({ kind: "quota" });
    await expect(run(() => res(401))).rejects.toMatchObject({ kind: "auth" });
    await expect(run(() => res(503))).rejects.toBeInstanceOf(BraveError);
  });
});
