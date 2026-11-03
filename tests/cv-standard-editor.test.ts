import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoContent } from "@/lib/cv-templates/content";
import { applyDraft, draftFromProfile, mergeDraft } from "@/lib/cv-standard/draft";
import { evaluateStandard } from "@/lib/cv-standard/rules";
import { professionalSchema } from "@/lib/profile/schema";

const llm = vi.hoisted(() => ({
  provider: null as null | { name: string; complete: (...a: unknown[]) => Promise<string> },
}));
vi.mock("@/lib/ai", () => ({ guardedLLM: async () => llm.provider }));

const { acceptRewrite, improveBullet, missingParts, improvePrompt } = await import("@/lib/cv-standard/improve");
const { AiLimitError } = await import("@/lib/ai/errors");

const base = {
  text: "Worked on the payments API in Node.js",
  lang: "en" as const,
  role: "Backend Developer",
  company: "Acme",
  corpus: "Node.js PostgreSQL AWS",
};

describe("improve — never invents facts", () => {
  it("missingParts flags metric and verb", () => {
    expect(missingParts("Worked on the payments API")).toEqual(["metric", "verb"]);
    expect(missingParts("Built the payments API, cutting latency by 40%")).toEqual([]);
    expect(missingParts("Built the payments API", "40% faster")).toEqual([]);
  });
  it("prompt forbids invention and carries the user's metric", () => {
    const m = improvePrompt({ ...base, metric: "latency -40%" });
    expect(m[0].content).toMatch(/Never add a number/);
    expect(m[1].content).toContain("latency -40%");
  });
  it("accepts a rewrite that only rephrases", () => {
    expect(acceptRewrite(base, "Built the payments API in Node.js.")).toBe("Built the payments API in Node.js");
  });
  it("rejects an invented number", () => {
    expect(acceptRewrite(base, "Built the payments API in Node.js, cutting latency by 40%")).toBeNull();
  });
  it("accepts a number the user supplied", () => {
    expect(
      acceptRewrite({ ...base, metric: "40% lower latency" }, "Built the payments API in Node.js, cutting latency by 40%"),
    ).not.toBeNull();
  });
  it("rejects an invented technology but allows one from the CV", () => {
    expect(acceptRewrite(base, "Built the payments API in Node.js and Kubernetes")).toBeNull();
    expect(acceptRewrite(base, "Built the payments API in Node.js on AWS")).not.toBeNull();
  });
  it("rejects added first-person and wild length changes", () => {
    expect(acceptRewrite(base, "I built the payments API in Node.js")).toBeNull();
    expect(acceptRewrite(base, "Built API")).toBeNull();
  });
  it("Hebrew: rejects invented numbers", () => {
    const he = { ...base, text: "עבדתי על ממשק התשלומים ב-Node.js", lang: "he" as const };
    expect(acceptRewrite(he, "פיתחתי את ממשק התשלומים ב-Node.js")).not.toBeNull();
    expect(acceptRewrite(he, "פיתחתי את ממשק התשלומים ב-Node.js וקיצרתי זמני תגובה ב-30%")).toBeNull();
  });
});

describe("improveBullet", () => {
  beforeEach(() => {
    llm.provider = null;
  });
  const provider = (out: unknown) => ({ name: "gemini", complete: async () => JSON.stringify(out) });

  it("mock mode: off + asks for metric/verb", async () => {
    llm.provider = { name: "mock", complete: async () => "{}" };
    const r = await improveBullet(base, "u1");
    expect(r.status).toBe("off");
    expect(r.ask).toEqual(["metric", "verb"]);
  });
  it("ok rewrite + question for the missing metric", async () => {
    llm.provider = provider({ rewrite: "Built the payments API in Node.js", missingMetricQuestion: "How much faster did it get?" });
    const r = await improveBullet(base, "u1");
    expect(r).toMatchObject({ status: "ok", rewrite: "Built the payments API in Node.js", ask: ["metric"] });
    expect(r.question).toBe("How much faster did it get?");
  });
  it("rejected when the model invents a metric; question with digits dropped", async () => {
    llm.provider = provider({ rewrite: "Built the payments API in Node.js for 2M users", missingMetricQuestion: "Was it 2M users?" });
    const r = await improveBullet(base, "u1");
    expect(r.status).toBe("rejected");
    expect(r.rewrite).toBeNull();
    expect(r.question).toBeNull();
  });
  it("limited on quota", async () => {
    llm.provider = {
      name: "gemini",
      complete: async () => {
        throw new AiLimitError("daily" as never);
      },
    };
    expect((await improveBullet(base, "u1")).status).toBe("limited");
  });
});

describe("draft", () => {
  const p = professionalSchema.parse({
    headline: "Backend Developer",
    summary: "Builds APIs",
    phone: "050-1234567",
    experience: [{ company: "Acme", title: "Dev", start: "2022-01", description: "Built X\nShipped Y" }],
    projects: [{ name: "Side", description: "Made Z" }],
    skillItems: [{ name: "Node.js", level: "EXPERT", category: "backend" }],
  });

  it("round-trips profile → draft → profile", () => {
    const d = draftFromProfile(p, { name: "Dana", location: "Tel Aviv" });
    expect(d.experience[0].bullets).toEqual(["Built X", "Shipped Y"]);
    const m = mergeDraft(p, d);
    expect(m.ok && m.professional.experience[0].description).toBe("Built X\nShipped Y");
  });
  it("merges edited bullets, drops empties, keeps skill level, dedupes", () => {
    const d = draftFromProfile(p, { name: "Dana", location: "" });
    d.experience[0].bullets = ["  Led   the API ", "", "Cut cost 20%"];
    d.skills = [
      { name: "Node.js", category: "backend" },
      { name: "node.js", category: "tools" },
      { name: "AWS", category: "cloud" },
    ];
    const m = mergeDraft(p, d);
    if (!m.ok) throw new Error(m.path);
    expect(m.professional.experience[0].description).toBe("Led the API\nCut cost 20%");
    expect(m.professional.skillItems.map((s) => [s.name, s.level])).toEqual([
      ["Node.js", "EXPERT"],
      ["AWS", "GOOD"],
    ]);
  });
  it("rejects an invalid phone / URL", () => {
    const d = draftFromProfile(p, { name: "Dana", location: "" });
    expect(mergeDraft(p, { ...d, phone: "abc" }).ok).toBe(false);
    expect(mergeDraft(p, { ...d, linkedinUrl: "linkedin" }).ok).toBe(false);
  });
  it("applyDraft feeds the live rules", () => {
    const c = demoContent("en");
    const d = { ...draftFromProfile(p, { name: "", location: "" }), experience: [], projects: [] };
    const r = evaluateStandard({ content: applyDraft(c, d, "a@b.co"), template: "hitech", skillCategories: [], fit: null });
    expect(r.blocking.map((x) => x.id)).toContain("name");
    const ok = applyDraft(c, { ...d, name: "Dana Levi" }, "a@b.co");
    expect(ok.name).toBe("Dana Levi");
    expect(ok.contact.find((x) => x.kind === "email")?.value).toBe("a@b.co");
  });
});
