import { describe, expect, it, vi } from "vitest";
import comeetFixture from "./fixtures/comeet-positions.json";
import greenhouseFixture from "./fixtures/greenhouse-board.json";
import leverFixture from "./fixtures/lever-postings.json";
import { comeetAdapter, type ComeetPosition } from "@/lib/ingestion/adapters/comeet";
import { greenhouseAdapter, type GreenhouseJob } from "@/lib/ingestion/adapters/greenhouse";
import { leverAdapter, leverUrl, type LeverPosting } from "@/lib/ingestion/adapters/lever";
import { isIsraelLocation, normalizeLocation } from "@/lib/ingestion/location";
import { JOB_SOURCES } from "@/lib/ingestion/sources";
import type { AtsAdapter, NormalizedJob } from "@/lib/ingestion/types";

const jsonFetch = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

async function ingestFixture<R>(adapter: AtsAdapter<R>, body: unknown, boardId: string) {
  const raws = await adapter.fetchRaw({ boardId, fetchImpl: jsonFetch(body) });
  return raws
    .filter((r) => adapter.isInIsrael(r))
    .map((r) => adapter.normalize(r))
    .filter((j): j is NormalizedJob => j !== null);
}

describe("Israel location filter", () => {
  it.each([
    "Tel Aviv-Yafo, Tel Aviv District, Israel",
    "Tel Aviv-Yafo Municipality, ISR",
    "Remote - Israel",
    "Herzliya Pituach",
    "Petach Tikva",
    "Ramat Gan (Hybrid)",
    "Yoqneam",
    "Be'er Sheva",
    "תל אביב",
    "ירושלים",
  ])("accepts %s", (l) => expect(isIsraelLocation(l)).toBe(true));

  it.each(["Chicago, IL", "New York, NY", "Remote", "London, UK", "Berlin, Germany", "", null])("rejects %s", (l) =>
    expect(isIsraelLocation(l)).toBe(false),
  );

  it("canonicalizes Hebrew/English city names", () => {
    expect(normalizeLocation("Tel Aviv-Yafo, Tel Aviv District, Israel")).toBe("Tel Aviv");
    expect(normalizeLocation("תל אביב")).toBe("Tel Aviv");
    expect(normalizeLocation("Herzliya, Israel", "Tel Aviv, Israel")).toBe("Herzliya / Tel Aviv");
    expect(normalizeLocation("Petach Tikva")).toBe("Petah Tikva");
    expect(normalizeLocation("Remote - Israel")).toBe("Israel");
    expect(normalizeLocation(null, "")).toBe("Israel");
  });
});

describe("Greenhouse adapter (fixture)", () => {
  it("keeps only Israeli jobs and normalizes them", async () => {
    const jobs = await ingestFixture<GreenhouseJob>(greenhouseAdapter, greenhouseFixture, "acme");
    expect(jobs.map((j) => j.externalId)).toEqual(["7001", "7002", "7004"]);
    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      location: "Tel Aviv",
      seniority: "SENIOR",
      roleCategory: "backend",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/7001",
    });
    expect(jobs[0]!.techStack).toEqual(expect.arrayContaining(["Go", "Kafka", "ClickHouse", "Kubernetes"]));
    expect(jobs[0]!.description).toContain("Kubernetes's");
    // Remote posting attached to the Israel office
    expect(jobs[1]).toMatchObject({
      location: "Israel",
      workMode: "REMOTE",
      roleCategory: "product",
      seniority: "MID",
    });
    expect(jobs[2]).toMatchObject({ location: "Tel Aviv", roleCategory: "hardware" });
    expect(jobs[2]!.techStack).toEqual(expect.arrayContaining(["Verilog", "SystemVerilog", "Python"]));
  });
});

describe("Lever adapter (fixture)", () => {
  it("uses the EU host for eu: board ids", () => {
    expect(leverUrl("acme")).toBe("https://api.lever.co/v0/postings/acme?mode=json");
    expect(leverUrl("eu:mobileye")).toBe("https://api.eu.lever.co/v0/postings/mobileye?mode=json");
  });

  it("filters by country or any Israeli location", async () => {
    const jobs = await ingestFixture<LeverPosting>(leverAdapter, leverFixture, "acme");
    expect(jobs.map((j) => j.externalId)).toEqual(["aaaa-1111", "bbbb-2222"]);
    expect(jobs[0]).toMatchObject({
      location: "Petah Tikva",
      workMode: "HYBRID",
      seniority: "LEAD",
      roleCategory: "fullstack",
    });
    expect(jobs[0]!.techStack).toEqual(expect.arrayContaining(["React", "Node.js", "TypeScript", "AWS"]));
    expect(jobs[1]).toMatchObject({ location: "Jerusalem", roleCategory: "hardware" });
  });
});

describe("Comeet adapter (fixture)", () => {
  it("filters to Israel and handles Hebrew titles", async () => {
    const jobs = await ingestFixture<ComeetPosition>(comeetAdapter, comeetFixture, "uid:token");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ location: "Tel Aviv", seniority: "SENIOR", workMode: "HYBRID" });
    expect(jobs[0]!.techStack).toEqual(expect.arrayContaining(["Java", "Spring"]));
  });
});

describe("curated sources", () => {
  it("has unique slugs/boards and valid formats", () => {
    expect(JOB_SOURCES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(JOB_SOURCES.map((s) => s.slug)).size).toBe(JOB_SOURCES.length);
    expect(new Set(JOB_SOURCES.map((s) => `${s.provider}:${s.boardId}`)).size).toBe(JOB_SOURCES.length);
    for (const s of JOB_SOURCES) {
      expect(s.website).toMatch(/^https:\/\//);
      expect(s.provider).not.toBe("COMEET"); // Comeet needs a company-issued token; none are configured.
    }
  });
});

describe("polite fetching", () => {
  it("retries a transient 503 once, then succeeds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [] }), { status: 200 })) as unknown as typeof fetch;
    const p = greenhouseAdapter.fetchRaw({ boardId: "acme", fetchImpl });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not retry a 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    await expect(leverAdapter.fetchRaw({ boardId: "gone", fetchImpl })).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
