import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiLimitError } from "@/lib/ai/errors";
import { detectLanguage, paraDir, period, segments, shortUrl } from "@/lib/cv-templates/bidi";
import { contentFromTailored, contentStrings, demoContent, withStrings } from "@/lib/cv-templates/content";
import { resolveBlocks } from "@/lib/cv-templates/resolve";
import { defaultLayout, layoutSchema, moveEntry, normalizeLayout } from "@/lib/cv-templates/sections";
import { TEMPLATES, recommendTemplate } from "@/lib/cv-templates/templates";
import { acceptTranslation, needsTranslation, translateContent } from "@/lib/cv-templates/translate";
import { cvTemplateStrings, sectionLabel } from "@/lib/i18n/cv-templates";

const llm = vi.hoisted(() => ({
  provider: { name: "mock", complete: async (): Promise<string> => "" } as {
    name: string;
    complete: (...a: unknown[]) => Promise<string>;
  },
}));
vi.mock("@/lib/ai", () => ({ guardedLLM: async () => llm.provider }));

describe("layout ordering", () => {
  const defaults = TEMPLATES.hitech.defaults;
  it("default layout = template order, then the hidden extras, then custom sections", () => {
    const l = defaultLayout(defaults, ["a1"]);
    expect(l.slice(0, defaults.length).map((e) => e.id)).toEqual([...defaults]);
    expect(
      l
        .filter((e) => !e.visible)
        .map((e) => e.id)
        .sort(),
    ).toEqual(["volunteering"]);
    expect(l.at(-1)).toEqual({ id: "custom:a1", visible: true, titles: {} });
  });
  it("keeps the saved order, drops unknown / duplicate / removed custom ids, appends new ones", () => {
    const saved = [
      { id: "education", visible: true, titles: { he: "לימודים" } },
      { id: "summary", visible: false, titles: {} },
      { id: "summary", visible: true, titles: {} },
      { id: "custom:gone", visible: true, titles: {} },
      { id: "bogus", visible: true, titles: {} },
    ];
    const l = normalizeLayout(saved, defaults, ["new1"]);
    // Saved layout rejected as a whole if any id is invalid → falls back to defaults.
    expect(l.map((e) => e.id).slice(0, 2)).toEqual(["summary", "skills"]);
    const ok = normalizeLayout(saved.slice(0, 4), defaults, ["new1"]);
    expect(ok[0]).toEqual({ id: "education", visible: true, titles: { he: "לימודים" } });
    const at = (id: string) => ok.findIndex((e) => e.id === id);
    expect(ok[at("summary")].visible).toBe(false);
    expect(at("education")).toBeLessThan(at("summary"));
    // A section missing from the saved layout lands after its default predecessor.
    expect(at("military")).toBe(at("education") + 1);
    expect(ok.filter((e) => e.id === "summary")).toHaveLength(1);
    expect(ok.some((e) => e.id === "custom:gone")).toBe(false);
    expect(ok.at(-1)?.id).toBe("custom:new1");
    // Every built-in exactly once.
    expect(new Set(ok.map((e) => e.id)).size).toBe(ok.length);
  });
  it("moveEntry moves and ignores out-of-range moves", () => {
    expect(moveEntry(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveEntry(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveEntry(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
  it("schema rejects long titles and too many entries", () => {
    expect(layoutSchema.safeParse([{ id: "summary", titles: { he: "x".repeat(61) } }]).success).toBe(false);
    expect(layoutSchema.safeParse(Array.from({ length: 30 }, () => ({ id: "summary" }))).success).toBe(false);
  });
  it("resolveBlocks respects order, hidden, empty sections, renames and the sidebar", () => {
    const c = demoContent("he");
    const l = defaultLayout(
      TEMPLATES.creative.defaults,
      c.custom.map((x) => x.id),
    ).map((e) =>
      e.id === "skills" ? { ...e, titles: { he: "טכנולוגיות" } } : e.id === "summary" ? { ...e, visible: false } : e,
    );
    const blocks = resolveBlocks(c, l, TEMPLATES.creative, "he");
    expect(blocks.some((b) => b.id === "summary")).toBe(false);
    expect(blocks.find((b) => b.id === "skills")).toMatchObject({ title: "טכנולוגיות", column: "side" });
    expect(blocks.find((b) => b.id === "experience")?.column).toBe("main");
    const empty = resolveBlocks({ ...c, projects: [] }, l, TEMPLATES.creative, "he");
    expect(empty.some((b) => b.id === "projects")).toBe(false);
  });
});

describe("bidi", () => {
  it("paragraph direction in a Hebrew CV: Hebrew → rtl, pure Latin → ltr", () => {
    expect(paraDir("B.Sc. במדעי המחשב", "rtl")).toBe("rtl");
    expect(paraDir("noa@example.com", "rtl")).toBe("ltr");
    expect(paraDir("2020 – 2023", "rtl")).toBe("rtl");
    expect(paraDir("Senior Engineer", "ltr")).toBe("ltr");
    expect(paraDir("תל אביב", "ltr")).toBe("rtl");
  });
  it("segments split scripts and keep URLs / emails in one LTR run", () => {
    const s = segments("פיתוח ב-React ו-Node.js, ראו github.com/noa-c", true);
    const ltr = s.filter((x) => !x.rtl).map((x) => x.text.trim());
    expect(ltr).toContain("React");
    expect(ltr).toContain("Node.js");
    expect(ltr).toContain("github.com/noa-c");
    expect(s.map((x) => x.text).join("")).toBe("פיתוח ב-React ו-Node.js, ראו github.com/noa-c");
    expect(
      segments("מייל: noa.c+cv@example.co.il", true)
        .find((x) => x.text.includes("@"))
        ?.text.trim(),
    ).toBe("noa.c+cv@example.co.il");
  });
  it("dates and URLs", () => {
    expect(period("2022-03", "", "היום")).toBe("03/2022 – היום");
    expect(period("2019", "2021-7", "Present")).toBe("2019 – 07/2021");
    expect(period("", "", "x")).toBe("");
    expect(shortUrl("https://www.linkedin.com/in/noa/")).toBe("linkedin.com/in/noa");
  });
  it("detects the content language", () => {
    expect(detectLanguage(contentStrings(demoContent("he")))).toBe("he");
    expect(detectLanguage(contentStrings(demoContent("en")))).toBe("en");
  });
});

describe("i18n labels", () => {
  it("every template has a name and a 'fits' line in both languages", () => {
    for (const loc of ["he", "en"] as const)
      for (const id of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
        expect(cvTemplateStrings(loc).templates[id].name).toBeTruthy();
        expect(cvTemplateStrings(loc).templates[id].fits.length).toBeGreaterThan(20);
      }
    expect(sectionLabel("he", "hitech", "military")).toMatch(/צבאי/);
    expect(sectionLabel("en", "hitech", "summary")).toBeTruthy();
  });
});

describe("recommendTemplate", () => {
  it.each([
    [{ targetRoles: ["Backend Engineer"] }, "hitech"],
    [{ desiredRole: "VP R&D" }, "executive"],
    [{ desiredRole: "ראש צוות פיתוח", seniority: "LEAD" }, "executive"],
    [{ targetRoles: ["Junior QA"] }, "junior"],
    [{ desiredRole: "Product Manager" }, "creative"],
    [{ desiredRole: "מעצבת UX" }, "creative"],
    [{ desiredRole: "רואה חשבון" }, "classic"],
  ] as [Parameters<typeof recommendTemplate>[0], string][])("%o → %s", (input, expected) => {
    expect(recommendTemplate(input)).toBe(expected);
  });
});

describe("tailored CV content", () => {
  it("overrides the tailored sections and keeps the rest of the profile", () => {
    const base = demoContent("he");
    const t = contentFromTailored(
      {
        name: "",
        contact: [],
        headline: "Backend Engineer",
        summary: "תקציר מותאם",
        experience: [{ title: "מפתחת", company: "Acme", start: "2021-01", end: "", bullets: ["a"] }],
        skills: ["Go"],
        education: [{ title: "B.Sc.", institution: "הטכניון", start: "", end: "" }],
        languages: [],
      } as never,
      base,
    );
    expect(t.name).toBe(base.name);
    expect(t.summary).toBe("תקציר מותאם");
    expect(t.experience[0]).toMatchObject({ title: "מפתחת", org: "Acme" });
    expect(t.skills).toEqual(["Go"]);
    expect(t.projects).toEqual(base.projects);
    expect(t.military).toEqual(base.military);
    expect(t.languages).toEqual(base.languages);
  });
  it("contentStrings / withStrings round-trip", () => {
    const c = demoContent("he");
    expect(withStrings(c, contentStrings(c))).toEqual(c);
  });
});

describe("translation (LLM mocked)", () => {
  beforeEach(() => {
    llm.provider = { name: "mock", complete: async () => "" };
  });
  it("only sends what needs translating", () => {
    expect(needsTranslation("מפתחת Backend", "en")).toBe(true);
    expect(needsTranslation("React, Node.js", "he")).toBe(false);
    expect(needsTranslation("Led the migration of payments to Kubernetes", "he")).toBe(true);
    expect(needsTranslation("", "en")).toBe(false);
  });
  it("rejects outputs that change numbers, URLs or length", () => {
    expect(acceptTranslation("הובלתי צוות של 5 מפתחים", "Led a team of 6 developers")).toBe("הובלתי צוות של 5 מפתחים");
    expect(acceptTranslation("הובלתי צוות של 5 מפתחים", "Led a team of 5 developers")).toBe(
      "Led a team of 5 developers",
    );
    expect(acceptTranslation("ראו github.com/a", "See github.com/b")).toBe("ראו github.com/a");
    expect(acceptTranslation("שלום", "x".repeat(50))).toBe("שלום");
    expect(acceptTranslation("שלום", 42)).toBe("שלום");
  });
  it("AI off → content unchanged, status off", async () => {
    const c = demoContent("he");
    const r = await translateContent(c, "en", "u1");
    expect(r.status).toBe("off");
    expect(r.content).toEqual(c);
  });
  it("translates in one call and keeps strings that fail the fact check", async () => {
    const c = demoContent("he");
    const calls: unknown[] = [];
    llm.provider = {
      name: "gemini",
      complete: async (...a: unknown[]) => {
        calls.push(a);
        const msgs = a[0] as { content: string }[];
        const { items } = JSON.parse(msgs[1].content) as { items: string[] };
        // Translate everything to "EN:<n>" except keep numbers; break the first item on purpose.
        return JSON.stringify({
          items: items.map((s, i) => (i === 0 ? "999 invented" : `EN ${(s.match(/\d+/g) ?? []).join(" ")} text`)),
        });
      },
    };
    const r = await translateContent(c, "en", "u1");
    expect(calls).toHaveLength(1);
    expect(r.status).toBe("translated");
    expect(r.kept).toBeGreaterThanOrEqual(1);
    expect(r.content.name).toBe(c.name); // first item (the name) failed the check → original kept
    expect(r.content.experience.length).toBe(c.experience.length);
  });
  it("limit / error → untranslated with a status", async () => {
    const c = demoContent("he");
    llm.provider = {
      name: "gemini",
      complete: async () => {
        throw new AiLimitError("user_daily");
      },
    };
    expect(await translateContent(c, "en", "u1")).toMatchObject({
      status: "limited",
      reason: "user_daily",
      content: c,
    });
    llm.provider = { name: "gemini", complete: async () => "not json" };
    expect((await translateContent(c, "en", "u1")).status).toBe("error");
  });
});
