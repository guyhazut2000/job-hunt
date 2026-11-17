import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { bulletsPrompt, hebrewGender, rewriteBullets, rewriteField } from "@/lib/cv-assist/ai";
import {
  acceptAssist,
  applySuggestion,
  importSuggestions,
  placeholderXyz,
  removeAdded,
  sameOrg,
  targetKeywords,
  type Suggestion,
  type UploadedCv,
  weakExtraction,
} from "@/lib/cv-assist/core";
import { applyDraft, draftFromProfile, draftPlaceholders, draftSchema, mergeDraft } from "@/lib/cv-standard/draft";
import { demoContent } from "@/lib/cv-templates/content";
import { heuristicExtract } from "@/lib/profile/extract";
import { professionalSchema } from "@/lib/profile/schema";

const profile = professionalSchema.parse({
  headline: "Backend Developer",
  summary: "",
  experience: [
    { company: "Acme Ltd", title: "Developer", start: "2022-01", description: "Built the billing API in Node.js" },
  ],
  projects: [],
  education: [{ kind: "DEGREE", institution: "Tel Aviv University", title: "B.Sc. Computer Science" }],
  skillItems: [{ name: "Node.js", level: "EXPERT", category: "backend" }],
});
const draft = () => draftFromProfile(profile, { name: "Dana", location: "" });

const cv: UploadedCv = {
  label: "cv-2026.pdf",
  profile: professionalSchema.parse({
    headline: "Full-Stack Developer",
    summary: "Full-stack developer who builds React and Node.js products.",
    phone: "050-1234567",
    linkedinUrl: "https://www.linkedin.com/in/dana",
    experience: [
      {
        company: "Acme",
        title: "Developer",
        start: "2022-01",
        description: "Built the billing API in Node.js\nCut page load time by 40% with React lazy loading",
      },
      {
        company: "Wix",
        title: "Frontend Developer",
        start: "2019-03",
        end: "2021-12",
        description: "Built React dashboards",
      },
    ],
    projects: [{ name: "Job tracker", description: "Next.js app for tracking applications" }],
    education: [
      { kind: "DEGREE", institution: "Tel Aviv University", title: "B.Sc. Computer Science" },
      { kind: "COURSE", institution: "John Bryce", title: "Docker & Kubernetes", end: "2024-06" },
    ],
    skillItems: [
      { name: "Node.js", level: "GOOD", category: "backend" },
      { name: "React", level: "GOOD", category: "frontend" },
      { name: "Docker", level: "GOOD", category: "cloud" },
    ],
  }),
};

const ctx = (d = draft()) => ({
  cvs: [cv],
  draft: d,
  experience: profile.experience.map((e) => ({ title: e.title, org: e.company })),
  projects: [],
  education: profile.education.map((e) => ({ institution: e.institution, title: e.title })),
});

describe("import from uploaded CVs", () => {
  it("summary: suggests the CV's headline/summary verbatim when different", () => {
    const s = importSuggestions({ step: "summary", ...ctx() });
    expect(s.map((x) => x.kind === "field" && [x.field, x.text])).toEqual([
      ["headline", "Full-Stack Developer"],
      ["summary", "Full-stack developer who builds React and Node.js products."],
    ]);
    expect(s[0].from).toBe("cv-2026.pdf");
  });
  it("contact: only fills empty fields", () => {
    const d = { ...draft(), phone: "052-0000000" };
    const s = importSuggestions({ step: "contact", ...ctx(d) });
    expect(s.map((x) => x.kind === "field" && x.field)).toEqual(["linkedinUrl"]);
  });
  it("experience: new bullets for a matched role, a new entry for an unknown one — dates copied, never invented", () => {
    const s = importSuggestions({ step: "experience", ...ctx() });
    const bullets = s.filter((x) => x.kind === "bullet");
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toMatchObject({
      index: 0,
      replace: null,
      text: "Cut page load time by 40% with React lazy loading",
    });
    const entries = s.filter((x) => x.kind === "entry");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      entry: { title: "Frontend Developer", org: "Wix", start: "2019-03", end: "2021-12" },
      bullets: ["Built React dashboards"],
    });
  });
  it("education: adds the course, skips the degree already there", () => {
    const s = importSuggestions({ step: "education", ...ctx() });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: "education", item: { kind: "COURSE", institution: "John Bryce" } });
  });
  it("skills: CV skills the draft lacks", () => {
    const s = importSuggestions({ step: "skills", ...ctx() });
    expect(s.map((x) => x.kind === "skill" && x.name).sort()).toEqual(["Docker", "React"]);
  });
  it("works on the rules parser output of a stored CV text (old uploads)", () => {
    const text =
      "Dana Levi\nExperience\nSenior Developer | Monday.com | 2020 - 2023\n- Led the migration to TypeScript\nSkills\nTypeScript, GraphQL";
    const p = professionalSchema.parse(heuristicExtract(text));
    const s = importSuggestions({ step: "skills", ...ctx(), cvs: [{ label: "old.pdf", profile: p }] });
    expect(s.some((x) => x.kind === "skill" && /graphql/i.test(x.name))).toBe(true);
  });
  it("sameOrg tolerates suffixes", () => {
    expect(sameOrg("Wix", "Wix.com Ltd")).toBe(true);
    expect(sameOrg("Acme Ltd", "Acme")).toBe(true);
    expect(sameOrg("Meta", "Metabase")).toBe(false);
  });
});

