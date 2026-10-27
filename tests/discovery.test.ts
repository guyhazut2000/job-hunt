import { describe, expect, it, vi } from "vitest";
import { baseDomain, domainOf, isPlausibleCareersPage } from "@/lib/discovery/domain";
import { careersLinks, detectAts, findBoards, findComeet, PoliteFetcher } from "@/lib/discovery/detect";
import { isAllowedByRobots } from "@/lib/discovery/robots";
import { decide, mergeByDomain } from "@/lib/discovery/run";
import { parseTechMapCompany, parseWikidataRow, parseYcCompany, type DiscoveredStartup } from "@/lib/discovery/sources";
import { readTar } from "@/lib/discovery/tar";

describe("robots.txt", () => {
  it("honours Disallow: / for everyone", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow: /", "/careers")).toBe(false);
  });
  it("treats an empty Disallow as allow-all", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow:", "/careers")).toBe(true);
  });
  it("uses the longest matching rule and wildcards", () => {
    const txt = "User-agent: *\nDisallow: /careers\nAllow: /careers/open\nDisallow: /*.pdf$";
    expect(isAllowedByRobots(txt, "/careers/team")).toBe(false);
    expect(isAllowedByRobots(txt, "/careers/open-roles")).toBe(true);
    expect(isAllowedByRobots(txt, "/files/a.pdf")).toBe(false);
    expect(isAllowedByRobots(txt, "/files/a.pdf?x")).toBe(true);
  });
  it("prefers a group naming our bot over *", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: job-hunt-bot\nAllow: /";
    expect(isAllowedByRobots(txt, "/careers")).toBe(true);
  });
  it("groups consecutive user-agent lines", () => {
    const txt = "User-agent: foo\nUser-agent: *\nDisallow: /jobs";
    expect(isAllowedByRobots(txt, "/jobs")).toBe(false);
    expect(isAllowedByRobots(txt, "/")).toBe(true);
  });
  it("allows everything without a robots.txt", () => {
    expect(isAllowedByRobots(null, "/anything")).toBe(true);
  });
});

describe("domains", () => {
  it("normalizes hosts and rejects LinkedIn/Google", () => {
    expect(domainOf("https://www.Acme.io/about")).toBe("acme.io");
    expect(domainOf("acme.co.il")).toBe("acme.co.il");
    expect(domainOf("https://www.linkedin.com/company/acme")).toBeNull();
    expect(domainOf("https://sites.google.com/acme")).toBeNull();
    expect(domainOf("localhost")).toBeNull();
  });
  it("finds the company domain", () => {
    expect(baseDomain("jobs.acme.co.il")).toBe("acme.co.il");
    expect(baseDomain("careers.acme.com")).toBe("acme.com");
  });
  it("only accepts careers pages on the company's own site or a hosted ATS", () => {
    expect(isPlausibleCareersPage("https://acme.com/careers", "https://www.acme.com")).toBe(true);
    expect(isPlausibleCareersPage("https://jobs.acme.com/", "https://acme.com")).toBe(true);
    expect(isPlausibleCareersPage("https://www.comeet.com/jobs/acme/AA.001", "https://acme.com")).toBe(true);
    expect(isPlausibleCareersPage("https://other.ca/en/job/", "https://acme.com")).toBe(false);
    expect(isPlausibleCareersPage("https://acme.com/en/insights", "https://acme.com")).toBe(false);
    expect(isPlausibleCareersPage("https://www.linkedin.com/company/acme/jobs", "https://acme.com")).toBe(false);
  });
});

describe("ATS detection from HTML", () => {
  it("finds boards of every supported ATS", () => {
    const html = `
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>
      <a href="https://jobs.eu.lever.co/acme-eu">Lever</a>
      <a href="https://jobs.ashbyhq.com/Acme.ai">Ashby</a>
      <a href="https://apply.workable.com/acme-ltd/">Workable</a>
      <a href="https://careers.smartrecruiters.com/AcmeInc1">SR</a>
      <a href="https://acmeil.recruitee.com/">Recruitee</a>
      <a href="https://acme.wd3.myworkdayjobs.com/en-US/External">Workday</a>
      <a href="https://boards.greenhouse.io/embed">noise</a>`;
    expect(findBoards(html)).toEqual([
      { provider: "GREENHOUSE", boardId: "acme" },
      { provider: "LEVER", boardId: "eu:acme-eu" },
      { provider: "ASHBY", boardId: "Acme.ai" },
      { provider: "WORKABLE", boardId: "acme-ltd" },
      { provider: "SMARTRECRUITERS", boardId: "AcmeInc1" },
      { provider: "RECRUITEE", boardId: "acmeil" },
      { provider: "WORKDAY", boardId: "acme/wd3/External" },
    ]);
  });
  it("reads Comeet uid and upper-case token, ignoring other widgets' lower-case tokens", () => {
    const html = `comeet({ "company-uid": "A1.00B", token: "ABCDEF0123456789AB" }); hs({token: "d0f813778d7245e7a2d29bddb257886d"})
      <a href="https://www.comeet.com/jobs/acme/A1.00B">jobs</a>`;
    expect(findComeet(html)).toEqual({
      uids: ["A1.00B"],
      tokens: ["ABCDEF0123456789AB"],
      hosted: [{ slug: "acme", uid: "A1.00B" }],
    });
  });
  it("finds careers links on a homepage, never LinkedIn", () => {
    const html = `<a href="/about">About</a><a href="/company/careers">Careers</a>
      <a href="https://www.linkedin.com/company/acme/jobs">Jobs on LinkedIn</a><a href="/he/דרושים">דרושים</a>`;
    expect(careersLinks(html, "https://acme.com/")).toEqual([
      "https://acme.com/company/careers",
      "https://acme.com/he/%D7%93%D7%A8%D7%95%D7%A9%D7%99%D7%9D",
    ]);
  });
});

