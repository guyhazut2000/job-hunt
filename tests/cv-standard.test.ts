import { describe, expect, it } from "vitest";
import { demoContent, type CvContent } from "@/lib/cv-templates/content";
import { density, tightenTemplate, MAX_DENSITY, MIN_BODY_PT } from "@/lib/cv-standard/density";
import { cutSuggestions, fitToOnePage } from "@/lib/cv-standard/fit";
import {
  bulletFeedback,
  dateValue,
  evaluateStandard,
  looksLikeStreetAddress,
  personalDetail,
  type RuleId,
} from "@/lib/cv-standard/rules";
import { hasFirstPersonPronoun, hasMetric, startsWithActionVerb } from "@/lib/cv-standard/verbs";
import { TEMPLATES, TEMPLATE_IDS } from "@/lib/cv-templates/templates";

const NOW = new Date("2026-11-03T12:00:00Z");
const clone = (c: CvContent): CvContent => JSON.parse(JSON.stringify(c));
const run = (c: CvContent, extra: Partial<Parameters<typeof evaluateStandard>[0]> = {}) =>
  evaluateStandard({
    content: c,
    template: "hitech",
    now: NOW,
    fit: { pages: 1, level: 0, fits: true },
    yearsExperience: 5,
    ...extra,
  });
const status = (c: CvContent, id: RuleId, extra = {}) => run(c, extra).results.find((r) => r.id === id)!.status;

describe("action verbs", () => {
  it.each([
    "Led a team of 5 engineers",
    "Reduced latency by 40%",
    "Built the billing service",
    "Spearheaded migration to Kubernetes",
    "Architected an event pipeline",
    "הובלתי צוות של 4 מפתחים",
    "פיתחתי מערכת תשלומים",
    "ושיפרתי את זמני הטעינה",
    "הובלת מעבר ל-Kubernetes",
    "פיתוח שירות GraphQL",
  ])("accepts %s", (b) => expect(startsWithActionVerb(b)).toBe(true));
  it.each([
    "Responsible for the backend",
    "The team shipped",
    "I was part of the team",
    "אחראי על הצד השרת",
    "עבודה בצוות",
  ])("rejects %s", (b) => expect(startsWithActionVerb(b)).toBe(false));
  it("pronouns & metrics", () => {
    expect(hasFirstPersonPronoun("I built my own tool")).toBe(true);
    expect(hasFirstPersonPronoun("Built an internal tool")).toBe(false);
    expect(hasMetric("Cut cost by 30%")).toBe(true);
    expect(hasMetric("Saved ₪ for the team")).toBe(true);
    expect(hasMetric("Improved performance")).toBe(false);
  });
});