describe("accepting suggestions only changes the draft; save appends", () => {
  it("entry + education + bullet → merged into the profile on save", () => {
    let d = draft();
    for (const step of ["experience", "education", "skills"] as const)
      for (const s of importSuggestions({ step, ...ctx(d) })) d = applySuggestion(d, s);
    expect(draftSchema.safeParse(d).success).toBe(true);
    const m = mergeDraft(profile, d);
    if (!m.ok) throw new Error(m.path);
    expect(m.professional.experience.map((e) => e.company)).toEqual(["Acme Ltd", "Wix"]);
    expect(m.professional.experience[0].description).toContain("Cut page load time by 40%");
    expect(m.professional.education.map((e) => e.institution)).toEqual(["Tel Aviv University", "John Bryce"]);
    expect(m.professional.skillItems.length).toBe(3);
    // Live preview shows the added role and course.
    const c = applyDraft(demoContent("en"), d, "a@b.co");
    expect(c.experience.at(-1)?.org).toBe("Wix");
    expect(c.education.at(-1)?.org).toBe("John Bryce");
    // Removing an added role works; profile roles can't be removed here.
    expect(removeAdded(d, "experience", 1).experience).toHaveLength(1);
    expect(removeAdded(d, "experience", 0).experience).toHaveLength(2);
  });
  it("edited text wins; replace keeps the other bullets", () => {
    const s: Suggestion = {
      id: "x",
      kind: "bullet",
      origin: "improve",
      section: "experience",
      index: 0,
      replace: 0,
      before: "Built the billing API in Node.js",
      text: "Built the billing API in Node.js, cutting [X%]",
      label: "",
    };
    const d = applySuggestion(draft(), s, "Built the billing API in Node.js for 3 teams");
    expect(d.experience[0].bullets).toEqual(["Built the billing API in Node.js for 3 teams"]);
  });
  it("placeholders block save", () => {
    const d = draft();
    d.experience[0].bullets = ["Cut cost by [X%]"];
    expect(draftPlaceholders(d)).toBe(1);
    d.experience[0].bullets = ["Cut cost by 20% [see note]"];
    expect(draftPlaceholders(d)).toBe(0);
  });
});

