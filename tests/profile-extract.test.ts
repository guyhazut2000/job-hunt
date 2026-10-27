import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/providers/mock";
import type { LLMProvider } from "@/lib/ai/types";
import { extractProfile, heuristicExtract } from "@/lib/profile/extract";
import { categorizeSkill, regionOf, spanYears } from "@/lib/profile/schema";

const cv = readFileSync(new URL("./fixtures/cv-sample.txt", import.meta.url), "utf8");
const NOW = new Date("2026-10-01T00:00:00Z");

describe("heuristic CV extraction", () => {
  const p = heuristicExtract(cv, NOW);

  it("finds headline, summary and links", () => {
    expect(p.headline).toBe("Senior Full Stack Developer");
    expect(p.summary).toMatch(/^Full stack engineer/);
    expect(p.githubUrl).toBe("https://github.com/noalevi");
    expect(p.linkedinUrl).toBe("https://www.linkedin.com/in/noa-levi");
    expect(p.portfolioUrl).toBe("https://noalevi.dev");
  });

  it("parses experience with dates, company, title and tech", () => {
    expect(p.experience).toHaveLength(2);
    const [a, b] = p.experience;
    expect(a).toMatchObject({ title: "Senior Full Stack Developer", company: "Payflow", start: "2021-01" });
    expect(a.end ?? "").toBe("");
    expect(a.tech).toEqual(expect.arrayContaining(["Next.js", "TypeScript", "Node.js", "AWS", "PostgreSQL", "Redis"]));
    expect(b).toMatchObject({ title: "Full Stack Developer", company: "Shopit", start: "2018-03", end: "2020-12" });
    expect(b.description).toMatch(/React dashboards/);
  });

  it("derives skill years and levels from experience", () => {
    const s = Object.fromEntries(p.skillItems.map((x) => [x.name, x]));
    expect(s.React.years).toBeGreaterThanOrEqual(2.5); // only Shopit mentions React (2018-03..2020-12)
    expect(s.TypeScript.years).toBeGreaterThanOrEqual(5);
    expect(s.TypeScript.level).toBe("EXPERT");
    expect(s.Kafka).toMatchObject({ level: "GOOD", years: null }); // skills section only
    expect(s.React.category).toBe("frontend");
  });

  it("classifies education incl. certifications and IDF units", () => {
    const kinds = p.education.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["DEGREE", "CERTIFICATION", "MILITARY"]));
    expect(p.education.find((e) => e.kind === "MILITARY")?.institution).toMatch(/Mamram/);
    expect(p.education.find((e) => e.kind === "DEGREE")).toMatchObject({ start: "2014", end: "2017" });
  });

  it("reads languages with levels", () => {
    expect(p.languages).toEqual([
      { name: "Hebrew", level: "NATIVE" },
      { name: "English", level: "FLUENT" },
    ]);
  });

  it("suggests target role and seniority", () => {
    expect(p.targetRoles).toEqual(["fullstack"]);
    expect(p.targetSeniorities).toEqual(["SENIOR"]);
  });

  it("handles Hebrew headings", () => {
    const he = heuristicExtract(
      "דנה כהן\nמפתחת Backend\n\nניסיון תעסוקתי\nמפתחת Backend ב- Wix\n2019 - היום\n• פיתוח שירותי Java ו-Kafka\n\nהשכלה\nתואר ראשון במדעי המחשב, הטכניון 2015 - 2019\n\nשפות\nעברית - שפת אם, אנגלית - שוטפת",
      NOW,
    );
    expect(he.experience[0]).toMatchObject({ company: "Wix", start: "2019" });
    expect(he.skillItems.map((s) => s.name)).toEqual(expect.arrayContaining(["Java", "Kafka"]));
    expect(he.education[0].kind).toBe("DEGREE");
    expect(he.languages.map((l) => l.level)).toEqual(["NATIVE", "FLUENT"]);
  });

  it("never throws on junk", () => {
    expect(() => heuristicExtract("\u0000\n\n---\n", NOW)).not.toThrow();
  });
});

describe("extractProfile provider switch", () => {
  it("uses the heuristic for the mock provider", async () => {
    const p = await extractProfile(cv, new MockProvider());
    expect(p.source).toBe("heuristic");
  });
  it("accepts valid LLM JSON and falls back on invalid output", async () => {
    const good: LLMProvider = {
      name: "fake",
      complete: async () =>
        JSON.stringify({ headline: "Data Engineer", skillItems: [{ name: "Spark", level: "EXPERT", years: 4 }] }),
    };
    const p = await extractProfile(cv, good);
    expect(p.source).toBe("llm");
    expect(p.skillItems[0]).toMatchObject({ name: "Spark", category: "data" });
    const bad: LLMProvider = { name: "fake", complete: async () => "not json" };
    expect((await extractProfile(cv, bad)).source).toBe("heuristic");
  });
});

describe("profile helpers", () => {
  it("maps cities to regions", () => {
    expect(regionOf("Tel Aviv-Yafo, Israel")).toBe("tel_aviv");
    expect(regionOf("Herzliya")).toBe("sharon");
    expect(regionOf("Yokneam Illit")).toBe("haifa");
    expect(regionOf("Be'er Sheva")).toBe("south");
    expect(regionOf("Israel")).toBeUndefined();
  });
  it("computes spans and categories", () => {
    expect(spanYears("2020-01", "2020-12")).toBe(1);
    expect(categorizeSkill("kubernetes")).toBe("cloud");
  });
});

import { mergeProfessional } from "@/lib/profile/merge";
describe("mergeProfessional", () => {
  it("keeps user edits and fills gaps from extraction", () => {
    const x = heuristicExtract(cv, NOW);
    const current = {
      headline: "My own headline",
      summary: "",
      experience: [
        {
          company: "Payflow",
          title: "Senior Full Stack Developer",
          start: "2021-02",
          end: "",
          description: "mine",
          tech: [],
        },
      ],
      skillItems: [{ name: "react", level: "BASIC" as const, years: null, category: "frontend" as const }],
      education: [],
      languages: [],
      linkedinUrl: "",
      githubUrl: "https://github.com/me",
      portfolioUrl: "",
    };
    const m = mergeProfessional(current, x);
    expect(m.headline).toBe("My own headline");
    expect(m.summary).toBe(x.summary);
    expect(m.experience).toHaveLength(2);
    expect(m.experience[0].description).toBe("mine");
    const react = m.skillItems.find((s) => s.name === "react")!;
    expect(react.level).toBe("BASIC");
    expect(react.years).toBeGreaterThan(0);
    expect(m.skillItems.filter((s) => s.name.toLowerCase() === "react")).toHaveLength(1);
    expect(m.githubUrl).toBe("https://github.com/me");
  });
});
