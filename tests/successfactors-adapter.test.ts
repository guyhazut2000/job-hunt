import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseJobPage,
  parseSearchPage,
  parseSuccessFactorsBoard,
  successFactorsAdapter,
} from "@/lib/ingestion/adapters/successfactors";
import { MANUAL_COMPANIES } from "@/lib/companies/manual";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { JOB_SOURCES } from "@/lib/ingestion/sources";

const fixture = (f: string) => readFileSync(join(__dirname, "fixtures", f), "utf8");
const SEARCH = fixture("successfactors-search.html");
const JOB = fixture("successfactors-job.html");
const urlOf = (input: unknown) => String(input instanceof Request ? input.url : input);

describe("SuccessFactors Career Site Builder adapter (Teradyne)", () => {
  it("is registered and Teradyne syncs automatically", () => {
    expect(SUPPORTED_PROVIDERS).toContain("SUCCESSFACTORS");
    const t = JOB_SOURCES.find((s) => s.slug === "teradyne");
    expect(t?.provider).toBe("SUCCESSFACTORS");
    expect(t?.boardId).toBe("jobs.teradyne.com");
    expect(MANUAL_COMPANIES.some((c) => c.slug === "teradyne")).toBe(false);
  });

  it("validates the board host", () => {
    expect(parseSuccessFactorsBoard("Jobs.Teradyne.com").base).toBe("https://jobs.teradyne.com");
    expect(() => parseSuccessFactorsBoard("https://x/y")).toThrow();
  });

  it("parses the search results table", () => {
    const { jobs, total } = parseSearchPage(SEARCH);
    expect(total).toBe(7);
    expect(jobs).toHaveLength(7);
    expect(jobs[0]).toMatchObject({
      id: "1434408800",
      title: "Senior Silicon Photonics PIC Design Engineer (SiPh Test Solutions, Haifa, Israel)",
      location: "Haifa, IL",
      department: "Engineering",
    });
    expect(jobs[0].path).toMatch(/^\/Teradyne\/job\/.+\/1434408800\/$/);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(7);
  });

  it("reads the description and posting date from the job page microdata", () => {
    const { description, postedAt } = parseJobPage(JOB);
    expect(postedAt).toBe("2026-10-02T00:00:00.000Z");
    expect(description).toContain("global test and automation specialists");
    expect(description).not.toContain("Job Segment");
  });

  it("fetches only robots-allowed paths and normalizes to an Israeli job", async () => {
    const fetchImpl = vi.fn(async (input: unknown) => {
      const url = urlOf(input);
      return new Response(url.includes("/search/") ? SEARCH : JOB, { status: 200 });
    }) as unknown as typeof fetch;
    const ctx = { boardId: "jobs.teradyne.com", fetchImpl };
    const raws = (await successFactorsAdapter.fetchRaw(ctx)).filter((r) => successFactorsAdapter.isInIsrael(r));
    expect(raws).toHaveLength(7);
    const full = await successFactorsAdapter.detail!.fetch(raws[0], ctx);
    const job = successFactorsAdapter.normalize(full)!;
    expect(job.externalId).toBe("jobs.teradyne.com:1434408800");
    expect(successFactorsAdapter.detail!.externalId(raws[0], ctx)).toBe(job.externalId);
    expect(job.applyUrl).toMatch(/^https:\/\/jobs\.teradyne\.com\/Teradyne\/job\//);
    expect(job.location).toMatch(/Haifa/);
    expect(job.description.length).toBeGreaterThan(200);
    const urls = vi.mocked(fetchImpl).mock.calls.map((c) => urlOf(c[0]));
    expect(urls[0]).toBe("https://jobs.teradyne.com/search/?q=&locationsearch=Israel&startrow=0");
    for (const u of urls) expect(u).not.toMatch(/\/(services|talentcommunity|applybutton|preapply)\//);
  });
});
