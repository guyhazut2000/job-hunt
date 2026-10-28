import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LLMProvider } from "@/lib/ai/types";
import { discoverProcessPages, siteKey } from "@/lib/hiring/discover";
import {
  extractHiringProcess,
  groundStages,
  hasProcessSignals,
  heuristicExtract,
  normalizeForMatch,
  processPassages,
  type SourcePage,
} from "@/lib/hiring/extract";
import { fetchPublicPage, htmlToText, isBlockedUrl, pageLinks, pageTitle } from "@/lib/hiring/fetch";
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
  const stage = (kind: string, evidence: string) => ({
    kind,
    title: evidence.slice(0, 30),
    detailHe: "תיאור",
    detailEn: "Detail",
    duration: null,
    evidence,
    sourceUrl: PAGE.url,
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

  it("returns none when fewer than two stages survive grounding", async () => {
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
    expect((await extractHiringProcess("Acme", [PAGE], llm)).status).toBe("none");
  });

  it("marks LLM failures as llm_failed and never falls back to guesses", async () => {
    const llm: LLMProvider = {
      name: "gemini",
      complete: vi.fn(async () => {
        throw new Error("quota");
      }),
    };
    const res = await extractHiringProcess("Acme", [PAGE], llm);
    expect(res).toMatchObject({ status: "none", method: "llm_failed", stages: [] });
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

describe("i18n", () => {
  it("uses the exact empty-state text in Hebrew", () => {
    expect(hiringStrings("he").empty).toBe("לא נמצא מידע על תהליך הגיוס בחברה זו");
    expect(hiringStrings("he").title).toBe("תהליך הגיוס");
    expect(hiringStrings("en").title).toBe("Hiring process");
  });
});
