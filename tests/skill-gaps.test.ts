import { describe, expect, it } from "vitest";
import { aggregateGaps, topGap, weakDebrief, type GapJob } from "@/lib/gaps/aggregate";
import type { Candidate } from "@/lib/profile/score";
import { buildCoachData } from "@/lib/coach/build";

const c: Candidate = {
  skills: ["React", "TypeScript"].map((name) => ({ name, level: "EXPERT", years: 5, category: "other" })),
  targetRoles: ["frontend"],
  targetSeniorities: ["SENIOR"],
  regions: ["tel_aviv"],
  workModes: ["HYBRID"],
  wantedTech: [],
  avoidTech: [],
};
const job = (id: string, source: GapJob["source"], techStack: string[]): GapJob => ({
  id,
  title: `Job ${id}`,
  company: "Acme",
  source,
  techStack,
  roleCategory: "frontend",
  seniority: "SENIOR",
  location: "Tel Aviv, Israel",
  workMode: "HYBRID",
});

describe("aggregateGaps", () => {
  const jobs = [
    job("1", "target", ["React", "Kubernetes", "Docker"]),
    job("2", "saved", ["React", "Docker"]),
    job("3", "applied", ["TypeScript", "Docker", "GraphQL"]),
    job("3", "target", ["TypeScript", "Docker", "GraphQL"]), // duplicate of an applied job
    job("4", "target", []),
  ];

  it("counts each job once, ranks by frequency and keeps the raw numbers", () => {
    const r = aggregateGaps({ candidate: c, jobs, debriefs: [] });
    expect(r.counts).toMatchObject({ target: 2, saved: 1, applied: 1, withStack: 3, debriefs: 0 });
    expect(r.gaps[0].label).toBe("Docker");
    expect(r.gaps[0].jobs).toBe(3);
    expect(r.gaps[0].share).toBe(100);
    expect(r.gaps[0].bySource).toEqual({ target: 1, saved: 1, applied: 1 });
    expect(r.gaps[0].avgGain).toBeGreaterThan(0);
    // Profile skills are never reported as job gaps.
    expect(r.gaps.some((g) => g.label === "React" || g.label === "TypeScript")).toBe(false);
  });

  it("weights weak debrief topics and ignores good debriefs", () => {
    const r = aggregateGaps({
      candidate: c,
      jobs,
      debriefs: [
        {
          applicationId: "a",
          title: "x",
          rating: 2,
          outcome: "pending",
          asked: "Kubernetes deployment questions",
          improve: "",
        },
        {
          applicationId: "b",
          title: "y",
          rating: 4,
          outcome: "failed",
          asked: "",
          improve: "Learn Kubernetes and React hooks",
        },
        { applicationId: "c", title: "z", rating: 5, outcome: "passed", asked: "GraphQL", improve: "" },
      ],
    });
    const k8s = r.gaps.find((g) => g.label === "Kubernetes")!;
    expect(k8s.debriefHits).toBe(2);
    expect(k8s.score).toBe(1 + 2 * 2);
    expect(r.gaps[0].label).toBe("Kubernetes");
    expect(r.gaps.find((g) => g.label === "GraphQL")!.debriefHits).toBe(0);
    const react = r.gaps.find((g) => g.label === "React");
    expect(react?.inProfile).toBe(true);
    expect(react?.jobs).toBe(0);
  });

  it("weakDebrief and topGap thresholds", () => {
    expect(weakDebrief({ rating: 3, outcome: "pending" })).toBe(false);
    expect(weakDebrief({ rating: 1, outcome: "passed" })).toBe(true);
    const r = aggregateGaps({ candidate: c, jobs: [job("9", "target", ["Rust"])], debriefs: [] });
    expect(topGap(r)).toBeNull(); // one job only is not a pattern
    expect(topGap(aggregateGaps({ candidate: c, jobs, debriefs: [] }))).toEqual({
      skill: "Docker",
      jobs: 3,
      total: 3,
      debriefs: 0,
    });
  });
});

describe("weekly coach skill-gap recommendation", () => {
  it("adds close_skill_gap with its basis when a top gap is given", () => {
    const d = buildCoachData({
      apps: [],
      contacts: [],
      hasProfile: true,
      topGap: { skill: "Docker", jobs: 3, total: 5, debriefs: 1 },
      now: new Date("2026-11-04T10:00:00Z"),
    });
    const rec = d.recommendations.find((r) => r.id === "close_skill_gap");
    expect(rec?.href).toBe("/learn/gaps");
    expect(rec?.basis).toEqual({ skill: "Docker", jobs: 3, total: 5, debriefs: 1 });
    expect(d.recommendations).toHaveLength(3);
  });
});
