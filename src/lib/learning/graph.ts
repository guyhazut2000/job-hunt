/**
 * Pure logic over the learning skill graph: alias lookup, validation (missing prereqs, cycles),
 * topological ordering, and the "close the gaps" plan for a job. No DB access here.
 */
import { scoreMatch, type Candidate, type ScoredJob } from "../profile/score";
import type { SkillCategory, SkillItem } from "../profile/schema";
import { SKILLS } from "./skills-graph";
import type { LearnCategory, SkillNode } from "./types";

const norm = (s: string) => s.trim().toLowerCase();

export interface Graph {
  nodes: SkillNode[];
  byId: Map<string, SkillNode>;
  /** lowercased label/alias/id -> node id */
  alias: Map<string, string>;
  /** node id -> ids of nodes that list it as a prerequisite */
  dependents: Map<string, string[]>;
}

export function buildGraph(nodes: SkillNode[]): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const alias = new Map<string, string>();
  for (const n of nodes)
    for (const a of [n.id, n.label, ...n.aliases]) if (!alias.has(norm(a))) alias.set(norm(a), n.id);
  const dependents = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const n of nodes) for (const p of n.prerequisites) dependents.get(p)?.push(n.id);
  return { nodes, byId, alias, dependents };
}

export const GRAPH = buildGraph(SKILLS);

/** Map a free-text skill or job tech label to a node, via id, label or alias (case-insensitive). */
export function resolveSkill(name: string, g: Graph = GRAPH): SkillNode | undefined {
  const id = g.alias.get(norm(name));
  return id ? g.byId.get(id) : undefined;
}

export interface GraphProblems {
  missingPrereqs: { id: string; prereq: string }[];
  duplicateAliases: { alias: string; ids: string[] }[];
  /** One cycle path per cycle found, e.g. ["a","b","a"]. Empty for a DAG. */
  cycles: string[][];
}

export function findCycles(nodes: SkillNode[]): string[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, 0 | 1 | 2>(); // 0 unvisited, 1 on stack, 2 done
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (id: string) => {
    state.set(id, 1);
    stack.push(id);
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(p)) continue;
      const s = state.get(p) ?? 0;
      if (s === 1) cycles.push([...stack.slice(stack.indexOf(p)), p]);
      else if (s === 0) visit(p);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const n of nodes) if ((state.get(n.id) ?? 0) === 0) visit(n.id);
  return cycles;
}

export function validateGraph(nodes: SkillNode[]): GraphProblems {
  const ids = new Set(nodes.map((n) => n.id));
  const missingPrereqs = nodes.flatMap((n) =>
    n.prerequisites.filter((p) => !ids.has(p)).map((prereq) => ({ id: n.id, prereq })),
  );
  const owners = new Map<string, Set<string>>();
  for (const n of nodes)
    for (const a of [n.id, n.label, ...n.aliases]) {
      const k = norm(a);
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k)!.add(n.id);
    }
  const duplicateAliases = [...owners].filter(([, s]) => s.size > 1).map(([alias, s]) => ({ alias, ids: [...s] }));
  return { missingPrereqs, duplicateAliases, cycles: findCycles(nodes) };
}

/**
 * Kahn's algorithm restricted to `ids` (edges outside the set are ignored). Among nodes that are
 * ready at the same time, higher `priority` goes first, then id for determinism.
 * Throws on a cycle.
 */
export function topoSort(ids: string[], g: Graph = GRAPH, priority: (id: string) => number = () => 0): string[] {
  const set = new Set(ids);
  const indeg = new Map<string, number>();
  for (const id of set) indeg.set(id, (g.byId.get(id)?.prerequisites ?? []).filter((p) => set.has(p)).length);
  const ready = [...set].filter((id) => indeg.get(id) === 0);
  const out: string[] = [];
  const cmp = (a: string, b: string) => priority(b) - priority(a) || a.localeCompare(b);
  while (ready.length) {
    ready.sort(cmp);
    const id = ready.shift()!;
    out.push(id);
    for (const d of g.dependents.get(id) ?? []) {
      if (!set.has(d)) continue;
      const k = indeg.get(d)! - 1;
      indeg.set(d, k);
      if (k === 0) ready.push(d);
    }
  }
  if (out.length !== set.size) throw new Error("Cycle in skill graph");
  return out;
}

