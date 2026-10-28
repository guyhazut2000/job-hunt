import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiLimitError } from "@/lib/ai/errors";
import type { LLMProvider } from "@/lib/ai/types";
import { discoverProcessPages, failureOf, siteKey, sitemapLocs } from "@/lib/hiring/discover";
import { communityLinks } from "@/lib/hiring/community";
import { Pacer } from "@/lib/hiring/run";
import {
  extractHiringProcess,
  groundStages,
  hasProcessSignals,
  heuristicExtract,
  jobProcessSource,
  locateEvidence,
  normalizeForMatch,
  processPassages,
  type SourcePage,
} from "@/lib/hiring/extract";
import {
  embeddedText,
  fetchPublicPage,
  htmlToText,
  isBlockedUrl,
  pageLinks,
  pageTitle,
  rawLinks,
  robotsSitemaps,
} from "@/lib/hiring/fetch";
import { detectKind, prepLinkFor, STAGE_KINDS, STAGE_LABELS } from "@/lib/hiring/kinds";
import { hiringStrings } from "@/lib/i18n/hiring-process";

// No network in this suite: any real fetch (and especially LinkedIn / Google) fails the test.
const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    throw new Error(`unexpected network call: ${String(input)}`);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const PAGE_TEXT = `Careers at Acme
Our hiring process
We want you to know what to expect. Here is how we hire:
1. Recruiter call – a 30 minute conversation with our talent team about your experience.
2. Technical interview with two engineers, focused on problem solving.
3. Home assignment that takes about 3 hours to complete.
4. Meet the team and the hiring manager.
5. Offer – we call you with an offer and walk you through it.
We offer great benefits and an equal opportunity workplace.`;

const PAGE: SourcePage = {
  url: "https://acme.example/careers/how-we-hire",
  title: "How we hire | Acme",
  text: PAGE_TEXT,
  origin: "page",
};

function fakeLlm(payload: unknown, name = "gemini"): LLMProvider {
  return { name, complete: vi.fn(async () => JSON.stringify(payload)) };
}

describe("stage kinds", () => {
  it("detects stage kinds in English and Hebrew", () => {
    expect(detectKind("Recruiter call with our talent team")).toBe("phone_screen");
    expect(detectKind("Home assignment")).toBe("home_assignment");
    expect(detectKind("System design interview")).toBe("system_design");
    expect(detectKind("ראיון טכני עם שני מהנדסים")).toBe("technical");
    expect(detectKind("something unrelated")).toBe("other");
  });
  it("does not read 'we offer benefits' as an offer stage", () => {
    expect(detectKind("We offer great benefits")).not.toBe("offer");
  });
  it("has a Hebrew and English label for every kind", () => {
    for (const k of STAGE_KINDS) {
      expect(STAGE_LABELS.he[k]).toBeTruthy();
      expect(STAGE_LABELS.en[k]).toBeTruthy();
    }
  });
  it("links technical stages to /learn prep and HR stages to nothing", () => {
    expect(prepLinkFor("system_design")).toEqual({ href: "/learn/networking", skill: "networking" });
    const tech = prepLinkFor("technical", ["Go", "Kubernetes"]);
    expect(tech?.href.startsWith("/learn")).toBe(true);
    expect(prepLinkFor("coding", [])).toEqual({ href: "/learn" });
    expect(prepLinkFor("hr", ["Go"])).toBeNull();
    expect(prepLinkFor("offer")).toBeNull();
  });
});

