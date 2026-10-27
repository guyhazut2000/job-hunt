import { describe, expect, it } from "vitest";
import { computeMatch } from "@/lib/ai/match";

const job = {
  techStack: ["React", "TypeScript", "Node.js", "AWS"],
  roleCategory: "fullstack",
  seniority: "MID" as const,
  location: "Tel Aviv, Israel",
  workMode: "HYBRID" as const,
};

describe("computeMatch", () => {
  it("gives a perfect candidate 100", () => {
    const m = computeMatch(
      {
        skills: ["react", "TypeScript", "Node.js", "AWS"],
        desiredRole: "fullstack",
        seniority: "MID",
        location: "Tel Aviv",
      },
      job,
    );
    expect(m.score).toBe(100);
    expect(m.missingSkills).toEqual([]);
  });
  it("explains missing skills and penalizes seniority gaps", () => {
    const m = computeMatch({ skills: ["React"], desiredRole: "backend", seniority: "INTERN", location: "Haifa" }, job);
    expect(m.matchedSkills).toEqual(["React"]);
    expect(m.missingSkills).toEqual(["TypeScript", "Node.js", "AWS"]);
    expect(m.seniority).toBe(0);
    expect(m.role).toBe(10); // related role
    expect(m.score).toBeLessThan(40);
  });
  it("stays within 0..100", () => {
    const m = computeMatch({ skills: [] }, { ...job, techStack: [] });
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });
});