describe("rules engine", () => {
  for (const lang of ["he", "en"] as const)
    it(`demo CV (${lang}) passes every blocking rule`, () => {
      const r = run(demoContent(lang));
      expect(r.blocking.map((x) => x.id)).toEqual([]);
      expect(r.passed).toBe(true);
      expect(r.score).toBeGreaterThan(70);
    });

  it("one-page rule is pending without a fit and blocks when 2 pages", () => {
    const c = demoContent("en");
    const pending = evaluateStandard({ content: c, template: "hitech", now: NOW });
    expect(pending.passed).toBe(false);
    expect(pending.contentPassed).toBe(true);
    expect(pending.pending.map((x) => x.id)).toEqual(["onePage"]);
    const two = run(c, { fit: { pages: 2, level: 3, fits: false } });
    expect(two.blocking.map((x) => x.id)).toEqual(["onePage"]);
    expect(two.contentPassed).toBe(true);
  });

  it("contact: name, email, phone, link are blocking; linkedin is a warning", () => {
    const c = clone(demoContent("en"));
    c.contact = c.contact.filter((x) => x.kind === "location");
    c.links = c.links.filter((l) => l.kind !== "linkedin");
    const r = run(c);
    expect(r.blocking.map((x) => x.id)).toEqual(expect.arrayContaining(["email", "phone"]));
    expect(r.warnings.map((x) => x.id)).toContain("linkedin");
    c.links = [];
    expect(status(c, "link")).toBe("fail");
  });

  it("summary length", () => {
    const c = clone(demoContent("en"));
    c.summary = "";
    expect(status(c, "summaryPresent")).toBe("fail");
    c.summary = Array(95).fill("word").join(" ");
    expect(status(c, "summaryMax")).toBe("fail");
    c.summary = Array(70).fill("word").join(" ");
    expect(status(c, "summaryMax")).toBe("pass");
    expect(status(c, "summaryRange")).toBe("fail");
  });

  it("bullets per role, length, verbs, metrics", () => {
    const c = clone(demoContent("en"));
    c.experience[0].bullets = [];
    expect(status(c, "bulletsPresent")).toBe("fail");
    c.experience[0].bullets = Array(9).fill("Built a service used by 3 teams");
    expect(status(c, "bulletsMax")).toBe("fail");
    c.experience[0].bullets = ["Built " + "x".repeat(310)];
    const r = run(c);
    expect(r.blocking.find((x) => x.id === "bulletTooLong")!.refs).toEqual([
      { section: "experience", index: 0, bullet: 0 },
    ]);

    const d = clone(demoContent("en"));
    for (const e of [...d.experience, ...d.projects])
      e.bullets = e.bullets.map(() => "Responsible for the backend services");
    const rd = run(d);
    expect(rd.blocking.map((x) => x.id)).toEqual(expect.arrayContaining(["verbsHalf", "metricAny"]));
  });

  it("banned personal fields (Hebrew and English)", () => {
    expect(personalDetail("מצב משפחתי: נשוי + 2")).toBeTruthy();
    expect(personalDetail("ת.ז. 123456789")).toBeTruthy();
    expect(personalDetail("Date of birth: 1990")).toBeTruthy();
    expect(personalDetail("References available upon request")).toBeTruthy();
    expect(personalDetail("פיתחתי מנוע ממליצים מבוסס ML")).toBeNull();
    expect(personalDetail("Built a recommendation engine")).toBeNull();
    const c = clone(demoContent("he"));
    c.summary += " מצב משפחתי: רווק.";
    expect(status(c, "noPersonal")).toBe("fail");
  });

  it("street address is blocking, city is fine", () => {
    expect(looksLikeStreetAddress("רחוב הרצל 12, תל אביב")).toBe(true);
    expect(looksLikeStreetAddress("12 Main St, Haifa")).toBe(true);
    expect(looksLikeStreetAddress("תל אביב")).toBe(false);
    expect(looksLikeStreetAddress("Tel Aviv, Israel")).toBe(false);
  });

  it("skills: min is blocking, grouping is a warning", () => {
    const c = clone(demoContent("en"));
    c.skills = ["React", "Node"];
    expect(status(c, "skillsMin")).toBe("fail");
    c.skills = Array.from({ length: 10 }, (_, i) => `S${i}`);
    expect(status(c, "skillsGrouped", { skillCategories: Array(10).fill("other") })).toBe("fail");
    expect(status(c, "skillsGrouped", { skillCategories: Array(10).fill("frontend") })).toBe("pass");
  });

  it("dates: valid, ordered, consistent", () => {
    expect(dateValue("2024-03")).toBe(2024 * 12 + 2);
    expect(dateValue("2024")).toBe(2024 * 12);
    expect(dateValue("March 2024")).toBeNull();
    const c = clone(demoContent("en"));
    c.experience[0].start = "2024-05";
    c.experience[0].end = "2023-01";
    expect(status(c, "datesValid")).toBe("fail");
    c.experience[0].end = "";
    c.experience[0].start = "2029";
    expect(status(c, "datesValid")).toBe("fail");
    const o = clone(demoContent("en"));
    if (o.experience.length > 1) {
      o.experience.reverse();
      expect(status(o, "datesOrder")).toBe("fail");
    }
  });

  it("junior without projects gets a warning; creative 2 columns a warning", () => {
    const c = clone(demoContent("en"));
    c.projects = [];
    expect(status(c, "juniorProjects", { yearsExperience: 1 })).toBe("fail");
    expect(status(c, "twoColumns", { template: "creative" })).toBe("fail");
  });

  it("bullet feedback", () => {
    expect(bulletFeedback("Reduced p95 latency by 40% by caching hot queries")).toEqual({
      verb: true,
      metric: true,
      length: "ok",
      pronoun: false,
    });
    expect(bulletFeedback("I did stuff").length).toBe("short");
    expect(bulletFeedback("I did stuff").pronoun).toBe(true);
  });
});

describe("density (auto-tighten)", () => {
  it("never shrinks body text below the minimum", () => {
    for (const id of TEMPLATE_IDS) {
      const base = TEMPLATES[id];
      const t = tightenTemplate(base, MAX_DENSITY);
      expect(t.size).toBeGreaterThanOrEqual(Math.min(base.size, MIN_BODY_PT));
      expect(tightenTemplate(base, 0)).toEqual(base);
    }
    expect(density(99).level).toBe(MAX_DENSITY);
    expect(density(-1).level).toBe(0);
  });
});

describe("fit + cut suggestions", () => {
  it("stops at the first level that fits", async () => {
    const pagesAt = [3, 2, 1, 1];
    const calls: number[] = [];
    const fake = async (level: number) => {
      calls.push(level);
      return new Uint8Array([level]);
    };
    // measure is real; swap with a fake doc by mocking unpdf
    const { vi } = await import("vitest");
    vi.doMock("unpdf", () => ({
      getDocumentProxy: async (b: Uint8Array) => ({
        numPages: pagesAt[b[0]],
        getPage: async () => ({
          getViewport: () => ({ height: 800 }),
          getTextContent: async () => ({ items: [{ str: "x", transform: [0, 0, 0, 0, 0, 200] }] }),
        }),
      }),
    }));
    const r = await fitToOnePage(fake);
    vi.doUnmock("unpdf");
    expect(calls).toEqual([0, 1, 2]);
    expect(r).toMatchObject({ pages: 1, level: 2, fits: true, used: 0.75 });
  });

  it("suggests concrete cuts", () => {
    const c = clone(demoContent("en"));
    c.experience = [0, 1, 2].map((i) => ({
      ...c.experience[0],
      title: `Role ${i}`,
      bullets: Array(6).fill("Built " + "y".repeat(170)),
    }));
    c.summary = Array(55).fill("w").join(" ");
    c.skills = Array.from({ length: 25 }, (_, i) => `S${i}`);
    c.volunteering = [{ title: "Mentor", org: "X", start: "", end: "", bullets: [] }];
    const kinds = cutSuggestions(c, ["summary", "experience", "volunteering"]).map((s) => s.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "hideSection",
        "trimOldRole",
        "trimRole",
        "shortenBullets",
        "shortenSummary",
        "fewerSkills",
      ]),
    );
    expect(cutSuggestions(demoContent("en"), ["summary", "experience"]).length).toBe(0);
  });
});
