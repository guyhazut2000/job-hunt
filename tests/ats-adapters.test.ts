import { describe, expect, it, vi } from "vitest";
import ashbyFixture from "./fixtures/ashby-board.json";
import recruiteeFixture from "./fixtures/recruitee-offers.json";
import srDetail from "./fixtures/smartrecruiters-detail.json";
import srList from "./fixtures/smartrecruiters-list.json";
import workableFixture from "./fixtures/workable-widget.json";
import wdDetail from "./fixtures/workday-detail.json";
import wdList from "./fixtures/workday-list.json";
import wdProbe from "./fixtures/workday-probe.json";
import { ashbyAdapter, type AshbyJob } from "@/lib/ingestion/adapters/ashby";
import { greenhouseAdapter, type GreenhouseJob } from "@/lib/ingestion/adapters/greenhouse";
import { leverAdapter, type LeverPosting } from "@/lib/ingestion/adapters/lever";
import { recruiteeAdapter, type RecruiteeOffer } from "@/lib/ingestion/adapters/recruitee";
import { smartRecruitersAdapter } from "@/lib/ingestion/adapters/smartrecruiters";
import { workableAdapter, type WorkableJob } from "@/lib/ingestion/adapters/workable";
import {
  israelFacet,
  parsePostedOn,
  parseWorkdayBoard,
  workdayAdapter,
  type WorkdayPosting,
} from "@/lib/ingestion/adapters/workday";
import { paceHost, requestJson } from "@/lib/ingestion/http";
import { isIsraelLocation } from "@/lib/ingestion/location";
import { pickStatedPay } from "@/lib/ingestion/normalize";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import type { AtsAdapter, NormalizedJob } from "@/lib/ingestion/types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const jsonFetch = (body: unknown) => vi.fn(async () => json(body)) as unknown as typeof fetch;

async function ingest<R>(adapter: AtsAdapter<R>, fetchImpl: typeof fetch, boardId: string) {
  const ctx = { boardId, fetchImpl };
  const raws = (await adapter.fetchRaw(ctx)).filter((r) => adapter.isInIsrael(r));
  const out: NormalizedJob[] = [];
  for (const r of raws) {
    const full = adapter.detail ? await adapter.detail.fetch(r, ctx) : r;
    const job = adapter.normalize(full);
    if (job) out.push(job);
  }
  return out;
}

describe("registry", () => {
  it("supports every new public ATS", () => {
    expect(SUPPORTED_PROVIDERS).toEqual(
      expect.arrayContaining(["ASHBY", "WORKABLE", "SMARTRECRUITERS", "RECRUITEE", "WORKDAY", "COMEET"]),
    );
  });
});

describe("Israel filter edge cases", () => {
  it.each(["Remote, Israel", "Yehud", "יהוד", "Rosh HaAyin", "Caesarea", "Herzliya Pituach, IL"])("accepts %s", (l) =>
    expect(isIsraelLocation(l)).toBe(true),
  );
  it.each(["Chicago, IL", "Springfield, Illinois", "יהודה ושומרון בארה״ב", "Remote - EMEA", "Judea, NY"])(
    "rejects %s",
    (l) => expect(isIsraelLocation(l)).toBe(false),
  );
});

describe("pickStatedPay", () => {
  const usd = { min: 150_000, max: 190_000, currency: "USD", period: "year" as const };
  it("prefers an ILS range", () => {
    const ils = { min: 30_000, max: 40_000, currency: "ILS", period: "month" as const };
    expect(pickStatedPay([{ ...usd, label: "US" }, ils], false)).toEqual(ils);
  });
  it("takes a range labelled for Israel", () => {
    expect(pickStatedPay([{ ...usd, label: "Israel base pay" }], false)).toEqual(usd);
  });
  it("never attributes another country's range to an Israeli role", () => {
    expect(pickStatedPay([{ ...usd, label: "US Base Pay Range" }], true)).toBeNull();
    expect(pickStatedPay([{ ...usd, label: "Salary" }], false)).toBeNull();
  });
  it("accepts an unlabelled range when every location is Israeli", () => {
    expect(pickStatedPay([{ ...usd, label: "Salary" }], true)).toEqual(usd);
  });
  it("drops inconsistent ranges", () => {
    expect(pickStatedPay([{ min: 0, max: 0, currency: "USD", period: "year" }], true)).toBeNull();
    expect(pickStatedPay([{ min: 1, max: 2, currency: "dollars", period: "year" }], true)).toBeNull();
  });
});

