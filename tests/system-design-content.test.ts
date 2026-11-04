import { describe, expect, it } from "vitest";
import { SD_AI_TOPICS, SD_CHEATSHEET, SD_METHOD, SD_QUESTIONS, SD_SOURCES, sdSource } from "@/lib/sysdesign/content";

const HEBREW = /[\u0590-\u05FF]/;

describe("system design content", () => {
  it("every cited source exists and is an https link", () => {
    const cited = [...SD_METHOD, ...SD_CHEATSHEET, ...SD_AI_TOPICS].flatMap((x) => x.sources);
    for (const id of cited) expect(sdSource(id), id).toBeDefined();
    for (const s of SD_SOURCES) expect(s.url.startsWith("https://"), s.id).toBe(true);
    expect(new Set(SD_SOURCES.map((s) => s.id)).size).toBe(SD_SOURCES.length);
  });

  it("the method fits a 45-minute round", () => {
    expect(SD_METHOD.reduce((n, s) => n + s.minutes, 0)).toBe(45);
  });

  it("questions cover every kind with unique ids and both languages", () => {
    const kinds = new Set(SD_QUESTIONS.map((q) => q.kind));
    expect([...kinds].sort()).toEqual(["ai", "backend", "frontend", "fullstack"]);
    expect(new Set(SD_QUESTIONS.map((q) => q.id)).size).toBe(SD_QUESTIONS.length);
    for (const q of SD_QUESTIONS) {
      expect(HEBREW.test(q.title.he), q.id).toBe(true);
      expect(q.title.en.trim(), q.id).not.toBe("");
      expect(q.clarify.length && q.core.length, q.id).toBeTruthy();
    }
  });

  it("AI topics are sourced", () => {
    for (const t of SD_AI_TOPICS) expect(t.sources.length, t.id).toBeGreaterThan(0);
  });
});