describe("no-fabrication checks", () => {
  const corpus = "Built the billing API in Node.js. React. Docker";
  it("rejects new numbers and technologies; allows placeholders", () => {
    const o = "Built the billing API in Node.js";
    expect(acceptAssist(o, "Built the billing API in Node.js, cutting latency by 30%", corpus)).toBeNull();
    expect(acceptAssist(o, "Built the billing API in Node.js and Kubernetes", corpus)).toBeNull();
    expect(acceptAssist(o, "Built the Node.js billing API, cutting latency by [X%]", corpus)).toBe(
      "Built the Node.js billing API, cutting latency by [X%]",
    );
    expect(acceptAssist(o, "Built the billing API in Node.js, used by [N] teams with Docker", corpus)).not.toBeNull();
  });
  it("rules X-Y-Z adds a placeholder only when no number", () => {
    expect(placeholderXyz("פיתחתי API לחיובים", "he")).toBe("פיתחתי API לחיובים, מה ששיפר את [מדד] ב-[X%]");
    expect(placeholderXyz("Cut cost by 20%", "en")).toBeNull();
  });
  it("target keywords split into have / missing", () => {
    const k = targetKeywords(
      [{ id: "j", title: "FS", company: "C", score: 80, required: ["React", "Kubernetes"], preferred: ["Docker"] }],
      corpus,
    );
    expect(k.have.sort()).toEqual(["Docker", "React"]);
    expect(k.missing).toEqual(["Kubernetes"]);
  });
});

const llm = (answer: unknown | Error): LLMProvider => ({
  name: "openai",
  complete: async () => {
    if (answer instanceof Error) throw answer;
    return JSON.stringify(answer);
  },
});
const bulletsInput = {
  section: "experience" as const,
  mode: "tailor" as const,
  lang: "en" as const,
  entries: [{ index: 0, title: "Developer", org: "Acme", bullets: ["Built the billing API in Node.js", "Fixed bugs"] }],
  have: ["Node.js"],
  corpus: "Built the billing API in Node.js. Fixed bugs",
};

describe("AI rewrites", () => {
  it("keeps valid rewrites, drops invented facts", async () => {
    const r = await rewriteBullets(
      llm({
        items: [
          { entry: 0, bullet: 0, rewrite: "Built the Node.js billing API, cutting invoice time by [X%]" },
          { entry: 0, bullet: 1, rewrite: "Fixed 120 bugs in Go services" },
        ],
      }),
      bulletsInput,
    );
    expect(r.status).toBe("ok");
    expect(r.rejected).toBe(1);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0]).toMatchObject({ replace: 0, before: "Built the billing API in Node.js" });
  });
  it("falls back to placeholder rules when over the limit or off", async () => {
    const lim = await rewriteBullets(llm(new AiLimitError("user_daily")), bulletsInput);
    expect(lim.status).toBe("limited");
    expect(lim.source).toBe("rules");
    expect(lim.suggestions.every((s) => s.kind === "bullet" && s.text.includes("[X%]"))).toBe(true);
    const off = await rewriteBullets({ name: "mock", complete: async () => "{}" }, bulletsInput);
    expect(off.status).toBe("off");
  });
  it("summary rewrite: validated, no invented years", async () => {
    const base = {
      field: "summary" as const,
      mode: "improve" as const,
      lang: "en" as const,
      text: "Developer who builds APIs",
      have: [],
      roleTitle: "Developer",
      corpus: "Node.js APIs",
    };
    const ok = await rewriteField(llm({ rewrite: "Backend developer who builds reliable Node.js APIs." }), base);
    expect(ok.suggestions).toHaveLength(1);
    const bad = await rewriteField(llm({ rewrite: "Backend developer with 8 years building Node.js APIs." }), base);
    expect(bad.suggestions).toHaveLength(0);
    expect(bad.rejected).toBe(1);
  });
  it("rules headline for tailoring uses only the user's own title + skills", async () => {
    const r = await rewriteField(
      { name: "mock", complete: async () => "{}" },
      {
        field: "headline",
        mode: "tailor",
        lang: "en",
        text: "",
        have: ["React", "Node.js"],
        roleTitle: "Developer",
        corpus: "",
      },
    );
    expect(r.suggestions[0]).toMatchObject({ text: "Developer | React, Node.js" });
  });
});

