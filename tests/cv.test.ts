import { describe, expect, it } from "vitest";
import { generateCvSuggestions, heuristicSuggestions } from "@/lib/ai/cv-suggestions";
import { MockProvider } from "@/lib/ai/providers/mock";
import type { LLMProvider } from "@/lib/ai/types";
import { extractText, parseCvText } from "@/lib/cv/parse";

const cv =
  "Dana Cohen\ndana@example.com | 054-123-4567\nFull Stack Developer, 5 years experience with React, TypeScript and Node.js.";
const job = { title: "Full Stack Developer", description: "", techStack: ["React", "TypeScript", "AWS", "Docker"] };

describe("CV parsing", () => {
  it("extracts contact details, skills and years", () => {
    const p = parseCvText(cv);
    expect(p.email).toBe("dana@example.com");
    expect(p.phone).toBe("054-123-4567");
    expect(p.skills).toEqual(["Node.js", "React", "TypeScript"]);
    expect(p.yearsExperience).toBe(5);
  });
  it("reads plain text files", async () => {
    expect(await extractText(Buffer.from("hello"), "text/plain")).toBe("hello");
  });
});

describe("CV suggestions", () => {
  it("suggests missing skills and measurable impact (Hebrew)", () => {
    const s = heuristicSuggestions({ resumeText: cv, job, locale: "he" });
    expect(
      s
        .filter((x) => x.kind === "missing_skill")
        .map((x) => x.text)
        .join(" "),
    ).toMatch(/AWS[\s\S]*Docker/);
    expect(s.some((x) => x.kind === "impact")).toBe(true);
  });
  it("uses heuristics with the mock provider", async () => {
    const r = await generateCvSuggestions({ resumeText: cv, job, locale: "en" }, new MockProvider());
    expect(r.provider).toBe("mock");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
  it("parses LLM JSON and falls back on errors", async () => {
    const ok: LLMProvider = {
      name: "fake",
      complete: async () => JSON.stringify({ suggestions: [{ kind: "keyword", text: "Add AWS" }] }),
    };
    expect((await generateCvSuggestions({ resumeText: cv, job, locale: "en" }, ok)).suggestions).toEqual([
      { kind: "keyword", text: "Add AWS" },
    ]);
    const bad: LLMProvider = { name: "fake", complete: async () => "not json" };
    expect((await generateCvSuggestions({ resumeText: cv, job, locale: "en" }, bad)).provider).toBe(
      "heuristic-fallback",
    );
  });
});
