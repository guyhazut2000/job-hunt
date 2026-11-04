import { describe, expect, it } from "vitest";
import {
  abbreviatedTitle,
  atsScore,
  evaluateAts,
  findBuzzwords,
  isStandardHeading,
  jobKeywords,
  matchKeywords,
  type AtsInput,
} from "@/lib/ats/check";
import { demoContent } from "@/lib/cv-templates/content";
import { fitCvPdf } from "@/lib/cv-standard/fit";
import { defaultLayout } from "@/lib/cv-templates/sections";
import { TEMPLATES } from "@/lib/cv-templates/templates";
import { extractText } from "@/lib/cv/parse";

const base = (over: Partial<AtsInput> = {}): AtsInput => {
  const content = demoContent("en");
  return {
    content,
    columns: 1,
    headings: ["Summary", "Experience", "Skills"],
    customHeadings: [],
    extracted: null,
    pdfBytes: 30_000,
    job: null,
    senior: false,
    ...over,
  };
};
const ruleOf = (r: ReturnType<typeof evaluateAts>, id: string) => r.rules.find((x) => x.id === id)!;

describe("ats rules", () => {
  it("marks parse rules pending when the PDF could not be read", () => {
    const r = evaluateAts(base());
    expect(ruleOf(r, "textLayer").status).toBe("pending");
    expect(ruleOf(r, "headingsInText").status).toBe("pending");
    expect(ruleOf(r, "keywordCoverage").status).toBe("na");
  });

  it("fails two-column layouts and oversized files", () => {
    const r = evaluateAts(base({ columns: 2, pdfBytes: 3 * 1024 * 1024 }));
    expect(ruleOf(r, "singleColumn").status).toBe("fail");
    expect(ruleOf(r, "fileSize").status).toBe("fail");
  });

  it("flags abbreviated titles and non-standard headings", () => {
    expect(abbreviatedTitle("Sr. SW Eng.")).toBe(true);
    expect(abbreviatedTitle("Senior Software Engineer")).toBe(false);
    expect(isStandardHeading("ניסיון תעסוקתי")).toBe(true);
    expect(isStandardHeading("My Journey")).toBe(false);
    const c = demoContent("en");
    c.experience[0].title = "Sr. Dev";
    const r = evaluateAts(base({ content: c, customHeadings: ["My Journey"] }));
    expect(ruleOf(r, "fullTitles").status).toBe("warn");
    expect(ruleOf(r, "standardHeadings").items).toEqual(["My Journey"]);
  });

  it("detects buzzwords in English and Hebrew without calling it AI detection", () => {
    const b = findBuzzwords("Results-driven team player who leverages seamless synergy. בעל מוטיבציה גבוהה ושחקן צוות");
    const words = b.map((x) => x.word);
    expect(words).toEqual(
      expect.arrayContaining(["results-driven", "team player", "seamless", "synergy", "מוטיבציה גבוהה", "שחקן צוות"]),
    );
    expect(b.find((x) => x.word === "seamless")?.kind).toBe("llm");
    expect(findBuzzwords("Built a billing dashboard used by 1,200 customers.")).toEqual([]);
  });

  it("matches job keywords through synonyms and reports coverage", () => {
    const kws = jobKeywords({
      title: "Frontend Engineer",
      tech: ["React"],
      text: "We use TypeScript, GraphQL and Kubernetes.",
    });
    expect(kws).toEqual(expect.arrayContaining(["React", "TypeScript", "GraphQL", "Kubernetes"]));
    const m = matchKeywords(kws, "ניסיון עם ריאקט ו-TypeScript");
    expect(m.find((k) => k.keyword === "React")?.found).toBe(true);
    expect(m.find((k) => k.keyword === "GraphQL")?.found).toBe(false);
    const r = evaluateAts(
      base({ job: { title: "Full-Stack Developer", tech: ["React", "Node.js", "Kafka"], text: "" } }),
    );
    const cov = ruleOf(r, "keywordCoverage");
    expect(cov.params.total).toBe(3);
    expect(cov.items).toContain("Kafka");
    expect(ruleOf(r, "titleMatch").status).toBe("pass");
  });

  it("requires ownership signals for senior targets only", () => {
    const c = demoContent("en");
    c.experience.forEach((e) => (e.bullets = ["Built a page used by 50 users."]));
    expect(ruleOf(evaluateAts(base({ content: c, senior: true })), "seniority").status).toBe("fail");
    expect(ruleOf(evaluateAts(base({ content: c, senior: false })), "seniority").status).toBe("warn");
    c.experience[0].bullets = [
      "Led the team migration",
      "Designed the API for 3 teams",
      "Mentored 2 engineers in production",
    ];
    expect(ruleOf(evaluateAts(base({ content: c, senior: true })), "seniority").status).toBe("pass");
  });

  it("scores as a weighted pass share, ignoring pending/na", () => {
    expect(atsScore([])).toBe(0);
    expect(
      atsScore([
        { id: "textLayer", group: "parse", status: "pass", params: {}, items: [] },
        { id: "singleColumn", group: "parse", status: "fail", params: {}, items: [] },
        { id: "fileSize", group: "parse", status: "pending", params: {}, items: [] },
      ]),
    ).toBe(60);
  });

  it.each(["he", "en"] as const)(
    "round-trips the real %s PDF export",
    async (lang) => {
      const tpl = TEMPLATES.hitech;
      const content = demoContent(lang);
      const fit = await fitCvPdf({ content, layout: defaultLayout(tpl.defaults, []), tpl, lang });
      const extracted = await extractText(Buffer.from(fit.buffer), "application/pdf");
      const r = evaluateAts(
        base({
          content,
          extracted,
          pdfBytes: fit.buffer.byteLength,
          sections: [...tpl.defaults],
          headings: lang === "he" ? ["תקציר", "ניסיון תעסוקתי"] : ["Summary", "Experience"],
        }),
      );
      expect(ruleOf(r, "textLayer").status).toBe("pass");
      expect(ruleOf(r, "contactInText").status).toBe("pass");
      expect(ruleOf(r, "headingsInText").status).toBe("pass");
      expect(ruleOf(r, "fileSize").status).toBe("pass");
      expect(r.score).toBeGreaterThan(50);
    },
    30_000,
  );
});
