import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBaseCv, toBullets } from "@/lib/cv-tailor/base";
import { changed, wordDiff } from "@/lib/cv-tailor/diff";
import { cvYears, detectLanguage, matchSummary, requiredYears } from "@/lib/cv-tailor/match";
import { cvDocSchema } from "@/lib/cv-tailor/schema";
import { enforceFacts, heuristicSuggestions, heuristicTailor, introducesFacts } from "@/lib/cv-tailor/tailor";
import type { CvDoc, TailorTarget } from "@/lib/cv-tailor/types";
import { professionalSchema } from "@/lib/profile/schema";

const llm = vi.hoisted(() => ({
  provider: null as null | { name: string; complete: (...a: unknown[]) => Promise<string> },
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ai", () => ({ guardedLLM: async () => llm.provider }));

const NOW = new Date("2026-10-30T12:00:00Z");

function base(): CvDoc {
  return {
    name: "Dana Levi",
    contact: ["dana@example.com"],
    headline: "Full-stack developer",
    summary: "Full-stack developer building web products.",
    experience: [
      {
        id: "0",
        company: "Acme",
        title: "Software Engineer",
        start: "2021-03",
        end: "",
        bullets: [
          "Maintained internal admin tools",
          "Built the checkout in React and TypeScript",
          "Cut API latency by 40% with Redis caching",
        ],
      },
      {
        id: "1",
        company: "Beta",
        title: "Junior Developer",
        start: "2019-01",
        end: "2021-02",
        bullets: ["Wrote Python scripts for reporting"],
      },
    ],
    skills: ["Python", "Redis", "React", "TypeScript"],
    education: [
      { institution: "Tel Aviv University", title: "B.Sc Computer Science", start: "2015-10", end: "2018-07" },
    ],
    languages: ["Hebrew (native)", "English (fluent)"],
  };
}

const target: TailorTarget = {
  title: "Frontend Engineer",
  company: "Wix",
  description:
    "We are looking for a Frontend Engineer with 5+ years of experience in React and TypeScript. Experience with GraphQL is a plus. B.Sc in Computer Science. Excellent English.",
  techStack: ["React", "TypeScript", "GraphQL"],
};

describe("detectLanguage / requiredYears", () => {
  it("picks Hebrew for Hebrew postings and English otherwise", () => {
    expect(detectLanguage("דרוש/ה מפתח/ת Frontend עם ניסיון ב-React ו-TypeScript, עבודה בצוות דינמי")).toBe("he");
    expect(detectLanguage("We are hiring a backend engineer (Node.js, Postgres)")).toBe("en");
    expect(detectLanguage("")).toBe("he");
  });
  it("reads the minimal years asked for", () => {
    expect(requiredYears("5+ years of experience")).toBe(5);
    expect(requiredYears("3-5 years with React, 2 years with Go")).toBe(2);
    expect(requiredYears("ניסיון של 4 שנים לפחות")).toBe(4);
    expect(requiredYears("no years here")).toBeNull();
  });
  it("counts CV years from the earliest start to now for an open role", () => {
    expect(Math.floor(cvYears(base(), NOW))).toBe(7);
  });
});

describe("matchSummary", () => {
  it("splits covered vs missing requirements with evidence", () => {
    const m = matchSummary(base(), target, { hasDegree: true, now: NOW });
    const covered = m.covered.map((r) => r.label);
    expect(covered).toEqual(expect.arrayContaining(["React", "TypeScript", "5+", "degree", "English"]));
    expect(m.missing.map((r) => r.label)).toEqual(["GraphQL"]);
    expect(m.covered.find((r) => r.label === "React")?.evidence).toBe("skills");
    expect(m.score).toBe(Math.round((covered.length / (covered.length + 1)) * 100));
  });
  it("marks degree missing when the profile has none", () => {
    const m = matchSummary(base(), target, { hasDegree: false, now: NOW });
    expect(m.missing.some((r) => r.kind === "degree")).toBe(true);
  });
});

describe("heuristicTailor", () => {
  it("moves relevant skills and bullets up without changing any text", () => {
    const b = base();
    const t = heuristicTailor(b, target);
    expect(t.skills.slice(0, 2).sort()).toEqual(["React", "TypeScript"]);
    expect([...t.skills].sort()).toEqual([...b.skills].sort());
    expect(t.experience[0].bullets[0]).toBe("Built the checkout in React and TypeScript");
    expect([...t.experience[0].bullets].sort()).toEqual([...b.experience[0].bullets].sort());
    expect(t.experience[0].origin).toEqual([1, 0, 2]);
    expect(t.experience.map((r) => [r.company, r.title, r.start, r.end])).toEqual(
      b.experience.map((r) => [r.company, r.title, r.start, r.end]),
    );
  });
  it("lists gaps as suggestions, not CV content", () => {
    const m = matchSummary(base(), target, { hasDegree: true, now: NOW });
    expect(heuristicSuggestions(base(), m)).toEqual([{ kind: "tech", label: "GraphQL" }]);
  });
});

describe("enforceFacts (never invent)", () => {
  const corpus = JSON.stringify(base());
  it("reverts rephrasings that add a technology or a number", () => {
    const b = base();
    const { doc, reverted } = enforceFacts(
      b,
      heuristicTailor(b, target),
      {
        headline: "Senior Frontend Engineer with GraphQL expertise",
        summary: "Frontend-focused full-stack developer building web products in React.",
        roles: [
          {
            id: "0",
            bullets: [
              { from: 1, text: "Built the React and TypeScript checkout" },
              { from: 2, text: "Cut API latency by 75% with Redis caching" },
              { from: 2, text: "duplicate is ignored" },
              { from: 9, text: "out of range is ignored" },
            ],
          },
        ],
        skillsOrder: ["TypeScript", "GraphQL", "React"],
        suggestions: [],
      },
      corpus,
    );
    expect(doc.headline).toBe(b.headline); // GraphQL is not in the CV
    expect(doc.summary).toContain("Frontend-focused");
    expect(doc.experience[0].bullets).toEqual([
      "Built the React and TypeScript checkout",
      "Cut API latency by 40% with Redis caching", // 75% reverted
      "Maintained internal admin tools", // untouched bullet kept
    ]);
    expect(doc.experience[0].origin).toEqual([1, 2, 0]);
    expect(reverted).toBe(2);
    expect(doc.skills.slice(0, 2)).toEqual(["TypeScript", "React"]);
    expect(doc.skills).not.toContain("GraphQL");
    expect([...doc.skills].sort()).toEqual([...b.skills].sort());
  });
  it("keeps companies, titles, dates and education from the base CV", () => {
    const b = base();
    const { doc } = enforceFacts(
      b,
      heuristicTailor(b, target),
      {
        headline: "",
        summary: "",
        roles: [{ id: "1", bullets: [{ from: 0, text: "Wrote Python scripts for reporting" }] }],
        skillsOrder: [],
        suggestions: [],
      },
      corpus,
    );
    expect(doc.experience.map((r) => [r.company, r.title, r.start, r.end])).toEqual(
      b.experience.map((r) => [r.company, r.title, r.start, r.end]),
    );
    expect(doc.education).toEqual(b.education);
    expect(doc.headline).toBe(b.headline);
  });
  it("never fills a section the base CV leaves empty", () => {
    const b = { ...base(), summary: "" };
    const { doc } = enforceFacts(
      b,
      b,
      { headline: "", summary: "Invented summary", roles: [], skillsOrder: [], suggestions: [] },
      corpus,
    );
    expect(doc.summary).toBe("");
  });
  it("introducesFacts flags unknown tech and numbers", () => {
    expect(introducesFacts("Led a team of 12", new Set(), new Set(["5"]))).toBe(true);
    expect(introducesFacts("Built services in Kubernetes", new Set(["React"]), new Set())).toBe(true);
    expect(introducesFacts("Built the React checkout", new Set(["React"]), new Set())).toBe(false);
  });
});

describe("tailorCv", () => {
  beforeEach(() => {
    llm.provider = null;
  });
  const facts = { resumeText: null, hasDegree: true };
  it("works offline with the mock provider (labelled offline)", async () => {
    llm.provider = { name: "mock", complete: vi.fn() };
    const { tailorCv } = await import("@/lib/cv-tailor/server");
    const r = await tailorCv("u1", base(), target, "en", facts);
    expect(r.source).toBe("offline");
    expect(r.doc.experience[0].bullets[0]).toContain("React");
    expect(llm.provider.complete).not.toHaveBeenCalled();
  });
  it("falls back to 'limited' when the daily AI limit is hit", async () => {
    const { AiLimitError } = await import("@/lib/ai/errors");
    llm.provider = { name: "guarded", complete: async () => Promise.reject(new AiLimitError("user_daily")) };
    const { tailorCv } = await import("@/lib/cv-tailor/server");
    const r = await tailorCv("u1", base(), target, "en", facts);
    expect(r).toMatchObject({ source: "limited", reason: "user_daily" });
  });
  it("uses a valid AI answer and enforces the rules on it", async () => {
    llm.provider = {
      name: "guarded",
      complete: async () =>
        JSON.stringify({
          headline: "Frontend-leaning full-stack developer",
          summary: "",
          roles: [{ id: "0", bullets: [{ from: 1, text: "Built the checkout with React + TypeScript" }] }],
          skillsOrder: ["React", "TypeScript"],
          suggestions: ["Mention any GraphQL you used in side projects, if true."],
        }),
    };
    const { tailorCv } = await import("@/lib/cv-tailor/server");
    const r = await tailorCv("u1", base(), target, "en", facts);
    expect(r.source).toBe("ai");
    expect(r.doc.headline).toBe("Frontend-leaning full-stack developer");
    expect(r.doc.summary).toBe(base().summary); // empty answer keeps the original
    expect(r.suggestions.some((s) => s.kind === "ai")).toBe(true);
    expect(r.suggestions.some((s) => s.kind === "tech" && s.label === "GraphQL")).toBe(true);
  });
  it("treats malformed AI output as offline", async () => {
    llm.provider = { name: "guarded", complete: async () => "{not json" };
    const { tailorCv } = await import("@/lib/cv-tailor/server");
    expect((await tailorCv("u1", base(), target, "en", facts)).source).toBe("offline");
  });
});

describe("buildBaseCv", () => {
  it("builds from the profile and completes skills/phone from the resume", () => {
    const professional = professionalSchema.parse({
      headline: "Backend developer",
      experience: [
        {
          company: "Acme",
          title: "Engineer",
          start: "2020-01",
          end: "",
          description: "- Built APIs\n- Ran on-call",
          tech: ["Go"],
        },
      ],
      languages: [{ name: "English", level: "FLUENT" }],
    });
    const cv = buildBaseCv({
      name: "Dana",
      email: "dana@example.com",
      professional,
      profileSkills: ["Go"],
      resumeText: "Dana · 054-123-4567 · Worked with PostgreSQL",
      resumeSkills: [],
      locale: "en",
    });
    expect(cv.contact).toEqual(["dana@example.com", "054-123-4567"]);
    expect(cv.experience[0]).toMatchObject({ id: "0", company: "Acme", bullets: ["Built APIs", "Ran on-call"] });
    expect(cv.skills).toEqual(expect.arrayContaining(["Go", "PostgreSQL"]));
    expect(cv.skills.filter((s) => s === "Go")).toHaveLength(1);
  });
  it("toBullets splits long single paragraphs into sentences", () => {
    const long = "Built the payments service end to end for the team. ".repeat(4).trim();
    expect(toBullets(long).length).toBe(4);
  });
});

describe("wordDiff / schema", () => {
  it("diffs words", () => {
    const parts = wordDiff("Built the checkout in React", "Built the new checkout in React");
    expect(parts.filter((p) => p.type === "add").map((p) => p.text.trim())).toEqual(["new"]);
    expect(parts.some((p) => p.type === "del")).toBe(false);
    expect(
      parts
        .filter((p) => p.type === "same")
        .map((p) => p.text)
        .join(""),
    ).toContain("Built the");
    expect(changed("a b", "a b")).toBe(false);
    expect(changed("a b", "a c")).toBe(true);
  });
  it("validates edited CVs", () => {
    expect(cvDocSchema.safeParse(base()).success).toBe(true);
    expect(cvDocSchema.safeParse({ ...base(), skills: "React" }).success).toBe(false);
  });
});
