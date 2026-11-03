import { describe, expect, it } from "vitest";
import {
  compareStepUps,
  currentPosition,
  detectJobLevel,
  gapFor,
  hasLeadership,
  stepTargets,
  stepUpMove,
  type Position,
} from "@/lib/career/ladder";

const pos = (role: string, level: Position["level"], years?: number): Position => ({
  role,
  level,
  source: "years",
  roleSource: "targets",
  years,
});
const job = (title: string, roleCategory: string, seniority: Position["level"], description = "") => ({
  title,
  roleCategory,
  seniority,
  description,
});

describe("currentPosition", () => {
  it("uses years of experience over the stated level and the first target role", () => {
    const p = currentPosition({ targetRoles: ["frontend"], seniority: "SENIOR", totalYears: 3, experienceTitles: [] });
    expect(p).toMatchObject({ role: "frontend", level: "MID", source: "years", roleSource: "targets" });
  });
  it("a senior title in the newest role outranks a short tenure", () => {
    const p = currentPosition({
      targetRoles: [],
      totalYears: 3,
      experienceTitles: ["Senior Backend Engineer", "Developer"],
    });
    expect(p).toMatchObject({ role: "backend", level: "SENIOR", roleSource: "experience" });
  });
  it("falls back to the profile level, then a default", () => {
    expect(currentPosition({ targetRoles: [], seniority: "JUNIOR", experienceTitles: [] }).source).toBe("profile");
    expect(currentPosition({ targetRoles: [], experienceTitles: [] })).toMatchObject({
      role: "fullstack",
      level: "MID",
      source: "default",
    });
  });
  it("honours a manual override", () => {
    const p = currentPosition(
      { targetRoles: ["frontend"], totalYears: 3, experienceTitles: [] },
      {
        role: "backend",
        level: "SENIOR",
      },
    );
    expect(p).toMatchObject({ role: "backend", level: "SENIOR", source: "override", roleSource: "override" });
  });
});

describe("detectJobLevel", () => {
  it("keeps the title's level when the title says it", () => {
    expect(detectJobLevel(job("Senior Frontend Engineer", "frontend", "SENIOR", "2+ years")).level).toBe("SENIOR");
  });
  it("uses the years asked when the title is neutral", () => {
    const l = detectJobLevel(job("Frontend Engineer", "frontend", "MID", "At least 5 years of experience with React"));
    expect(l).toMatchObject({ level: "SENIOR", from: "requirements", years: 5 });
    expect(detectJobLevel(job("מפתח/ת Full Stack", "fullstack", "MID", "8+ שנות ניסיון")).level).toBe("LEAD");
  });
  it("detects leadership asks and the technical branch", () => {
    const l = detectJobLevel(job("Staff Engineer", "backend", "LEAD", "You will mentor engineers"));
    expect(l.leadership).toBe(true);
    expect(l.icTop).toBe(true);
    expect(detectJobLevel(job("Platform Engineer", "backend", "MID", "")).platform).toBe(true);
  });
});

describe("stepUpMove", () => {
  it("one rung up on the same track is a level move", () => {
    expect(stepUpMove(pos("frontend", "MID"), job("Senior Frontend Engineer", "frontend", "SENIOR"))?.kind).toBe(
      "level",
    );
  });
  it("a broader role at the same rung or one up is a broaden move", () => {
    expect(stepUpMove(pos("frontend", "MID"), job("Full Stack Engineer", "fullstack", "MID"))?.kind).toBe("broaden");
    expect(stepUpMove(pos("frontend", "MID"), job("Senior Full Stack", "fullstack", "SENIOR"))?.kind).toBe("broaden");
  });
  it("staff / architect / platform above senior is the technical track", () => {
    expect(stepUpMove(pos("backend", "SENIOR"), job("Staff Backend Engineer", "backend", "LEAD"))?.kind).toBe(
      "technical",
    );
    expect(stepUpMove(pos("backend", "SENIOR"), job("Senior Platform Engineer", "backend", "SENIOR"))?.kind).toBe(
      "technical",
    );
  });
  it("same level, two rungs, step-downs and unrelated roles are not step-ups", () => {
    expect(stepUpMove(pos("frontend", "MID"), job("Frontend Engineer", "frontend", "MID"))).toBeNull();
    expect(stepUpMove(pos("frontend", "MID"), job("Frontend Tech Lead", "frontend", "LEAD"))).toBeNull();
    expect(stepUpMove(pos("frontend", "SENIOR"), job("Frontend Engineer", "frontend", "MID"))).toBeNull();
    expect(stepUpMove(pos("frontend", "MID"), job("Senior Data Engineer", "data", "SENIOR"))).toBeNull();
  });
  it("people management is a step only from lead", () => {
    expect(stepUpMove(pos("backend", "SENIOR"), job("Engineering Manager", "backend", "MANAGER"))).toBeNull();
    expect(stepUpMove(pos("backend", "LEAD"), job("Engineering Manager", "backend", "MANAGER"))?.kind).toBe("level");
  });
  it("a neutral title asking for senior years counts as one rung up", () => {
    const m = stepUpMove(pos("frontend", "MID"), job("Frontend Engineer", "frontend", "MID", "5+ years"));
    expect(m?.kind).toBe("level");
    expect(m?.level.from).toBe("requirements");
  });
});

describe("gapFor", () => {
  const move = stepUpMove(
    pos("frontend", "MID"),
    job("Frontend Engineer", "frontend", "MID", "5+ years, mentor juniors"),
  )!;
  it("small gaps → apply anyway", () => {
    const g = gapFor(move, { missingSkills: ["GraphQL"], years: 4.5, leadership: true });
    expect(g).toMatchObject({ yearsGap: 1, leadershipGap: false, points: 2, verdict: "apply" });
  });
  it("more gaps → stretch, many → far", () => {
    expect(gapFor(move, { missingSkills: ["A", "B"], years: 4, leadership: false }).verdict).toBe("stretch");
    expect(gapFor(move, { missingSkills: ["A", "B", "C", "D", "E"], years: 1, leadership: false }).verdict).toBe("far");
  });
  it("unknown years don't count as a gap", () => {
    expect(gapFor(move, { missingSkills: [], leadership: true }).points).toBe(0);
  });
  it("leadership is read from titles or descriptions", () => {
    expect(hasLeadership(["Team Lead"], [])).toBe(true);
    expect(hasLeadership(["Developer"], ["Mentoring two juniors"])).toBe(true);
    expect(hasLeadership(["Developer"], ["Built things"])).toBe(false);
  });
});

describe("ordering and targets", () => {
  it("sorts by verdict, then points, then match score", () => {
    const g = (points: number, verdict: "apply" | "stretch" | "far") => ({
      missingSkills: [],
      yearsGap: 0,
      leadershipGap: false,
      points,
      verdict,
    });
    const d = new Date("2026-11-01");
    const rows = [
      { id: "a", gap: g(3, "stretch"), score: 90, postedAt: d },
      { id: "b", gap: g(1, "apply"), score: 40, postedAt: d },
      { id: "c", gap: g(1, "apply"), score: 70, postedAt: d },
      { id: "d", gap: g(0, "apply"), score: 10, postedAt: d },
    ];
    expect(rows.sort(compareStepUps).map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });
  it("fetches the same track plus broader roles at the current and next rung", () => {
    expect(stepTargets(pos("frontend", "MID"))).toEqual({
      roles: ["frontend", "fullstack"],
      levels: ["MID", "SENIOR"],
    });
    expect(stepTargets(pos("backend", "SENIOR")).levels).toEqual(["MID", "SENIOR", "LEAD"]);
  });
});