/** All transitive prerequisites of `id` (not including itself), in learning order. */
export function prerequisitePath(id: string, g: Graph = GRAPH): string[] {
  const seen = new Set<string>();
  const walk = (x: string) => {
    for (const p of g.byId.get(x)?.prerequisites ?? [])
      if (!seen.has(p)) {
        seen.add(p);
        walk(p);
      }
  };
  walk(id);
  return topoSort([...seen], g);
}

/** Node ids the candidate already covers: any profile skill that resolves to a node, plus DONE progress. */
export function knownSkillIds(
  skills: { name: string }[],
  doneIds: Iterable<string> = [],
  g: Graph = GRAPH,
): Set<string> {
  const out = new Set<string>(doneIds);
  for (const s of skills) {
    const n = resolveSkill(s.name, g);
    if (n) out.add(n.id);
  }
  return out;
}

const CATEGORY_MAP: Record<LearnCategory, SkillCategory> = {
  foundations: "tools",
  languages: "languages",
  backend: "backend",
  frontend: "frontend",
  mobile: "mobile",
  data: "data",
  devops: "cloud",
  cloud: "cloud",
  ml: "ml",
  qa: "tools",
  hardware: "other",
  design: "other",
};
export const profileCategory = (n: SkillNode): SkillCategory => CATEGORY_MAP[n.category];

/** The profile skill item we add when a user marks a node DONE. */
export function learnedSkillItem(n: SkillNode): SkillItem {
  return { name: n.label, level: "BASIC", years: null, category: profileCategory(n) };
}

/** Candidate with extra (learned) skills added at BASIC, skipping ones already present by name. */
export function withSkills(c: Candidate, labels: string[]): Candidate {
  const have = new Set(c.skills.map((s) => norm(s.name)));
  const extra = labels
    .filter((l) => !have.has(norm(l)))
    .map((name): SkillItem => ({ name, level: "BASIC", years: null, category: "other" }));
  return { ...c, skills: [...c.skills, ...extra] };
}

export interface GapStep {
  node: SkillNode;
  /** The job's own tech label this step closes (undefined for a pure prerequisite). */
  jobLabel?: string;
  /** True when the job doesn't list it but a missing skill depends on it. */
  isPrerequisite: boolean;
  /** For prerequisites: which planned skills need it. */
  neededFor: string[];
  /** Points this job's match rises by when this skill alone is added at BASIC. */
  gain: number;
  /** Open jobs listing this skill (from the demand map). */
  demand: number;
  hours: number;
}

export interface GapPlan {
  current: number;
  /** Match after learning every planned skill (at BASIC). */
  after: number;
  steps: GapStep[];
  /** Missing job skills we have no roadmap for yet. */
  unmapped: string[];
  totalHours: number;
}

/**
 * Build the ordered plan for one job.
 * @param demand   node id -> number of open jobs listing that skill
 * @param doneIds  node ids the user marked DONE (counted as known even if not on the profile)
 */