describe("Ashby adapter (fixture)", () => {
  it("keeps listed Israeli postings with department, work mode and Israeli pay only", async () => {
    const jobs = await ingest<AshbyJob>(ashbyAdapter, jsonFetch(ashbyFixture), "acme");
    expect(jobs.map((j) => j.externalId)).toEqual(["a1b2c3d4-0001", "a1b2c3d4-0002"]);
    expect(jobs[0]).toMatchObject({
      source: "ASHBY",
      title: "Senior Backend Engineer",
      location: "Tel Aviv",
      seniority: "SENIOR",
      department: "R&D",
      workMode: "HYBRID",
      applyUrl: "https://jobs.ashbyhq.com/acme/a1b2c3d4-0001",
      payMin: 35_000,
      payMax: 45_000,
      payCurrency: "ILS",
      payPeriod: "month",
    });
    expect(jobs[0]!.sourceUpdatedAt.toISOString()).toBe("2026-10-20T08:00:00.000Z");
    // Remote-Israel secondary location counts; its US-labelled range does not.
    expect(jobs[1]).toMatchObject({ location: "Israel", workMode: "REMOTE", department: "Sales", payMin: null });
  });
});

describe("Workable adapter (fixture)", () => {
  it("filters by country code / city and rejects Chicago, IL", async () => {
    const jobs = await ingest<WorkableJob>(workableAdapter, jsonFetch(workableFixture), "acme");
    expect(jobs.map((j) => j.externalId)).toEqual(["A1B2C3D4E5", "Z9Y8X7W6V5"]);
    expect(jobs[0]).toMatchObject({ location: "Herzliya", department: "Engineering", source: "WORKABLE" });
    expect(jobs[1]).toMatchObject({ location: "Israel", workMode: "REMOTE", employmentType: "PART_TIME" });
  });
});

describe("Recruitee adapter (fixture)", () => {
  it("namespaces ids per board and keeps the stated ILS salary", async () => {
    const jobs = await ingest<RecruiteeOffer>(recruiteeAdapter, jsonFetch(recruiteeFixture), "acme");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: "acme:101",
      location: "Tel Aviv",
      department: "Game Studio",
      payMin: 28_000,
      payMax: 34_000,
      payCurrency: "ILS",
      payPeriod: "month",
    });
    expect(jobs[0]!.description).toMatch(/3\+ years Unity/);
  });
  it("rejects a non-subdomain board id", async () => {
    await expect(recruiteeAdapter.fetchRaw({ boardId: "evil.com/x", fetchImpl: jsonFetch({}) })).rejects.toThrow();
  });
});

describe("SmartRecruiters adapter (fixture)", () => {
  it("lists with the Israel country filter and builds the description from the detail call", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return json(url.includes("/postings?") ? srList : srDetail);
    }) as unknown as typeof fetch;
    const jobs = await ingest(smartRecruitersAdapter, fetchImpl, "Acme1");
    expect(calls[0]).toContain("/companies/Acme1/postings?country=il&limit=100&offset=0");
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      externalId: "744000000000001",
      location: "Tel Aviv",
      department: "R&D",
      workMode: "HYBRID",
      applyUrl: "https://jobs.smartrecruiters.com/Acme1/744000000000001-frontend-team-lead",
    });
    expect(jobs[0]!.description).toMatch(/React and TypeScript/);
  });
  it("exposes a detail hook so the runner fetches details only for new postings", () => {
    expect(smartRecruitersAdapter.detail?.externalId(srList.content[0] as never, { boardId: "Acme1" })).toBe(
      "744000000000001",
    );
  });
});

