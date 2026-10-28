import { scoreMatch, type Candidate, type ScoredJob } from "@/lib/profile/score";
import { GRAPH, TRACKS, withSkills, type Graph } from "./graph";

/**
 * "Next best topic" — a deterministic, explainable ranking of what to learn now.
 *
 * Only skills whose prerequisites are all known are recommended (so the queue is always in a
 * learnable, topological order), plus anything already in progress. The score combines:
 *  - continuity: skills in progress come first (further along → higher), so you finish what you started;
 *  - job impact: how many of your matching jobs rise, and by how much, if you learn it;
 *  - foundation: a ready prerequisite inherits half the impact of the locked skill it unlocks;
 *  - role fit: the skill is on the curated track for one of your target roles;
 *  - unlocks + market demand as small tie-breakers.
 * Ties break by id, so the output is stable for the same input.
 */

export type Reason =
  | { kind: "continue"; pct: number }
  | { kind: "prereqsMet"; prereqs: string[] }
  | { kind: "noPrereqs" }
  | { kind: "jobs"; jobs: number; avgGain: number }
  | { kind: "foundation"; forId: string }
  | { kind: "role"; track: string }
  | { kind: "unlocks"; ids: string[] }
  | { kind: "demand"; n: number };

export interface Recommendation {
  id: string;
  score: number;
  reasons: Reason[];
}

export interface Impact {
  jobs: number;
  avgGain: number;
}

export interface RecommendInput {
  known: Set<string>;
  /** Skills in progress → 0..1 completion. */
  inProgress: Map<string, number>;
  impact: Map<string, Impact>;
  demand: Map<string, number>;
  targetRoles: string[];
  graph?: Graph;
}

/** Target role category → curated track ids. */
export const ROLE_TRACKS: Record<string, string[]> = {
  backend: ["backend"],
  frontend: ["frontend"],
  fullstack: ["frontend", "backend"],
  devops: ["devops"],
  security: ["devops"],
  data: ["data"],
  ml: ["ml", "data"],
  hardware: ["embedded"],
};

export function roleTrackSkills(roles: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of roles)
    for (const t of ROLE_TRACKS[r] ?? []) {
      const tr = TRACKS.find((x) => x.id === t);
      for (const s of tr?.skills ?? []) if (!out.has(s)) out.set(s, t);
    }
  return out;
}

/** Impact of learning each id on `jobs`, computing the baseline score once per job. */
export function impactMap(c: Candidate, jobs: ScoredJob[], ids: string[], g: Graph = GRAPH): Map<string, Impact> {
  const base = jobs.map((j) => scoreMatch(c, j).score);
  const out = new Map<string, Impact>();
  for (const id of ids) {
    const label = g.byId.get(id)?.label;
    if (!label) continue;
    const next = withSkills(c, [label]);
    let n = 0;
    let sum = 0;
    jobs.forEach((j, i) => {
      const d = scoreMatch(next, j).score - base[i];
      if (d > 0) {
        n++;
        sum += d;
      }
    });
    out.set(id, { jobs: n, avgGain: n ? Math.round((sum / n) * 10) / 10 : 0 });
  }
  return out;
}

const W = {
  continueBase: 60,
  continueSpan: 40,
  impact: 40,
  foundation: 0.5,
  role: 15,
  unlockEach: 3,
  unlockMax: 12,
  demand: 10,
};

export function recommend(input: RecommendInput, limit = 5): Recommendation[] {
  const g = input.graph ?? GRAPH;
  const { known, inProgress, impact, demand } = input;
  const roleSkills = roleTrackSkills(input.targetRoles);
  const ready = (id: string) => g.byId.get(id)!.prerequisites.every((p) => known.has(p));
  const raw = (id: string) => {
    const i = impact.get(id);
    return i ? i.jobs * i.avgGain : 0;
  };
  const maxImpact = Math.max(1, ...g.nodes.map((n) => (known.has(n.id) ? 0 : raw(n.id))));
  const maxDemand = Math.max(1, ...demand.values());

  // Foundation: each locked, impactful skill passes half its impact to its missing ready prerequisites.
  const foundation = new Map<string, { value: number; forId: string }>();
  for (const n of g.nodes) {
    if (known.has(n.id) || ready(n.id) || raw(n.id) <= 0) continue;
    const value = (W.impact * W.foundation * raw(n.id)) / maxImpact;
    const stack = [...n.prerequisites];
    const seen = new Set<string>();
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p) || known.has(p)) continue;
      seen.add(p);
      if (ready(p)) {
        const cur = foundation.get(p);
        if (!cur || value > cur.value || (value === cur.value && n.id < cur.forId))
          foundation.set(p, { value, forId: n.id });
      } else stack.push(...g.byId.get(p)!.prerequisites);
    }
  }

  const out: Recommendation[] = [];
  for (const n of g.nodes) {
    if (known.has(n.id)) continue;
    const progress = inProgress.get(n.id);
    if (progress === undefined && !ready(n.id)) continue;
    const reasons: Reason[] = [];
    let score = 0;
    if (progress !== undefined) {
      score += W.continueBase + W.continueSpan * progress;
      reasons.push({ kind: "continue", pct: Math.round(progress * 100) });
    }
    const imp = impact.get(n.id);
    if (imp && imp.jobs > 0) {
      score += (W.impact * raw(n.id)) / maxImpact;
      reasons.push({ kind: "jobs", jobs: imp.jobs, avgGain: imp.avgGain });
    }
    const f = foundation.get(n.id);
    if (f) {
      score += f.value;
      reasons.push({ kind: "foundation", forId: f.forId });
    }
    const track = roleSkills.get(n.id);
    if (track) {
      score += W.role;
      reasons.push({ kind: "role", track });
    }
    const d = demand.get(n.id) ?? 0;
    const signal = score > 0 || d > 0;
    if (!signal) continue;
    if (d > 0) score += (W.demand * d) / maxDemand;
    const unlocks = (g.dependents.get(n.id) ?? []).filter((x) => !known.has(x)).sort();
    if (unlocks.length) {
      score += Math.min(W.unlockMax, W.unlockEach * unlocks.length);
      reasons.push({ kind: "unlocks", ids: unlocks.slice(0, 3) });
    }
    if (ready(n.id))
      reasons.push(
        n.prerequisites.length ? { kind: "prereqsMet", prereqs: [...n.prerequisites] } : { kind: "noPrereqs" },
      );
    if (d > 0) reasons.push({ kind: "demand", n: d });
    out.push({ id: n.id, score: Math.round(score * 100) / 100, reasons });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, limit);
}
