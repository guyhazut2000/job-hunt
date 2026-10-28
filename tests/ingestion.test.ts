import { describe, expect, it, vi } from "vitest";
import { comeetAdapter } from "@/lib/ingestion/adapters/comeet";
import { greenhouseAdapter } from "@/lib/ingestion/adapters/greenhouse";
import { leverAdapter } from "@/lib/ingestion/adapters/lever";
import { DEMO_COMPANIES, demoRawJobs } from "@/lib/ingestion/fixtures";
import { getAdapter, SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";

describe("ingestion adapters", () => {
  it("registers every public ATS adapter", () => {
    expect([...SUPPORTED_PROVIDERS].sort()).toEqual([
      "ASHBY",
      "COMEET",
      "GREENHOUSE",
      "LEVER",
      "RECRUITEE",
      "SMARTRECRUITERS",
      "WORDPRESS",
      "WORKABLE",
      "WORKDAY",
    ]);
    expect(getAdapter("MANUAL")).toBeUndefined();
  });

  it("normalizes Greenhouse jobs with escaped HTML content", () => {
    const job = greenhouseAdapter.normalize({
      id: 42,
      title: "Senior Backend Engineer",
      absolute_url: "https://example.com/j/42",
      first_published: "2026-10-01T10:00:00Z",
      location: { name: "Tel Aviv, Israel (Hybrid)" },
      content: "&lt;p&gt;Node.js and PostgreSQL&lt;/p&gt;",
    });
    expect(job).toMatchObject({
      externalId: "42",
      source: "GREENHOUSE",
      seniority: "SENIOR",
      roleCategory: "backend",
      workMode: "HYBRID",
      techStack: ["Node.js", "PostgreSQL"],
      description: "Node.js and PostgreSQL",
    });
  });

  it("normalizes Lever postings using workplaceType", () => {
    const job = leverAdapter.normalize({
      id: "abc",
      text: "Frontend Developer",
      hostedUrl: "https://jobs.lever.co/x/abc",
      createdAt: Date.UTC(2026, 9, 1),
      workplaceType: "remote",
      categories: { location: "Israel" },
      descriptionPlain: "React + TypeScript",
    });
    expect(job?.workMode).toBe("REMOTE");
    expect(job?.techStack).toEqual(["React", "TypeScript"]);
    expect(job?.postedAt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("normalizes Comeet positions and rejects ones without a URL", () => {
    const base = {
      uid: "A1",
      name: "DevOps Engineer",
      location: { city: "Haifa" },
      details: [{ name: "Req", value: "Kubernetes, Terraform" }],
    };
    expect(comeetAdapter.normalize({ ...base, url_active_page: "https://c.co/a1" })).toMatchObject({
      location: "Haifa",
      roleCategory: "devops",
      techStack: ["Kubernetes", "Terraform"],
    });
    expect(comeetAdapter.normalize(base)).toBeNull();
  });

  it("builds the right URLs when fetching", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ jobs: [] }))) as unknown as typeof fetch;
    await greenhouseAdapter.fetchRaw({ boardId: "acme", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true&pay_transparency=true",
      expect.objectContaining({
        headers: expect.objectContaining({ "user-agent": expect.stringContaining("job-hunt") }),
      }),
    );
    await expect(comeetAdapter.fetchRaw({ boardId: "missing-token", fetchImpl })).rejects.toThrow(/uid:token/);
  });

  it("demo fixtures all normalize", () => {
    for (const [i, c] of DEMO_COMPANIES.entries()) {
      for (const raw of demoRawJobs(c, i, Date.UTC(2026, 9, 27))) {
        const job = raw.greenhouse
          ? greenhouseAdapter.normalize(raw.greenhouse)
          : raw.lever
            ? leverAdapter.normalize(raw.lever)
            : comeetAdapter.normalize(raw.comeet!);
        expect(job).not.toBeNull();
        expect(job!.techStack.length).toBeGreaterThan(0);
      }
    }
  });
});
