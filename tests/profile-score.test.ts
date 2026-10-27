import { describe, expect, it } from "vitest";
import { type Candidate, scoreMatch, skillStrength, toCandidate } from "@/lib/profile/score";

const job = {
  techStack: ["React", "TypeScript", "Node.js", "AWS"],
  roleCategory: "fullstack",
  seniority: "SENIOR" as const,
  location: "Tel Aviv, Israel",
  workMode: "HYBRID" as const,
};
const base: Candidate = {
  skills: ["React", "TypeScript", "Node.js", "AWS"].map((name) => ({
    name,
    level: "EXPERT",
    years: 5,
    category: "other",
  })),
  targetRoles: ["fullstack"],
  targetSeniorities: ["SENIOR"],
  regions: ["tel_aviv"],
  workModes: ["HYBRID"],
  wantedTech: [],
  avoidTech: [],
};

describe("scoreMatch v2", () => {
  it("gives a perfect candidate 100 with positive reasons", () => {
    const m = scoreMatch(base, job);
    expect(m.score).toBe(100);
    expect(m.reasons.every((r) => r.tone !== "minus")).toBe(true);
    expect(m.reasons.map((r) => r.key)).toEqual(
      expect.arrayContaining(["skills", "topSkill", "role", "seniority", "region"]),
    );
  });

  it("weights skill level and years", () => {
    const basic = scoreMatch({ ...base, skills: base.skills.map((s) => ({ ...s, level: "BASIC", years: 0 })) }, job);
    const good = scoreMatch({ ...base, skills: base.skills.map((s) => ({ ...s, level: "GOOD", years: 2 })) }, job);
    expect(basic.parts.skills).toBeLessThan(good.parts.skills);
    expect(good.parts.skills).toBeLessThan(50);
    expect(skillStrength({ name: "x", level: "EXPERT", years: 0, category: "other" })).toBeLessThan(1);
    expect(skillStrength({ name: "x", level: "GOOD", years: null, category: "other" })).toBe(0.8);
  });

  it("scores seniority distance and infers it from years when no target", () => {
    expect(scoreMatch({ ...base, targetSeniorities: ["MID"] }, job).parts.seniority).toBe(10);
    expect(scoreMatch({ ...base, targetSeniorities: ["JUNIOR"] }, job).parts.seniority).toBe(0);
    expect(scoreMatch({ ...base, targetSeniorities: [], totalYears: 6 }, job).parts.seniority).toBe(20);
    expect(scoreMatch({ ...base, targetSeniorities: [], totalYears: 1 }, job).reasons.map((r) => r.key)).toContain(
      "seniorityGap",
    );
  });

  it("applies hard filters as penalties with explanations", () => {
    const m = scoreMatch({ ...base, workModes: ["REMOTE"], regions: ["haifa"] }, job);
    expect(m.parts.penalty).toBe(45);
    expect(m.score).toBe(40);
    expect(m.reasons.filter((r) => r.tone === "minus").map((r) => r.key)).toEqual([
      "regionMismatch",
      "workModeMismatch",
    ]);
    // remote jobs never get a region penalty
    expect(
      scoreMatch({ ...base, regions: ["haifa"], workModes: [] }, { ...job, workMode: "REMOTE" }).parts.penalty,
    ).toBe(0);
    // unknown job region is neutral
    expect(scoreMatch({ ...base, regions: ["haifa"] }, { ...job, location: "Israel" }).parts.penalty).toBe(0);
  });

  it("rewards wanted tech and penalizes avoided tech", () => {
    const m = scoreMatch({ ...base, wantedTech: ["aws"], avoidTech: ["react"], skills: [] }, job);
    expect(m.parts.bonus).toBe(3);
    expect(m.parts.penalty).toBe(8);
    expect(m.reasons.map((r) => r.key)).toEqual(expect.arrayContaining(["wantedTech", "avoidTech", "skillsNone"]));
  });

  it("stays within 0..100 and lists missing skills", () => {
    const m = scoreMatch(
      {
        ...base,
        skills: [{ name: "React", level: "GOOD", years: null, category: "frontend" }],
        avoidTech: ["typescript", "aws"],
        workModes: ["ONSITE"],
        regions: ["south"],
      },
      job,
    );
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.missingSkills).toEqual(["TypeScript", "Node.js", "AWS"]);
  });
});

describe("toCandidate", () => {
  it("falls back to v1 profile fields", () => {
    const c = toCandidate({
      skills: ["React"],
      desiredRole: "frontend",
      seniority: "MID",
      workMode: "REMOTE",
      yearsExperience: 3,
    });
    expect(c).toMatchObject({
      targetRoles: ["frontend"],
      targetSeniorities: ["MID"],
      workModes: ["REMOTE"],
      totalYears: 3,
    });
    expect(c.skills[0]).toMatchObject({ name: "React", level: "GOOD" });
  });
  it("prefers structured skills and drops invalid JSON entries", () => {
    const c = toCandidate({
      skills: ["react", "Go"],
      skillItems: [{ name: "React", level: "EXPERT", years: 4, category: "frontend" }, { nope: 1 }],
      experience: [{ company: "A", title: "Dev", start: "2020-01", end: "2021-12", description: "", tech: [] }],
    });
    expect(c.skills.map((s) => [s.name, s.level])).toEqual([
      ["React", "EXPERT"],
      ["Go", "GOOD"],
    ]);
    expect(c.totalYears).toBe(2);
  });
});

import { computeCompleteness } from "@/lib/profile/completeness";
describe("computeCompleteness", () => {
  it("is 0 for nothing and 100 for a full profile", () => {
    expect(computeCompleteness({ hasCv: false, profile: null }).percent).toBe(0);
    const full = computeCompleteness({
      hasCv: true,
      profile: {
        headline: "Dev",
        summary: "x".repeat(50),
        experience: [{ company: "A", title: "B", start: "2020", end: "", description: "", tech: [] }],
        skillItems: ["React", "Go", "SQL"].map((name) => ({ name, level: "GOOD", years: 2, category: "other" })),
        education: [{ kind: "DEGREE", institution: "TAU", title: "" }],
        languages: [{ name: "Hebrew", level: "NATIVE" }],
        githubUrl: "https://github.com/x",
        targetRoles: ["backend"],
        targetSeniorities: ["MID"],
        regions: ["center"],
        availability: "OPEN",
      },
    });
    expect(full.percent).toBe(100);
    expect(full.missing).toEqual([]);
  });
});
