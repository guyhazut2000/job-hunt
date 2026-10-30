import { describe, expect, it } from "vitest";
import { KNOWN_SKILLS, categorizeSkill } from "@/lib/profile/schema";
import {
  collapse,
  currentFragment,
  groupSkills,
  levelBars,
  levelCounts,
  parseSkillInput,
  replaceFragment,
  skillKey,
  suggestSkills,
  yearsLabel,
} from "@/lib/profile/skills-view";

describe("skills view helpers", () => {
  it("normalizes keys for dedupe (case, spaces, bidi marks, niqqud)", () => {
    expect(skillKey("  Node.JS ")).toBe("node.js");
    expect(skillKey("\u200fReact\u200e")).toBe("react");
    expect(skillKey("ניהול   צוות")).toBe("ניהול צוות");
    expect(skillKey("נִיהוּל")).toBe("ניהול");
  });

  it("parses the add field on any comma and skips duplicates", () => {
    expect(parseSkillInput("Go, kafka ;Terraform\nGo", ["Kafka"])).toEqual(["Go", "Terraform"]);
    expect(parseSkillInput("ניהול צוות، Docker")).toEqual(["ניהול צוות", "Docker"]);
    expect(parseSkillInput(" , ,")).toEqual([]);
  });

  it("autocompletes the last fragment", () => {
    expect(currentFragment("Go, Kaf")).toBe("Kaf");
    expect(replaceFragment("Go, Kaf", "Kafka")).toBe("Go, Kafka");
    expect(replaceFragment("Kaf", "Kafka")).toBe("Kafka");
  });

  it("suggests prefix matches first and hides skills already in the profile", () => {
    const s = suggestSkills("re", KNOWN_SKILLS, ["React"]);
    expect(s).not.toContain("React");
    expect(s[0].toLowerCase().startsWith("re")).toBe(true);
    expect(s).toContain("Redis");
    expect(suggestSkills("", KNOWN_SKILLS)).toEqual([]);
    expect(suggestSkills("script", KNOWN_SKILLS)).toEqual(expect.arrayContaining(["TypeScript", "JavaScript"]));
    expect(suggestSkills("k", KNOWN_SKILLS, [], 3)).toHaveLength(3);
    // every known skill auto-categorizes
    for (const k of KNOWN_SKILLS) expect(categorizeSkill(k)).not.toBe("other");
  });

  it("groups by category order and sorts strongest first without touching indexes", () => {
    const skills = [
      { name: "Go", level: "BASIC", category: "languages" },
      { name: "React", level: "GOOD", category: "frontend" },
      { name: "TypeScript", level: "EXPERT", category: "languages" },
      { name: "Python", level: "GOOD", category: "languages" },
    ] as const;
    const g = groupSkills(skills);
    expect(g.map((x) => x.category)).toEqual(["languages", "frontend"]);
    expect(g[0].items.map((x) => [x.skill.name, x.index])).toEqual([
      ["TypeScript", 2],
      ["Python", 3],
      ["Go", 0],
    ]);
    expect(levelCounts(skills)).toEqual({ BASIC: 1, GOOD: 2, EXPERT: 1 });
    expect([levelBars("BASIC"), levelBars("GOOD"), levelBars("EXPERT")]).toEqual([1, 2, 3]);
  });

  it("collapses long lists but never hides a single item, and keeps pinned ones", () => {
    const xs = Array.from({ length: 12 }, (_, i) => i);
    expect(collapse(xs, 8, false)).toEqual({ shown: [0, 1, 2, 3, 4, 5, 6, 7], hidden: 4 });
    expect(collapse(xs, 8, true).hidden).toBe(0);
    expect(collapse(xs.slice(0, 9), 8, false)).toEqual({ shown: xs.slice(0, 9), hidden: 0 });
    expect(collapse(xs, 8, false, (x) => x === 11)).toEqual({ shown: [0, 1, 2, 3, 4, 5, 6, 7, 11], hidden: 3 });
  });

  it("formats years", () => {
    expect(yearsLabel("")).toBe("");
    expect(yearsLabel(null)).toBe("");
    expect(yearsLabel("0")).toBe("");
    expect(yearsLabel("1.5")).toBe("1.5");
    expect(yearsLabel(5)).toBe("5");
  });
});