describe("quality fixes (real CV shapes)", () => {
  const cvText = [
    "JANE DOE",
    "Software Engineer | Fullstack Developer",
    "EXPERIENCE",
    "Full Stack Developer — Acme City Feb 2024 – Present | Haifa, Israel",
    "● Modernized legacy MS Access systems into cloud-ready web apps",
    "● Built Python automation workflows that increased efficiency by ~80%",
    "▪ Designed RESTful APIs for third-party integrations",
    "PROJECTS",
    "Face2BMI",
    "● Full-stack app estimating BMI from a photo",
    "Stack: React.js · Python / FastAPI",
    "EDUCATION",
    "B.Sc. in Information Systems Engineering Oct 2018 – Jun 2023",
    "ORT Braude College of Engineering, Karmiel, Israel",
    "GPA: 84",
  ].join("\n");

  it("rules parser keeps ● / ▪ bullets, tech lines and two-line degrees", () => {
    const p = heuristicExtract(cvText);
    expect(p.experience).toHaveLength(1);
    expect(p.experience[0].description.split("\n")).toHaveLength(3);
    expect(p.projects.map((x) => x.name)).toEqual(["Face2BMI"]);
    expect(p.education).toHaveLength(1);
    expect(p.education[0]).toMatchObject({
      title: "B.Sc. in Information Systems Engineering",
      institution: "ORT Braude College of Engineering",
      start: "2018-10",
    });
  });
  it("import fills an empty role's bullets even when the profile title is Hebrew", () => {
    const pro = professionalSchema.parse({
      experience: [{ company: "ACME CITY", title: "מתכנת פולסטאק", start: "2024-02", description: "" }],
    });
    const d = draftFromProfile(pro, { name: "", location: "" });
    const s = importSuggestions({
      step: "experience",
      cvs: [{ label: "cv.pdf", profile: professionalSchema.parse(heuristicExtract(cvText)) }],
      draft: d,
      experience: [{ title: "מתכנת פולסטאק", org: "ACME CITY" }],
      projects: [],
      education: [],
    });
    expect(s.filter((x) => x.kind === "bullet")).toHaveLength(3);
    const pr = importSuggestions({
      step: "projects",
      cvs: [{ label: "cv.pdf", profile: professionalSchema.parse(heuristicExtract(cvText)) }],
      draft: d,
      experience: [],
      projects: [],
      education: [],
    });
    expect(pr[0]).toMatchObject({ kind: "entry", bullets: ["Full-stack app estimating BMI from a photo"] });
  });
  it("weak stored extraction is detected", () => {
    expect(weakExtraction({ experience: [{ description: "" }] }, cvText)).toBe(true);
    expect(weakExtraction(heuristicExtract(cvText), cvText)).toBe(false);
  });
  it("Hebrew gender hint from the user's own words", () => {
    expect(hebrewGender(["מתכנת פולסטאק"])).toBe("m");
    expect(hebrewGender(["מפתחת Backend"])).toBe("f");
    expect(hebrewGender(["Fullstack developer"])).toBeNull();
  });
  it("an unchanged model answer is 'same', not 'dropped'", async () => {
    const base = {
      field: "summary" as const,
      mode: "improve" as const,
      lang: "he" as const,
      text: "מפתח Fullstack עם ניסיון ב-React",
      have: [],
      roleTitle: "",
      corpus: "React",
    };
    const r = await rewriteField(llm({ rewrite: "מפתח Fullstack עם ניסיון ב-React" }), base);
    expect(r).toMatchObject({ same: 1, rejected: 0, suggestions: [] });
  });
  it("a summary may use a number the CV states, a bullet may not", async () => {
    const base = {
      field: "summary" as const,
      mode: "improve" as const,
      lang: "en" as const,
      text: "Developer who builds APIs",
      have: [],
      roleTitle: "",
      corpus: "Full-Stack developer with 2+ years of experience. Node.js",
    };
    const ok = await rewriteField(llm({ rewrite: "Full-Stack developer with 2+ years building Node.js APIs." }), base);
    expect(ok.suggestions).toHaveLength(1);
    expect(acceptAssist("Built APIs", "Built APIs for 2 years", base.corpus)).toBeNull();
  });
  it("prompts carry examples, the CV language and no slash forms", () => {
    const sys = bulletsPrompt({ ...bulletsInput, lang: "he", gender: "m" })[0].content;
    expect(sys).toMatch(/EXAMPLES/);
    expect(sys).toMatch(/Write every rewrite in Hebrew/);
    expect(sys).toMatch(/מפתח\/ת/);
    expect(sys).toMatch(/masculine/);
  });
});