function site(pages: Record<string, { status?: number; body: string }>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const page = pages[url];
    const res = new Response(page?.body ?? "not found", {
      status: page ? (page.status ?? 200) : 404,
      headers: { "content-type": url.endsWith("robots.txt") ? "text/plain" : "text/html" },
    });
    Object.defineProperty(res, "url", { value: url });
    return res;
  }) as unknown as typeof fetch;
}

describe("detectAts", () => {
  it("follows the homepage careers link and verifies the board", async () => {
    const fetchImpl = site({
      "https://acme.com": { body: `<a href="/careers">Careers</a>` },
      "https://acme.com/careers": { body: `<iframe src="https://jobs.lever.co/acme"></iframe>` },
    });
    const verify = vi.fn(async () => ({ total: 5, israel: 3 }));
    const r = await detectAts({ website: "https://acme.com/" }, { fetcher: new PoliteFetcher(fetchImpl), verify });
    expect(r).toMatchObject({
      board: { provider: "LEVER", boardId: "acme" },
      israelJobs: 3,
      careersUrl: "https://acme.com/careers",
      pageLoaded: true,
    });
  });
  it("respects robots.txt and tries the next board when one has no jobs", async () => {
    const fetchImpl = site({
      "https://acme.com/robots.txt": { body: "User-agent: *\nDisallow: /careers" },
      "https://acme.com": { body: `<a href="/careers">Careers</a>` },
      "https://acme.com/careers": { body: `<a href="https://jobs.lever.co/blocked">x</a>` },
      "https://acme.com/jobs": {
        body: `<a href="https://jobs.lever.co/old">x</a><a href="https://jobs.ashbyhq.com/acme">y</a>`,
      },
    });
    const verify = vi.fn(async (b: { provider: string }) =>
      b.provider === "ASHBY" ? { total: 2, israel: 2 } : { total: 0, israel: 0 },
    );
    const r = await detectAts({ website: "https://acme.com" }, { fetcher: new PoliteFetcher(fetchImpl), verify });
    expect(fetchImpl).not.toHaveBeenCalledWith("https://acme.com/careers", expect.anything());
    expect(r.board).toEqual({ provider: "ASHBY", boardId: "acme" });
    expect(r.rejected).toEqual(["LEVER:old"]);
  });
  it("uses source hints and the Comeet-hosted page for the token", async () => {
    const fetchImpl = site({
      "https://www.comeet.com/jobs/acme/AA.00F": { body: `{"token":"0123456789ABCDEF01"}` },
    });
    const verify = vi.fn(async () => ({ total: 4, israel: 4 }));
    const r = await detectAts(
      { website: "https://acme.com", hints: { comeet: "acme/AA.00F" } },
      { fetcher: new PoliteFetcher(fetchImpl), verify },
    );
    expect(r.board).toEqual({ provider: "COMEET", boardId: "AA.00F:0123456789ABCDEF01" });
  });
  it("never requests LinkedIn", async () => {
    const fetchImpl = site({
      "https://acme.com": { body: `<a href="https://www.linkedin.com/company/acme/jobs">Jobs</a>` },
    });
    await detectAts(
      { website: "https://acme.com" },
      { fetcher: new PoliteFetcher(fetchImpl), verify: async () => null },
    );
    for (const [url] of (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls)
      expect(String(url)).not.toMatch(/linkedin/);
  });
});

describe("decide", () => {
  const board = { provider: "GREENHOUSE" as const, boardId: "acme" };
  it("adds a verified board with Israeli jobs as AUTO", () => {
    expect(decide("WIKIDATA", { board, israelJobs: 2, pageLoaded: true, careersUrl: null }, "https://acme.com")).toBe(
      "AUTO",
    );
  });
  it("trusts Israeli directories even with no Israeli opening today", () => {
    expect(decide("TECHMAP", { board, israelJobs: 0, pageLoaded: true, careersUrl: null }, "https://acme.com")).toBe(
      "AUTO",
    );
    expect(decide("WIKIDATA", { board, israelJobs: 0, pageLoaded: true, careersUrl: null }, "https://acme.com")).toBe(
      "PENDING",
    );
  });
  it("lists trusted companies without a feed as MANUAL only with a plausible careers page", () => {
    const base = { board: null, israelJobs: 0, pageLoaded: true };
    expect(decide("YC", { ...base, careersUrl: "https://acme.com/careers" }, "https://acme.com")).toBe("MANUAL");
    expect(decide("YC", { ...base, careersUrl: "https://other.com/careers" }, "https://acme.com")).toBe("PENDING");
    expect(
      decide("YC", { ...base, pageLoaded: false, careersUrl: "https://acme.com/careers" }, "https://acme.com"),
    ).toBe("PENDING");
    expect(decide("WIKIDATA", { ...base, careersUrl: "https://acme.com/careers" }, "https://acme.com")).toBe("PENDING");
  });
});

describe("sources", () => {
  it("maps TechMap companies, keeping ATS hints and skipping tiny/inactive ones", () => {
    const hiring = new Set(["Tiny Hiring"]);
    const c = parseTechMapCompany(
      "51-1",
      {
        name: "Acme",
        websiteUrl: "https://www.acme.io",
        careersUrl: "https://www.linkedin.com/company/acme/jobs",
        size: "l",
        categoryId: 7,
        comeetId: "acme/AA.00F",
        greenhouseId: "acme",
        addresses: [{ city: "Tel Aviv" }],
        isActive: true,
      },
      hiring,
    );
    expect(c).toMatchObject({
      name: "Acme",
      domain: "acme.io",
      industry: "Cybersecurity",
      location: "Tel Aviv",
      careersUrl: undefined,
      hints: { greenhouse: "acme", comeet: "acme/AA.00F" },
      priority: 60,
    });
    expect(
      parseTechMapCompany("1", { name: "Old", websiteUrl: "https://old.io", size: "l", isActive: false }, hiring),
    ).toBeNull();
    expect(parseTechMapCompany("2", { name: "Tiny", websiteUrl: "https://tiny.io", size: "xs" }, hiring)).toBeNull();
    expect(
      parseTechMapCompany("3", { name: "Tiny Hiring", websiteUrl: "https://th.io", size: "xs" }, hiring),
    ).not.toBeNull();
  });
  it("keeps only active Israeli YC companies", () => {
    expect(
      parseYcCompany({
        name: "A",
        website: "https://a.ai",
        regions: ["Israel"],
        status: "Active",
        batch: "Winter 2024",
        isHiring: true,
      }),
    ).toMatchObject({
      domain: "a.ai",
      foundedYear: 2024,
      priority: 40,
    });
    expect(parseYcCompany({ name: "B", website: "https://b.ai", regions: ["Israel"], status: "Inactive" })).toBeNull();
    expect(parseYcCompany({ name: "C", website: "https://c.ai", regions: ["United States of America"] })).toBeNull();
  });
  it("drops non-tech and unlabeled Wikidata rows", () => {
    const row = (industry?: string, label = "Acme") => ({
      cLabel: { value: label },
      site: { value: "https://acme.co.il" },
      founded: { value: "2015-01-01T00:00:00Z" },
      ...(industry ? { industry: { value: industry } } : {}),
    });
    expect(parseWikidataRow(row("software industry"))).toMatchObject({ domain: "acme.co.il", foundedYear: 2015 });
    expect(parseWikidataRow(row("real estate"))).toBeNull();
    expect(parseWikidataRow(row(undefined, "Q123"))).toBeNull();
  });
  it("merges sources by domain, keeping the best priority and all hints", () => {
    const a: DiscoveredStartup = {
      name: "Acme",
      website: "https://acme.io",
      domain: "acme.io",
      source: "WIKIDATA",
      priority: 5,
      careersUrl: "https://acme.io/jobs",
    };
    const b: DiscoveredStartup = {
      name: "Acme Ltd",
      website: "https://acme.io",
      domain: "acme.io",
      source: "TECHMAP",
      priority: 40,
      hints: { lever: "acme" },
    };
    expect(mergeByDomain([a, b])).toEqual([
      expect.objectContaining({ source: "TECHMAP", careersUrl: "https://acme.io/jobs", hints: { lever: "acme" } }),
    ]);
  });
});

function tarFile(name: string, body: string): Buffer {
  const data = Buffer.from(body);
  const header = Buffer.alloc(512);
  header.write(name, 0);
  header.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
  header.write("0", 156);
  header.write("ustar\0", 257);
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

describe("readTar", () => {
  it("reads files, pax paths, and filters", () => {
    const paxBody = "30 path=repo/companies/long.json\n";
    const pax = tarFile("PaxHeader", paxBody);
    pax[156] = "x".charCodeAt(0);
    const buf = Buffer.concat([tarFile("repo/README.md", "hi"), pax, tarFile("short", '{"a":1}'), Buffer.alloc(1024)]);
    const entries = [...readTar(buf, (p) => p.endsWith(".json"))];
    expect(entries.map((e) => [e.path, e.data.toString()])).toEqual([["repo/companies/long.json", '{"a":1}']]);
  });
});
