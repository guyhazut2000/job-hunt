import { describe, expect, it } from "vitest";
import { findPhone, heuristicExtract, normalizeLlmProfile } from "@/lib/profile/extract";
import { mergeProfessional } from "@/lib/profile/merge";
import { professionalSchema } from "@/lib/profile/schema";
import { readProfessional } from "@/lib/profile/load";

const CV = `Dana Levi
dana@example.com | 052-123 4567

Experience
Senior Engineer at Acme  01/2020 - Present
• Built the payments API in Node.js

Projects
Trail Mapper – offline hiking maps https://github.com/dana/trail
• React Native app with 2k users
CV Helper: a Chrome extension for job seekers

Volunteering
Mentor, Code.org Israel (2019 - 2021)
• Weekly mentoring for high-school girls
`;

describe("profile CV sections", () => {
  it("schema accepts projects, volunteering, custom sections and phone with defaults", () => {
    const p = professionalSchema.parse({});
    expect(p.projects).toEqual([]);
    expect(p.volunteering).toEqual([]);
    expect(p.customSections).toEqual([]);
    expect(p.phone).toBe("");
    const full = professionalSchema.parse({
      phone: "+972 52-123-4567",
      projects: [{ name: "X", url: "https://x.dev", tech: ["React"] }],
      volunteering: [{ organization: "Latet", role: "Volunteer" }],
      customSections: [{ id: "awards1", title: "פרסים", body: "מקום ראשון בהאקתון" }],
    });
    expect(full.projects[0].url).toBe("https://x.dev");
    expect(full.customSections[0].title).toBe("פרסים");
  });

  it("rejects a non-http project url and a junk phone", () => {
    expect(professionalSchema.safeParse({ projects: [{ name: "X", url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(professionalSchema.safeParse({ phone: "call me" }).success).toBe(false);
  });

  it("heuristic extraction finds phone, projects and volunteering", () => {
    const x = heuristicExtract(CV);
    expect(x.phone).toBe("052-123 4567");
    expect(x.projects.map((p) => p.name)).toEqual(["Trail Mapper", "CV Helper"]);
    expect(x.projects[0].url).toBe("https://github.com/dana/trail");
    expect(x.projects[0].description).toContain("React Native");
    expect(x.projects[0].tech).toContain("React Native");
    expect(x.volunteering[0]).toMatchObject({
      organization: "Code.org Israel",
      role: "Mentor",
      start: "2019",
      end: "2021",
    });
    expect(x.volunteering[0].description).toContain("mentoring");
    // experience parsing is unchanged by the new headings
    expect(x.experience[0].company).toBe("Acme");
  });

  it("findPhone handles +972 and returns empty when none", () => {
    expect(findPhone("tel +972-54-765-4321")).toBe("+972-54-765-4321");
    expect(findPhone("no numbers here, 2020-2024")).toBe("");
  });

  it("LLM output: bad project urls and phones are dropped, not invented", () => {
    const x = normalizeLlmProfile({
      phone: "n/a",
      projects: [{ name: "A", role: "", url: "github.com/a", start: "2023", end: "", description: "", tech: [] }],
      volunteering: [{ organization: "B", role: "", start: "", end: "", description: "" }],
    }) as { phone: string; projects: { url: string }[]; volunteering: { organization: string }[] };
    expect(x.phone).toBe("");
    expect(x.projects[0].url).toBe("");
    expect(x.volunteering[0].organization).toBe("B");
  });

  it("merge keeps the user's entries, adds new ones, never touches custom sections", () => {
    const current = professionalSchema.parse({
      phone: "050-1111111",
      projects: [{ name: "Trail Mapper", description: "mine" }],
      customSections: [{ id: "a1", title: "Awards", body: "x" }],
    });
    const x = heuristicExtract(CV);
    const m = mergeProfessional(current, { ...x, customSections: [{ id: "zz", title: "Injected", body: "" }] });
    expect(m.phone).toBe("050-1111111");
    expect(m.projects.map((p) => p.name)).toEqual(["Trail Mapper", "CV Helper"]);
    expect(m.projects[0].description).toBe("mine");
    expect(m.customSections.map((c) => c.title)).toEqual(["Awards"]);
  });

  it("readProfessional tolerates legacy rows without the new columns", () => {
    const p = readProfessional({ headline: "x" } as never);
    expect(p.projects).toEqual([]);
    expect(p.phone).toBe("");
  });
});