describe("polite fetching", () => {
  it("never fetches LinkedIn, Glassdoor, Google or login pages", () => {
    expect(isBlockedUrl("https://www.linkedin.com/company/acme/jobs")).toBe(true);
    expect(isBlockedUrl("https://il.linkedin.com/jobs/view/1")).toBe(true);
    expect(isBlockedUrl("https://www.glassdoor.com/Interview/acme")).toBe(true);
    expect(isBlockedUrl("https://www.google.com/search?q=acme")).toBe(true);
    expect(isBlockedUrl("https://acme.example/login")).toBe(true);
    expect(isBlockedUrl("ftp://acme.example/careers")).toBe(true);
    expect(isBlockedUrl("not a url")).toBe(true);
    expect(isBlockedUrl("https://acme.example/careers/how-we-hire")).toBe(false);
  });
  it("refuses blocked URLs without any network call", async () => {
    const res = await fetchPublicPage("https://www.linkedin.com/company/acme");
    expect(res).toEqual({ ok: false, url: "https://www.linkedin.com/company/acme", reason: "blocked" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("honours robots.txt", async () => {
    const fetchImpl = vi.fn(async () => new Response("User-agent: *\nDisallow: /careers", { status: 200 }));
    const res = await fetchPublicPage("https://acme.example/careers/how-we-hire", { fetchImpl, minIntervalMs: 0 });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe("robots");
    expect(fetchImpl).toHaveBeenCalledTimes(1); // only robots.txt
  });
  it("converts HTML to text, title and links", () => {
    const html = `<html><head><title>How we hire &amp; grow</title><style>.x{}</style></head><body>
      <script>var a = 1;</script><h1>Our process</h1><ul><li>Recruiter call</li><li>Technical interview</li></ul>
      <a href="/careers/interview-process">Interview process</a></body></html>`;
    expect(pageTitle(html)).toBe("How we hire & grow");
    const text = htmlToText(html);
    expect(text).toContain("Recruiter call");
    expect(text).toContain("Technical interview");
    expect(text).not.toContain("var a");
    expect(pageLinks(html, "https://acme.example/careers")[0]?.href).toBe(
      "https://acme.example/careers/interview-process",
    );
  });
  it("computes same-site keys including two-level TLDs", () => {
    expect(siteKey("https://careers.acme.co.il/x")).toBe("acme.co.il");
    expect(siteKey("https://www.acme.com")).toBe("acme.com");
  });
});

describe("process passages and heuristic", () => {
  it("keeps only the text around the process description", () => {
    const text = `${"lorem ipsum ".repeat(400)}\n${PAGE_TEXT}`;
    const p = processPassages(text);
    expect(p).toContain("Recruiter call");
    expect(p.length).toBeLessThan(text.length);
    expect(processPassages("We sell shoes.")).toBe("");
  });
  it("detects process signals in a job description", () => {
    expect(hasProcessSignals(PAGE_TEXT)).toBe(true);
    expect(hasProcessSignals("Great culture. Apply now.")).toBe(false);
  });
  it("extracts verbatim stages and skips boilerplate", () => {
    const stages = heuristicExtract([PAGE]);
    const kinds = stages.map((s) => s.kind);
    expect(kinds).toContain("phone_screen");
    expect(kinds).toContain("home_assignment");
    for (const s of stages) expect(normalizeForMatch(PAGE_TEXT)).toContain(normalizeForMatch(s.evidence));
    expect(stages.some((s) => /benefits/i.test(s.evidence))).toBe(false);
  });
});

describe("grounding", () => {
  it("drops stages whose evidence is not in the source", () => {
    const kept = groundStages(
      [
        {
          kind: "phone_screen",
          title: "Recruiter call",
          detailHe: null,
          detailEn: null,
          duration: "30 minute",
          evidence: "Recruiter call – a 30 minute conversation with our talent team",
          sourceUrl: PAGE.url,
        },
        {
          kind: "system_design",
          title: "System design",
          detailHe: null,
          detailEn: null,
          duration: null,
          evidence: "A system design round with a principal engineer", // invented
          sourceUrl: PAGE.url,
        },
      ],
      [PAGE],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ kind: "phone_screen", duration: "30 minute", sourceUrl: PAGE.url });
  });
  it("ignores evidence that is too short to be meaningful", () => {
    const kept = groundStages(
      [
        {
          kind: "hr",
          title: "HR",
          detailHe: null,
          detailEn: null,
          duration: null,
          evidence: "team",
          sourceUrl: PAGE.url,
        },
      ],
      [PAGE],
    );
    expect(kept).toHaveLength(0);
  });
});

describe("extractHiringProcess", () => {
  const stage = (kind: string, evidence: string, sourceUrl = PAGE.url) => ({
    kind,
    title: evidence.slice(0, 30),
    detailHe: "תיאור",
    detailEn: "Detail",
    duration: null,
    evidence,
    sourceUrl,
  });

  it("returns grounded LLM stages with sources and confidence", async () => {
    const llm = fakeLlm({
      hasProcess: true,
      estimatedDuration: "3 weeks", // not in the source → dropped
      notesHe: null,
      notesEn: null,
      stages: [
        stage("phone_screen", "Recruiter call – a 30 minute conversation with our talent team"),
        stage("technical", "Technical interview with two engineers, focused on problem solving"),
        stage("home_assignment", "Home assignment that takes about 3 hours to complete"),
        stage("executive", "Final interview with our CEO in Paris"), // invented → dropped
      ],
    });
    const res = await extractHiringProcess("Acme", [PAGE], llm);
    expect(res.status).toBe("found");
    expect(res.method).toBe("gemini");
    expect(res.stages.map((s) => s.kind)).toEqual(["phone_screen", "technical", "home_assignment"]);
    expect(res.sourceUrls).toEqual([PAGE.url]);
    expect(res.confidence).toBe("high");
    expect(res.estimatedDuration).toBeNull();
  });

  it("returns none when the model finds no process", async () => {
    const llm = fakeLlm({ hasProcess: false, estimatedDuration: null, notesHe: null, notesEn: null, stages: [] });
    const res = await extractHiringProcess("Acme", [PAGE], llm);
    expect(res).toMatchObject({ status: "none", stages: [] });
  });

  it("publishes a single grounded stage from a dedicated process page at low confidence", async () => {
    const llm = fakeLlm({
      hasProcess: true,
      estimatedDuration: null,
      notesHe: null,
      notesEn: null,
      stages: [
        stage("phone_screen", "Recruiter call – a 30 minute conversation"),
        stage("onsite", "Fly to HQ for a day"),
      ],
    });
    const res = await extractHiringProcess("Acme", [PAGE], llm);
    expect(res).toMatchObject({ status: "found", confidence: "low" });
    expect(res.stages).toHaveLength(1);
  });

  it("returns none (below_threshold) for a single stage from a generic page", async () => {
    const generic: SourcePage = { ...PAGE, url: "https://acme.example/about", title: "About Acme" };
    const llm = fakeLlm({
      hasProcess: true,
      estimatedDuration: null,
      notesHe: null,
      notesEn: null,
      stages: [stage("phone_screen", "Recruiter call – a 30 minute conversation"), stage("onsite", "Fly to HQ")],
    });
    const res = await extractHiringProcess("Acme", [generic], llm);
    expect(res).toMatchObject({ status: "none", reason: "below_threshold" });
  });

  it("reports why nothing was found", async () => {
    const dropped = fakeLlm({
      hasProcess: true,
      estimatedDuration: null,
      notesHe: null,
      notesEn: null,
      stages: [stage("onsite", "Fly to HQ for a whole week of interviews")],
    });
    expect((await extractHiringProcess("Acme", [PAGE], dropped)).reason).toBe("grounding_dropped");
    const none = fakeLlm({ hasProcess: false, estimatedDuration: null, notesHe: null, notesEn: null, stages: [] });
    expect((await extractHiringProcess("Acme", [PAGE], none)).reason).toBe("llm_none");
    expect((await extractHiringProcess("Acme", [], null)).reason).toBe("no_pages");
  });

  it("caps job-description-only processes at medium confidence", async () => {
    const job: SourcePage = { ...PAGE, url: "https://jobs.acme.example/123", title: "Acme — Engineer", origin: "job" };
    const llm = fakeLlm({
      hasProcess: true,
      estimatedDuration: null,
      notesHe: null,
      notesEn: null,
      stages: [
        stage("phone_screen", "Recruiter call – a 30 minute conversation", job.url),
        stage("technical", "Technical interview with two engineers", job.url),
        stage("home_assignment", "Home assignment that takes about 3 hours", job.url),
      ],
    });
    const res = await extractHiringProcess("Acme", [job], llm);
    expect(res).toMatchObject({ status: "found", confidence: "medium" });
  });

  it("marks LLM failures as llm_failed and never falls back to guesses", async () => {
    const llm: LLMProvider = {
      name: "gemini",
      complete: vi.fn(async () => {
        throw new Error("quota");
      }),
    };
    const res = await extractHiringProcess("Acme", [PAGE], llm);
    expect(res).toMatchObject({ status: "none", method: "llm_failed", stages: [], limitHit: false });
  });

  it("flags quota/limit errors separately from transient LLM errors", async () => {
    const llm: LLMProvider = {
      name: "gemini",
      complete: vi.fn(async () => {
        throw new AiLimitError("provider_quota");
      }),
    };
    const res = await extractHiringProcess("Acme", [PAGE], llm);
    expect(res).toMatchObject({ method: "llm_failed", limitHit: true });
  });

  it("uses the heuristic with the mock provider, capped at low confidence", async () => {
    const res = await extractHiringProcess("Acme", [PAGE], fakeLlm({}, "mock"));
    expect(res.status).toBe("found");
    expect(res.method).toBe("heuristic");
    expect(res.confidence).toBe("low");
    expect(res.stages.length).toBeGreaterThanOrEqual(2);
  });

  it("returns none without any pages", async () => {
    expect((await extractHiringProcess("Acme", [], null)).status).toBe("none");
  });
});

describe("discovery", () => {
  it("only fetches same-site pages and follows hiring-process links", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      if (url === "https://acme.example/careers") {
        return new Response(
          `<title>Careers</title><a href="/careers/how-we-hire">How we hire</a>
           <a href="https://www.linkedin.com/company/acme">LinkedIn</a>
           <a href="https://www.glassdoor.com/acme">Reviews</a>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url === "https://acme.example/careers/how-we-hire") {
        return new Response(`<title>How we hire</title><p>${PAGE_TEXT}</p>`, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    const { pages, checked } = await discoverProcessPages(
      { slug: "acme", name: "Acme", website: null, careersUrl: "https://acme.example/careers" },
      { fetchImpl, minIntervalMs: 0, robotsCache: new Map() },
    );
    expect(pages.map((p) => p.url)).toContain("https://acme.example/careers/how-we-hire");
    expect(checked.map((c) => c.url)).toContain("https://acme.example/careers");
    expect(calls.some((u) => /linkedin|glassdoor|google/.test(u))).toBe(false);
  });
});

describe("fuzzy grounding", () => {
  it("matches quotes despite punctuation, bullets and small wording drift, returning the page's own span", () => {
    const text = "Step 2 — Technical interview: with two of our engineers, focused on problem-solving and code.";
    expect(locateEvidence("technical interview with two of our engineers", text)).toBe(
      "Technical interview: with two of our engineers",
    );
    // one word changed out of ~10 (≥ 85% overlap, same first/last token)
    expect(
      locateEvidence("Technical interview with two of the engineers, focused on problem-solving", text),
    ).not.toBeNull();
    expect(locateEvidence("A completely different sentence about lunch", text)).toBeNull();
  });
  it("matches Hebrew quotes ignoring niqqud and bidi marks", () => {
    const text = "שלב ראשון: שיחת טלפון קצרה עם המגייסת. שלב שני: ראיון מקצועי עם ראש הצוות.";
    expect(locateEvidence("\u200fראיון מקצועי עם ראש הצוות", text)).toContain("ראיון מקצועי");
  });
  it("matches quotes the model shortened with an ellipsis, in order", () => {
    const text = "First a recruiter call to get to know you. Then, after that, a home assignment of about 3 hours.";
    expect(locateEvidence("a recruiter call … a home assignment of about 3 hours", text)).not.toBeNull();
    expect(locateEvidence("a home assignment of about 3 hours … a recruiter call", text)).toBeNull();
  });
});

describe("discovery v2", () => {
  const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } });

  it("parses sitemaps and robots Sitemap lines", () => {
    expect(robotsSitemaps("User-agent: *\nSitemap: https://a.example/sm.xml\nsitemap: /rel.xml")).toContain(
      "https://a.example/sm.xml",
    );
    const urlset = sitemapLocs(
      `<urlset><url><loc>https://a.example/careers/how-we-hire</loc></url><url><loc>https://a.example/x</loc></url></urlset>`,
    );
    expect(urlset).toEqual({ index: false, locs: ["https://a.example/careers/how-we-hire", "https://a.example/x"] });
    expect(
      sitemapLocs(`<sitemapindex><sitemap><loc>https://a.example/p.xml</loc></sitemap></sitemapindex>`).index,
    ).toBe(true);
  });

  it("finds same-origin links inside JSON / data attributes", () => {
    const links = rawLinks(
      `<div data-props="{&quot;href&quot;:&quot;https:\/\/acme.example\/careers\/hiring-process&quot;}"></div>
       <script>{"u":"https:\/\/other.example\/x","v":"/careers/faq"}</script><img src="/logo.png">`,
      "https://acme.example/careers",
    );
    expect(links).toContain("https://acme.example/careers/hiring-process");
    expect(links.some((u) => u.includes("other.example"))).toBe(false);
    expect(links.some((u) => u.endsWith(".png"))).toBe(false);
  });

  it("reads text embedded in __NEXT_DATA__ for JS-rendered pages", () => {
    const t = embeddedText(
      `<script id="__NEXT_DATA__" type="application/json">{"props":{"body":"Our hiring process has three steps"}}</script>`,
    );
    expect(t).toContain("Our hiring process has three steps");
  });

  it("classifies bot walls (403 / challenge pages) without retrying or bypassing", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response("<title>Just a moment...</title>Checking your browser", { status: 403 });
    }) as typeof fetch;
    const res = await fetchPublicPage("https://walled.example/careers", {
      fetchImpl,
      minIntervalMs: 0,
      robotsCache: new Map(),
    });
    expect(res).toMatchObject({ ok: false, reason: "bot_wall" });
    const pageCalls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => !String(c[0]).endsWith("robots.txt"),
    );
    expect(pageCalls).toHaveLength(1);
  });

  it("uses sitemap.xml to find the process page and stops guessing on soft-404 sites", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/robots.txt"))
        return new Response("Sitemap: https://acme.example/sitemap.xml", { status: 200 });
      if (url === "https://acme.example/sitemap.xml")
        return new Response(
          `<urlset><url><loc>https://acme.example/join-us/our-interview-process</loc></url></urlset>`,
          { status: 200, headers: { "content-type": "application/xml" } },
        );
      if (url === "https://acme.example/join-us/our-interview-process")
        return html(`<title>Our interview process</title><p>${PAGE_TEXT}</p>`);
      // catch-all: every other path returns the same homepage (soft 404)
      return html(`<title>Acme</title><p>Welcome to Acme. We build things.</p>`);
    }) as typeof fetch;
    const res = await discoverProcessPages(
      { slug: "acme", name: "Acme", website: "https://acme.example", careersUrl: null },
      { fetchImpl, minIntervalMs: 0, robotsCache: new Map() },
    );
    expect(res.pages.map((p) => p.url)).toContain("https://acme.example/join-us/our-interview-process");
    expect(res.stats.sitemapUrls).toBeGreaterThan(0);
    expect(res.failure).toBeNull();
  });

  it("explains company-level failures", () => {
    const base = {
      fetches: 3,
      ok: 0,
      robots: 0,
      botWall: 0,
      notFound: 0,
      softNotFound: 0,
      network: 0,
      jsShell: 0,
      sitemapUrls: 0,
    };
    expect(failureOf({ ...base, botWall: 3 })).toBe("bot_wall");
    expect(failureOf({ ...base, robots: 2, network: 1 })).toBe("robots");
    expect(failureOf({ ...base, network: 3 })).toBe("unreachable");
    expect(failureOf({ ...base, ok: 2, jsShell: 2 })).toBe("js_rendered");
    expect(failureOf({ ...base, ok: 2 })).toBe("no_process_text");
    expect(failureOf({ ...base, fetches: 0 })).toBe("no_website");
  });

  it("ignores job descriptions whose only 'process' text is boilerplate", () => {
    expect(
      jobProcessSource({
        url: "https://jobs.acme.example/1",
        title: "Engineer",
        text: "We use AI in our recruitment process. If you need an accommodation during the interview process, contact us.",
      }),
    ).toBeNull();
    expect(jobProcessSource({ url: "https://jobs.acme.example/2", title: "Engineer", text: PAGE_TEXT })).not.toBeNull();
  });
});

