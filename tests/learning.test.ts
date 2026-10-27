import { describe, expect, it } from "vitest";
import {
  buildGraph,
  crossJobImpact,
  findCycles,
  GRAPH,
  learnedSkillItem,
  planGaps,
  prerequisitePath,
  resolveSkill,
  scoreWithout,
  topoSort,
  TRACKS,
  trackOrder,
  validateGraph,
  withSkills,
} from "@/lib/learning/graph";
import { SKILLS } from "@/lib/learning/skills-graph";
import type { SkillNode } from "@/lib/learning/types";
import type { Candidate } from "@/lib/profile/score";
import { TECH_KEYWORDS } from "@/lib/taxonomy";

const node = (id: string, prerequisites: string[] = []): SkillNode => ({
  id,
  label: id.toUpperCase(),
  aliases: [],
  category: "devops",
  prerequisites,
  hours: 10,
  summary: { he: "", en: "" },
  stages: { fundamentals: [], intermediate: [], applied: [] },
  docs: { title: "", url: "https://example.com", by: "" },
  course: { title: "", url: "https://example.com", by: "" },
  project: { he: "", en: "" },
});

const candidate = (skills: string[]): Candidate => ({
  skills: skills.map((name) => ({ name, level: "GOOD", years: 2, category: "other" })),
  targetRoles: ["devops"],
  targetSeniorities: ["MID"],
  regions: ["tel_aviv"],
  workModes: ["HYBRID"],
  wantedTech: [],
  avoidTech: [],
});

const devopsJob = {
  techStack: ["Kubernetes", "Docker", "Terraform", "AWS", "Python"],
  roleCategory: "devops",
  seniority: "MID" as const,
  location: "Tel Aviv, Israel",
  workMode: "HYBRID" as const,
};

const before = (order: string[], a: string, b: string) => order.indexOf(a) < order.indexOf(b);