describe("Workday adapter (fixture)", () => {
  it("parses board ids and rejects malformed ones", () => {
    expect(parseWorkdayBoard("acme/wd1/External")).toMatchObject({
      tenant: "acme",
      api: "https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External",
    });
    expect(() => parseWorkdayBoard("acme/External")).toThrow();
  });

  it("picks the exact Israel facet, else the union of Israeli location values", () => {
    expect(israelFacet(wdProbe.facets)).toEqual({ locationHierarchy1: ["il-country-id"] });
    expect(
      israelFacet([
        {
          facetParameter: "locations",
          values: [
            { descriptor: "Haifa", id: "h" },
            { descriptor: "Petah Tikva", id: "p" },
            { descriptor: "Austin, TX", id: "a" },
          ],
        },
      ]),
    ).toEqual({ locations: ["h", "p"] });
    expect(israelFacet([{ facetParameter: "locations", values: [{ descriptor: "Austin", id: "a" }] }])).toBeNull();
  });

  it("parses relative posted dates", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(parsePostedOn("Posted Today", now)).toEqual(now);
    expect(parsePostedOn("Posted Yesterday", now)?.toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(parsePostedOn("Posted 30+ Days Ago", now)?.toISOString()).toBe("2026-09-27T12:00:00.000Z");
    expect(parsePostedOn("soon", now)).toBeNull();
  });

  it("probes, applies the Israel facet, paginates and normalizes from the detail", async () => {
    const bodies: unknown[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        return json(body.limit === 1 ? wdProbe : wdList);
      }
      return json(wdDetail);
    }) as unknown as typeof fetch;
    const jobs = await ingest<WorkdayPosting>(workdayAdapter, fetchImpl, "acme/wd1/External");
    expect(bodies[1]).toMatchObject({ appliedFacets: { locationHierarchy1: ["il-country-id"] }, limit: 20, offset: 0 });
    expect(bodies).toHaveLength(2); // second page skipped: fewer than 20 results
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      externalId: "acme:/job/Israel-Haifa/Physical-Design-Engineer_JR0001",
      source: "WORKDAY",
      location: "Haifa / Petah Tikva",
      employmentType: "FULL_TIME",
      applyUrl: "https://acme.wd1.myworkdayjobs.com/External/job/Israel-Haifa/Physical-Design-Engineer_JR0001",
    });
    expect(jobs[0]!.postedAt.toISOString().slice(0, 10)).toBe("2026-10-24");
  });

  it("returns nothing when the site has no Israel facet", async () => {
    const fetchImpl = jsonFetch({ total: 5, jobPostings: [], facets: [] });
    expect(await workdayAdapter.fetchRaw({ boardId: "acme/wd1/External", fetchImpl })).toEqual([]);
  });
});

describe("Greenhouse / Lever structured pay", () => {
  it("reads Greenhouse pay_input_ranges (cents) and departments", () => {
    const raw: GreenhouseJob = {
      id: 1,
      title: "Backend Engineer",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
      location: { name: "Tel Aviv, Israel" },
      offices: [{ name: "Tel Aviv", location: "Tel Aviv, Israel" }],
      departments: [{ name: "Engineering" }],
      content: "&lt;p&gt;Go&lt;/p&gt;",
      pay_input_ranges: [{ min_cents: 50_000_000, max_cents: 60_000_000, currency_type: "ILS", title: "Base" }],
    };
    expect(greenhouseAdapter.normalize(raw)).toMatchObject({
      department: "Engineering",
      payMin: 500_000,
      payMax: 600_000,
      payCurrency: "ILS",
      payPeriod: "year",
    });
  });
  it("ignores a US Greenhouse range on a multi-country posting", () => {
    const raw: GreenhouseJob = {
      id: 2,
      title: "Engineer",
      absolute_url: "https://x",
      location: { name: "Tel Aviv, Israel; New York, NY" },
      offices: [{ name: "Tel Aviv" }, { name: "New York" }],
      pay_input_ranges: [{ min_cents: 15_000_000, max_cents: 19_000_000, currency_type: "USD", title: "US Base Pay" }],
    };
    expect(greenhouseAdapter.normalize(raw)?.payMin).toBeNull();
  });
  it("reads Lever salaryRange and department", () => {
    const raw: LeverPosting = {
      id: "lev-1",
      text: "Data Engineer",
      hostedUrl: "https://jobs.lever.co/acme/lev-1",
      createdAt: Date.parse("2026-10-01"),
      country: "IL",
      categories: { location: "Tel Aviv", department: "Data", team: "Platform" },
      salaryRange: { min: 30_000, max: 38_000, currency: "ILS", interval: "per-month-salary" },
    };
    expect(leverAdapter.normalize(raw)).toMatchObject({
      department: "Data",
      payMin: 30_000,
      payMax: 38_000,
      payCurrency: "ILS",
      payPeriod: "month",
    });
  });
});

describe("polite HTTP", () => {
  it("retries 429/5xx and then succeeds", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n < 2 ? json({}, 503) : json({ ok: true }))) as unknown as typeof fetch;
    await expect(requestJson("https://retry.test/x", "t", { fetchImpl, minIntervalMs: 0 })).resolves.toEqual({
      ok: true,
    });
    expect(n).toBe(2);
  });
  it("does not retry other 4xx and reports only the label", async () => {
    const fetchImpl = vi.fn(async () => json({}, 404)) as unknown as typeof fetch;
    await expect(requestJson("https://nf.test/secret-path", "Board", { fetchImpl, minIntervalMs: 0 })).rejects.toThrow(
      /^Board: HTTP 404$/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("paces requests to the same host", async () => {
    let t = 1_000;
    const now = () => t;
    await paceHost("pace.test", 500, now);
    const start = Date.now();
    await paceHost("pace.test", 500, now); // reserved slot at 1500 while "now" is 1000 → waits ~500ms
    expect(Date.now() - start).toBeGreaterThanOrEqual(450);
    t = 10_000;
  });
});
