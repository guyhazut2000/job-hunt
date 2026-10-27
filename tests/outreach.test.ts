import { describe, expect, it } from "vitest";
import type { ContactCategory } from "@prisma/client";
import type { LLMProvider } from "@/lib/ai/types";
import {
  CONTACT_CATEGORIES,
  cleanCompanyName,
  googleFallbackUrl,
  isLinkedinProfileUrl,
  linkedinKeywords,
  linkedinPeopleSearchUrl,
  peopleLinks,
} from "@/lib/outreach/links";
import {
  NAME_TOKEN,
  SHORT_LIMIT,
  budgetLength,
  generateOutreach,
  personalize,
  templateMessage,
  type OutreachContext,
} from "@/lib/outreach/messages";

const ctx: OutreachContext = {
  company: "Wix.com Ltd.",
  job: { title: "Senior Backend Engineer", url: "https://job-hunt.example/jobs/abc" },
  candidate: {
    name: "Guy Hazut",
    headline: "Backend Engineer",
    years: 6,
    skills: ["Node.js", "Go", "PostgreSQL", "Kafka"],
  },
};
const LANGS = ["he", "en"] as const;

describe("people-search links", () => {
  it("cleans legal suffixes from company names", () => {
    expect(cleanCompanyName("Wix.com Ltd.")).toBe("Wix.com");
    expect(cleanCompanyName("Check Point Software Technologies Ltd")).toBe("Check Point Software");
    expect(cleanCompanyName('מובילאיי בע"מ')).toBe("מובילאיי");
    expect(cleanCompanyName("Acme (Israel R&D)")).toBe("Acme");
  });

  it("builds a LinkedIn people search with English + Hebrew titles and the role domain", () => {
    const kw = linkedinKeywords("Wix.com Ltd.", "TEAM_LEAD", "backend");
    expect(kw).toContain('"Wix.com"');
    expect(kw).toContain('"Team Lead" OR');
    expect(kw).toContain('"ראש צוות"');
    expect(kw).toContain('("Backend" OR "בקאנד")');
    const url = new URL(linkedinPeopleSearchUrl("Wix.com Ltd.", "TEAM_LEAD", "backend"));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/search/results/people/");
    expect(url.searchParams.get("keywords")).toBe(kw);
  });

  it("only scopes team leads and peers by domain", () => {
    expect(linkedinKeywords("Wix", "RECRUITER", "backend")).not.toContain("Backend");
    expect(linkedinKeywords("Wix", "PEER", "backend")).toContain("Backend");
    expect(linkedinKeywords("Wix", "PEER", "other")).not.toContain('("Backend"');
  });

  it("builds a Google site:linkedin.com/in fallback", () => {
    const q = new URL(googleFallbackUrl("Wix", "FOUNDER")).searchParams.get("q")!;
    expect(q.startsWith('site:linkedin.com/in "Wix" (')).toBe(true);
    expect(q).toContain('"CEO"');
    expect(q).toContain('"מנכ״ל"');
  });

  it("returns one link pair per category, never a scraping endpoint", () => {
    const links = peopleLinks("Wix", "backend");
    expect(links.map((l) => l.category)).toEqual(CONTACT_CATEGORIES);
    for (const l of links) {
      expect(l.linkedin).toMatch(/^https:\/\/www\.linkedin\.com\/search\/results\/people\/\?keywords=/);
      expect(l.google).toMatch(/^https:\/\/www\.google\.com\/search\?q=site%3Alinkedin\.com%2Fin/);
      expect(l.linkedin).not.toMatch(/voyager|api/i);
    }
  });

  it("accepts only https LinkedIn profile URLs", () => {
    expect(isLinkedinProfileUrl("https://www.linkedin.com/in/someone")).toBe(true);
    expect(isLinkedinProfileUrl("https://il.linkedin.com/in/someone")).toBe(true);
    expect(isLinkedinProfileUrl("http://www.linkedin.com/in/someone")).toBe(false);
    expect(isLinkedinProfileUrl("https://evil.com/linkedin.com/in/x")).toBe(false);
    expect(isLinkedinProfileUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("outreach templates", () => {
  it.each(CONTACT_CATEGORIES.flatMap((c) => LANGS.map((l) => [c, l] as const)))(
    "%s/%s: short ≤ 300 with a name, greeting placeholder, job + profile facts",
    (category, lang) => {
      const m = templateMessage(category, ctx, lang);
      expect(budgetLength(m.short)).toBeLessThanOrEqual(SHORT_LIMIT);
      expect(personalize(m.short, "Bartholomew Montgomery").length).toBeLessThanOrEqual(SHORT_LIMIT);
      expect(m.short.startsWith(lang === "he" ? `היי ${NAME_TOKEN},` : `Hi ${NAME_TOKEN},`)).toBe(true);
      expect(m.short).toContain("Senior Backend Engineer");
      expect(m.long).toContain("https://job-hunt.example/jobs/abc");
      expect(m.long).toContain("Node.js");
      expect(m.long).toContain("Guy Hazut");
      expect(m.long.length).toBeGreaterThan(m.short.length);
      expect(m.subject.length).toBeGreaterThan(3);
    },
  );

  it("tailors the ask to the audience", () => {
    expect(templateMessage("PEER", ctx, "en").short).toMatch(/referral/);
    expect(templateMessage("RECRUITER", ctx, "en").short).toMatch(/apply/);
    expect(templateMessage("PEER", ctx, "he").short).toContain("הפניה");
    expect(templateMessage("SENIOR_MGMT", ctx, "en").long).toMatch(/point me/);
  });

  it("writes correct Hebrew years and prefixes", () => {
    expect(templateMessage("RECRUITER", ctx, "he").long).toContain("6 שנות ניסיון");
    expect(templateMessage("RECRUITER", { ...ctx, candidate: { ...ctx.candidate, years: 2 } }, "he").long).toContain(
      "שנתיים ניסיון",
    );
    expect(templateMessage("RECRUITER", ctx, "he").short).toContain("ב-Wix.com Ltd.");
  });

  it("drops detail to fit very long titles and skill lists", () => {
    const long: OutreachContext = {
      ...ctx,
      job: {
        title: "Senior Principal Staff Distributed-Systems Backend Infrastructure Platform Engineer — Payments",
        url: ctx.job!.url,
      },
      candidate: {
        ...ctx.candidate,
        headline: "Senior Backend & Platform Engineer, distributed systems and payments infrastructure",
      },
    };
    for (const c of CONTACT_CATEGORIES)
      for (const l of LANGS) expect(budgetLength(templateMessage(c, long, l).short)).toBeLessThanOrEqual(SHORT_LIMIT);
  });

  it("works without a job (company page) and without a profile", () => {
    const m = templateMessage("FOUNDER", { company: "Wix", job: null, candidate: { skills: [] } }, "en");
    expect(m.short).toBe(
      `Hi ${NAME_TOKEN}, I'm genuinely excited by what you're building at Wix. Would love to connect and hear where the company is heading.`,
    );
    expect(m.long).not.toContain("A bit about me");
    expect(templateMessage("RECRUITER", { company: "Wix", candidate: { skills: [] } }, "he").short).toContain(
      "ראיתי ש-Wix מגייסת",
    );
  });

  it("personalizes or drops the name cleanly", () => {
    expect(personalize(`Hi ${NAME_TOKEN}, hello`, "Dana")).toBe("Hi Dana, hello");
    expect(personalize(`Hi ${NAME_TOKEN}, hello`, "  ")).toBe("Hi, hello");
    expect(personalize(`היי ${NAME_TOKEN},`, null)).toBe("היי,");
  });
});

describe("generateOutreach", () => {
  const fake = (out: string | Error): LLMProvider => ({
    name: "fake",
    complete: async () => {
      if (out instanceof Error) throw out;
      return out;
    },
  });
  const cat: ContactCategory = "PEER";

  it("uses templates on the mock provider", async () => {
    const m = await generateOutreach({ name: "mock", complete: async () => "{}" }, cat, ctx, "he");
    expect(m).toEqual(templateMessage(cat, ctx, "he"));
  });

  it("accepts a valid AI draft", async () => {
    const draft = {
      short: `Hi ${NAME_TOKEN}, quick one about the backend role — would love your take.`,
      long: `Hi ${NAME_TOKEN},\n\n${"Long message body. ".repeat(6)}`,
      subject: "Backend role",
    };
    const m = await generateOutreach(fake(JSON.stringify(draft)), cat, ctx, "en");
    expect(m.source).toBe("ai");
    expect(m.short).toBe(draft.short);
  });

  it("falls back when the model breaks constraints or errors", async () => {
    const tooLong = {
      short: `Hi ${NAME_TOKEN}, ${"x".repeat(400)}`,
      long: `Hi ${NAME_TOKEN} ${"y".repeat(100)}`,
      subject: "s s s",
    };
    expect((await generateOutreach(fake(JSON.stringify(tooLong)), cat, ctx, "en")).source).toBe("template");
    const noName = { short: "Hi there, a short note that is fine.", long: `Hi ${"y".repeat(100)}`, subject: "subj" };
    expect((await generateOutreach(fake(JSON.stringify(noName)), cat, ctx, "en")).source).toBe("template");
    expect((await generateOutreach(fake("not json"), cat, ctx, "en")).source).toBe("template");
    expect((await generateOutreach(fake(new Error("429")), cat, ctx, "en")).source).toBe("template");
  });
});