describe("skill graph data", () => {
  it("is a valid DAG with known prerequisites and unique aliases", () => {
    expect(validateGraph(SKILLS)).toEqual({ missingPrereqs: [], duplicateAliases: [], cycles: [] });
    expect(new Set(SKILLS.map((n) => n.id)).size).toBe(SKILLS.length);
  });

  it("has complete, https-only content for every node", () => {
    for (const n of SKILLS) {
      expect(n.id).toMatch(/^[a-z0-9-]+$/);
      expect(n.hours).toBeGreaterThan(0);
      expect(n.summary.he && n.summary.en && n.project.he && n.project.en).toBeTruthy();
      for (const st of Object.values(n.stages)) expect(st.length).toBeGreaterThan(0);
      for (const r of [n.docs, n.course]) expect(r.url).toMatch(/^https:\/\//);
    }
  });

  it("maps every extractor label onto a node", () => {
    const unmapped = [...new Set(Object.values(TECH_KEYWORDS))].filter((l) => !resolveSkill(l));
    expect(unmapped).toEqual([]);
  });

  it("resolves aliases case-insensitively", () => {
    expect(resolveSkill("k8s")?.id).toBe("kubernetes");
    expect(resolveSkill("EKS")?.id).toBe("kubernetes");
    expect(resolveSkill("  Docker ")?.id).toBe("docker");
    expect(resolveSkill("postgres")?.id).toBe("postgresql");
    expect(resolveSkill("cv")).toBeUndefined();
    expect(resolveSkill("not a skill")).toBeUndefined();
  });
});

describe("topoSort", () => {
  it("puts Linux and networking before Docker, and Docker before Kubernetes", () => {
    const order = topoSort(["kubernetes", "docker", "linux", "networking"], GRAPH);
    expect(before(order, "linux", "docker")).toBe(true);
    expect(before(order, "networking", "docker")).toBe(true);
    expect(before(order, "docker", "kubernetes")).toBe(true);
  });

  it("only orders the requested set and breaks ties by priority", () => {
    const g = buildGraph([node("a"), node("b"), node("c", ["a"])]);
    expect(topoSort(["c", "b", "a"], g, (id) => (id === "b" ? 5 : 0))).toEqual(["b", "a", "c"]);
    expect(topoSort(["c"], g)).toEqual(["c"]);
  });

  it("every track is in prerequisite order", () => {
    for (const tr of TRACKS) {
      const order = trackOrder(tr.skills);
      expect(order).toHaveLength(tr.skills.length);
      order.forEach((id, i) => {
        for (const p of GRAPH.byId.get(id)!.prerequisites)
          if (order.includes(p)) expect(order.indexOf(p)).toBeLessThan(i);
      });
    }
  });

  it("prerequisitePath walks the transitive prerequisites", () => {
    const path = prerequisitePath("helm");
    expect(path).not.toContain("helm");
    expect(path).toEqual(expect.arrayContaining(["linux", "networking", "docker", "kubernetes"]));
    expect(before(path, "docker", "kubernetes")).toBe(true);
  });
});

describe("cycle detection", () => {
  it("finds a cycle in a synthetic graph and topoSort refuses it", () => {
    const nodes = [node("a", ["c"]), node("b", ["a"]), node("c", ["b"]), node("d")];
    const cycles = findCycles(nodes);
    expect(cycles.length).toBeGreaterThan(0);
    expect(new Set(cycles[0])).toEqual(new Set(["a", "b", "c"]));
    expect(validateGraph(nodes).cycles.length).toBeGreaterThan(0);
    expect(() => topoSort(["a", "b", "c"], buildGraph(nodes))).toThrow(/cycle/i);
  });

  it("detects a self-loop and reports unknown prerequisites", () => {
    expect(findCycles([node("x", ["x"])]).length).toBe(1);
    expect(validateGraph([node("y", ["ghost"])]).missingPrereqs).toEqual([{ id: "y", prereq: "ghost" }]);
  });
});

describe("planGaps", () => {
  it("adds missing prerequisites, marks them, and orders them first", () => {
    const plan = planGaps(candidate(["Python", "AWS"]), devopsJob);
    const ids = plan.steps.map((s) => s.node.id);
    expect(ids).toEqual(expect.arrayContaining(["linux", "networking", "docker", "kubernetes", "terraform"]));
    expect(before(ids, "linux", "docker")).toBe(true);
    expect(before(ids, "docker", "kubernetes")).toBe(true);
    const linux = plan.steps.find((s) => s.node.id === "linux")!;
    expect(linux.isPrerequisite).toBe(true);
    expect(linux.gain).toBe(0);
    expect(linux.neededFor).toContain("Docker");
    const k8s = plan.steps.find((s) => s.node.id === "kubernetes")!;
    expect(k8s.isPrerequisite).toBe(false);
    expect(k8s.jobLabel).toBe("Kubernetes");
    expect(k8s.gain).toBeGreaterThan(0);
    expect(plan.totalHours).toBe(plan.steps.reduce((a, s) => a + s.node.hours, 0));
  });

  it("projects the match after learning and skips what the user knows by alias", () => {
    const c = candidate(["Python", "AWS", "linux", "Networking", "k8s"]);
    const plan = planGaps(c, devopsJob);
    const ids = plan.steps.map((s) => s.node.id);
    expect(ids).not.toContain("linux");
    expect(ids).not.toContain("networking");
    expect(plan.after).toBeGreaterThan(plan.current);
    expect(plan.after).toBe(planGaps(withSkills(c, ["Kubernetes", "Docker", "Terraform"]), devopsJob).current);
  });

  it("counts DONE progress as known and ranks by demand on ties", () => {
    const demand = new Map([
      ["terraform", 50],
      ["docker", 1],
    ]);
    const plan = planGaps(candidate(["Python", "AWS"]), devopsJob, { demand, doneIds: ["linux", "networking"] });
    const ids = plan.steps.map((s) => s.node.id);
    expect(ids).not.toContain("linux");
    // Terraform's own prerequisite (git) inherits its priority, then Terraform, then Docker.
    expect(ids.slice(0, 2)).toEqual(["git", "terraform"]);
    expect(before(ids, "terraform", "docker")).toBe(true);
    expect(plan.steps[1].demand).toBe(50);
    expect(plan.steps[0].isPrerequisite).toBe(true);
  });

  it("reports job skills without a roadmap", () => {
    const plan = planGaps(candidate([]), { ...devopsJob, techStack: ["Docker", "Zig"] });
    expect(plan.unmapped).toEqual(["Zig"]);
  });
});

describe("impact", () => {
  it("crossJobImpact counts jobs whose match rises", () => {
    const c = candidate(["Python"]);
    const jobs = [devopsJob, { ...devopsJob, techStack: ["Python"] }, { ...devopsJob, techStack: ["Docker", "Go"] }];
    const r = crossJobImpact(c, jobs, "Docker");
    expect(r.jobs).toBe(2);
    expect(r.avgGain).toBeGreaterThan(0);
    expect(crossJobImpact(c, jobs, "Python").jobs).toBe(0);
  });

  it("scoreWithout gives the before score for a learned skill", () => {
    const c = withSkills(candidate(["Python"]), ["Docker"]);
    expect(scoreWithout(c, devopsJob, ["Docker"])).toBeLessThan(planGaps(c, devopsJob).current);
  });

  it("learnedSkillItem adds a BASIC profile skill with a mapped category", () => {
    expect(learnedSkillItem(GRAPH.byId.get("kubernetes")!)).toEqual({
      name: "Kubernetes",
      level: "BASIC",
      years: null,
      category: "cloud",
    });
  });
});

describe("v2 AI hooks (deterministic parts)", () => {
  it("packs a gap plan into weeks and gates by plan", async () => {
    const { heuristicStudyPlan, canUseLearningAi } = await import("@/lib/learning/ai");
    const plan = planGaps(candidate([]), devopsJob);
    const weeks = heuristicStudyPlan(plan, 10);
    expect(weeks.flatMap((w) => w.skillIds)).toEqual(plan.steps.map((s) => s.node.id));
    expect(canUseLearningAi("FREE", 3)).toBe(false);
    expect(canUseLearningAi("PRO", 999)).toBe(true);
  });
});