export function planGaps(
  c: Candidate,
  job: ScoredJob,
  opts: { demand?: Map<string, number>; doneIds?: Iterable<string>; graph?: Graph } = {},
): GapPlan {
  const g = opts.graph ?? GRAPH;
  const demandOf = (n: SkillNode) => opts.demand?.get(n.id) ?? 0;
  const base = scoreMatch(c, job);
  const known = knownSkillIds(c.skills, opts.doneIds, g);

  const jobLabelFor = new Map<string, string>();
  const unmapped: string[] = [];
  for (const t of base.missingSkills) {
    const n = resolveSkill(t, g);
    if (!n) unmapped.push(t);
    else if (!jobLabelFor.has(n.id)) jobLabelFor.set(n.id, t);
  }

  // Expand prerequisites the user lacks.
  const planned = new Set(jobLabelFor.keys());
  const neededFor = new Map<string, Set<string>>();
  const expand = (id: string) => {
    for (const p of g.byId.get(id)?.prerequisites ?? []) {
      if (known.has(p)) continue;
      if (!neededFor.has(p)) neededFor.set(p, new Set());
      neededFor.get(p)!.add(id);
      if (!planned.has(p)) {
        planned.add(p);
        expand(p);
      }
    }
  };
  for (const id of [...planned]) expand(id);

  const gain = new Map<string, number>();
  for (const [id, label] of jobLabelFor) gain.set(id, scoreMatch(withSkills(c, [label]), job).score - base.score);

  // Priority = own gain*1000 + demand; prerequisites inherit the max of what they unlock.
  const own = (id: string) => (gain.get(id) ?? 0) * 1000 + demandOf(g.byId.get(id)!);
  const prio = new Map<string, number>();
  const prioOf = (id: string, seen = new Set<string>()): number => {
    if (prio.has(id)) return prio.get(id)!;
    seen.add(id);
    let p = jobLabelFor.has(id) ? own(id) : 0;
    for (const d of neededFor.get(id) ?? []) if (!seen.has(d)) p = Math.max(p, prioOf(d, seen));
    prio.set(id, p);
    return p;
  };
  const order = topoSort([...planned], g, (id) => prioOf(id));

  const steps: GapStep[] = order.map((id) => {
    const node = g.byId.get(id)!;
    return {
      node,
      jobLabel: jobLabelFor.get(id),
      isPrerequisite: !jobLabelFor.has(id),
      neededFor: [...(neededFor.get(id) ?? [])].map((d) => g.byId.get(d)!.label),
      gain: gain.get(id) ?? 0,
      demand: demandOf(node),
      hours: node.hours,
    };
  });
  const after = scoreMatch(withSkills(c, [...jobLabelFor.values()]), job).score;
  return {
    current: base.score,
    after,
    steps,
    unmapped,
    totalHours: steps.reduce((a, s) => a + s.hours, 0),
  };
}

/**
 * "Before" score for skills the user added through learning: the job's match with those
 * learned labels removed from the candidate, so the UI can show before → now.
 */
export function scoreWithout(c: Candidate, job: ScoredJob, removeLabels: string[]): number {
  const rm = new Set(removeLabels.map(norm));
  return scoreMatch({ ...c, skills: c.skills.filter((s) => !rm.has(norm(s.name))) }, job).score;
}

/**
 * Cross-job impact: how many of `jobs` the candidate's match rises on if they learn `label`,
 * and the average rise among those.
 */
export function crossJobImpact(c: Candidate, jobs: ScoredJob[], label: string): { jobs: number; avgGain: number } {
  const next = withSkills(c, [label]);
  let n = 0;
  let sum = 0;
  for (const j of jobs) {
    const d = scoreMatch(next, j).score - scoreMatch(c, j).score;
    if (d > 0) {
      n++;
      sum += d;
    }
  }
  return { jobs: n, avgGain: n ? Math.round((sum / n) * 10) / 10 : 0 };
}

/** Curated tracks shown on /learn. Order within a track is computed (topological). */
export const TRACKS: { id: string; skills: string[] }[] = [
  {
    id: "devops",
    skills: [
      "linux",
      "networking",
      "git",
      "docker",
      "kubernetes",
      "helm",
      "terraform",
      "ci-cd",
      "github-actions",
      "observability",
      "prometheus",
      "aws",
    ],
  },
  {
    id: "backend",
    skills: ["git", "sql", "postgresql", "python", "fastapi", "nodejs", "typescript", "redis", "docker", "kafka"],
  },
  { id: "frontend", skills: ["html-css", "javascript", "typescript", "react", "nextjs", "tailwind", "playwright"] },
  { id: "data", skills: ["sql", "python", "pandas", "spark", "airflow", "dbt", "snowflake"] },
  { id: "ml", skills: ["python", "pandas", "scikit-learn", "pytorch", "llm", "langchain"] },
  { id: "embedded", skills: ["cpp", "linux", "rtos", "verilog", "systemverilog"] },
];

export function trackOrder(skills: string[], g: Graph = GRAPH): string[] {
  return topoSort(
    skills.filter((s) => g.byId.has(s)),
    g,
  );
}