describe("community reports", () => {
  it("only builds outbound search links (no network) and never links Google", () => {
    const links = communityLinks("Acme Ltd");
    expect(links.map((l) => l.id)).toEqual(["glassdoor", "blind", "reddit", "indeed", "geektime"]);
    for (const l of links) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.url).toContain("Acme");
      expect(l.url).not.toMatch(/google|linkedin/);
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(communityLinks("  ")).toEqual([]);
  });
  it("has Hebrew/English labels for community + new checked results", () => {
    for (const loc of ["he", "en"] as const) {
      const s = hiringStrings(loc);
      expect(s.community.title).toBeTruthy();
      expect(s.officialBadge).toBeTruthy();
      expect(s.checkedResult.bot_wall).toBeTruthy();
      expect(s.checkedResult.js_rendered).toBeTruthy();
    }
    expect(hiringStrings("he").community.title).toBe("מדיווחי קהילה");
  });
});

describe("LLM pacer", () => {
  it("serializes concurrent callers and stops at the budget", async () => {
    const p = new Pacer(2, 0);
    const got = await Promise.all([p.take(), p.take(), p.take()]);
    expect(got).toEqual([true, true, false]);
    expect(p.calls).toBe(2);
  });

  it("refuses calls that would start after its deadline", async () => {
    const p = new Pacer(5, 0);
    p.deadline = Date.now() - 1;
    expect(await p.take()).toBe(false);
    expect(p.calls).toBe(0);
  });
});

describe("i18n", () => {
  it("uses the exact empty-state text in Hebrew", () => {
    expect(hiringStrings("he").empty).toBe("לא נמצא מידע על תהליך הגיוס בחברה זו");
    expect(hiringStrings("he").title).toBe("תהליך הגיוס");
    expect(hiringStrings("en").title).toBe("Hiring process");
  });
});
