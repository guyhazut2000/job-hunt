import { describe, expect, it, vi } from "vitest";
import amazonFixture from "./fixtures/amazon-search.json";
import efDetail from "./fixtures/eightfold-detail.json";
import efSearch from "./fixtures/eightfold-search.json";
import jibeFixture from "./fixtures/jibe-jobs.json";
import orDetail from "./fixtures/oracle-detail.json";
import orList from "./fixtures/oracle-list.json";
import orProbe from "./fixtures/oracle-probe.json";
import { amazonAdapter, type AmazonJob } from "@/lib/ingestion/adapters/amazon";
import {
  eightfoldAdapter,
  isEightfoldIsrael,
  parseEightfoldBoard,
  type EightfoldPosition,
} from "@/lib/ingestion/adapters/eightfold";
import { jibeAdapter, parseJibeBoard, type JibeJob } from "@/lib/ingestion/adapters/jibe";
import { oracleHcmAdapter, parseOracleBoard, type OracleRequisition } from "@/lib/ingestion/adapters/oracle-hcm";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { JOB_SOURCES } from "@/lib/ingestion/sources";
import type { AtsAdapter, NormalizedJob } from "@/lib/ingestion/types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const urlOf = (input: unknown) => String(input instanceof Request ? input.url : input);

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
  it("supports the bot-protected careers-site APIs", () => {
    expect(SUPPORTED_PROVIDERS).toEqual(expect.arrayContaining(["EIGHTFOLD", "ORACLE_HCM", "JIBE", "AMAZON"]));
  });
  it("every source has a well-formed board id for its provider", () => {
    for (const s of JOB_SOURCES) {
      if (s.provider === "EIGHTFOLD") expect(() => parseEightfoldBoard(s.boardId), s.slug).not.toThrow();
      if (s.provider === "ORACLE_HCM") expect(() => parseOracleBoard(s.boardId), s.slug).not.toThrow();
      if (s.provider === "JIBE") expect(() => parseJibeBoard(s.boardId), s.slug).not.toThrow();
    }
    expect(() => parseOracleBoard("https://x.com/CX")).toThrow();
    expect(() => parseEightfoldBoard("jobs.acme.com")).toThrow();
  });
});

describe("Eightfold adapter (fixture)", () => {
  it("pages the Israel location search, drops remote roles elsewhere and reads the detail", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: unknown) => {
      const url = urlOf(input);
      calls.push(url);
      return json(url.includes("position_details") ? efDetail : efSearch);
    }) as unknown as typeof fetch;
    const jobs = await ingest<EightfoldPosition>(eightfoldAdapter, fetchImpl, "jobs.amdocs.com/amdocs.com");
    expect(calls[0]).toContain("https://jobs.amdocs.com/api/pcsx/search?domain=amdocs.com");
    expect(calls[0]).toContain("location=Israel");
    expect(calls.some((u) => u.includes("/api/apply/"))).toBe(false);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ source: "EIGHTFOLD", externalId: expect.stringMatching(/^amdocs\.com:\d+$/) });
    expect(jobs[0].applyUrl).toMatch(/^https:\/\/jobs\.amdocs\.com\/careers\/job\/\d+/);
    expect(jobs[0].description.length).toBeGreaterThan(50);
    expect(jobs.map((j) => j.title)).not.toContain("Remote Sales (US)");
  });
  it.each(["Ra'anana, Center District, IL", "IL", "Israel- RAANANA (Amdocs Site)", "Herzliya, Tel Aviv, Israel"])(
    "treats %s as Israeli",
    (l) => expect(isEightfoldIsrael(l)).toBe(true),
  );
  it.each(["Chicago, IL, US", "US", "United States - Remote", ""])("rejects %s", (l) =>
    expect(isEightfoldIsrael(l)).toBe(false),
  );
});

describe("Oracle Recruiting Cloud adapter (fixture)", () => {
  it("resolves the Israel facet, lists by location id and merges the detail", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: unknown) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.includes("recruitingCEJobRequisitionDetails")) return json(orDetail);
      return json(url.includes("facetsList=LOCATIONS") ? orProbe : orList);
    }) as unknown as typeof fetch;
    const board = "fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/CX";
    const jobs = await ingest<OracleRequisition>(oracleHcmAdapter, fetchImpl, board);
    expect(calls[1]).toContain("locationId=300000000392747");
    expect(calls[1]).toContain("expand=requisitionList.secondaryLocations");
    expect(calls[2]).toContain("finder=ById;Id=%224111%22,siteNumber=CX");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "ORACLE_HCM",
      externalId: "fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com:4111",
      title: "Human Resources Director – Israel",
      location: "Herzliya",
      applyUrl: "https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/4111",
    });
    expect(jobs[0].description).toContain("Herzliya");
  });
  it("returns nothing when the site has no Israel location", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ items: [{ TotalJobsCount: 0, requisitionList: [], locationsFacet: [{ Id: 1, Name: "India" }] }] }),
    ) as unknown as typeof fetch;
    expect(await oracleHcmAdapter.fetchRaw({ boardId: "acme.oraclecloud.com/CX_1", fetchImpl })).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Jibe adapter (fixture)", () => {
  it("keeps Israeli postings and links to the canonical job page", async () => {
    const fetchImpl = vi.fn(async () => json(jibeFixture)) as unknown as typeof fetch;
    const jobs = await ingest<JibeJob>(jibeAdapter, fetchImpl, "jobs.booking.com");
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      source: "JIBE",
      externalId: "jobs.booking.com:26946",
      applyUrl: "https://jobs.booking.com/booking/jobs/26946",
      location: "Tel Aviv",
    });
  });
});

describe("amazon.jobs adapter (fixture)", () => {
  it("reads the Israel search with description and qualifications", async () => {
    const fetchImpl = vi.fn(async () => json(amazonFixture)) as unknown as typeof fetch;
    const jobs = await ingest<AmazonJob>(amazonAdapter, fetchImpl, "ISR");
    expect(urlOf(vi.mocked(fetchImpl).mock.calls[0][0])).toContain("normalized_country_code%5B%5D=ISR");
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      source: "AMAZON",
      externalId: "10588958",
      location: "Haifa",
      applyUrl: "https://www.amazon.jobs/en/jobs/10588958/lab-engineer",
    });
    expect(jobs[0].description).toContain("Basic qualifications");
  });
});

describe("detection of Oracle Recruiting Cloud sites", () => {
  it("reads the site number from a candidate-experience link or the vanity page's API base", async () => {
    const { findBoards } = await import("@/lib/discovery/detect");
    expect(
      findBoards(
        '<a href="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/jobs">',
      ),
    ).toContainEqual({ provider: "ORACLE_HCM", boardId: "fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/CX" });
    expect(
      findBoards(
        '<div data-apibaseurl="https://enterpriseplatform.dell.com:443"></div><link href="/x?siteNumber=CX_1001">',
      ),
    ).toContainEqual({ provider: "ORACLE_HCM", boardId: "enterpriseplatform.dell.com/CX_1001" });
  });
});
