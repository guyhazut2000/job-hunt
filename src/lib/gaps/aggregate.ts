/**
 * Skill-gap analysis across many jobs (#117). Pure: aggregates the skills the user's target, saved
 * and applied jobs ask for, plus tech topics from interview debriefs that went badly, compares them
 * with the profile and ranks the gaps by frequency and impact — with the raw counts kept so the UI
 * can show exactly where every number comes from. Nothing is estimated or invented.
 */
import { crossJobImpact, resolveSkill } from "@/lib/learning/graph";
import type { SkillNode } from "@/lib/learning/types";
import { scoreMatch, type Candidate, type ScoredJob } from "@/lib/profile/score";
import { extractTech } from "@/lib/taxonomy";

export const GAP_SOURCES = ["target", "saved", "applied"] as const;
export type GapSource = (typeof GAP_SOURCES)[number];

export interface GapJob extends ScoredJob {
  id: string;
  title: string;
  company: string;
  source: GapSource;
}

export interface GapDebrief {
  applicationId: string;
  title: string;
  rating: number;
  outcome: string;
  asked: string;
  improve: string;
}

export interface SkillGap {
  /** Skill-graph node id when known (→ /learn/<id>), else a normalized label. */
  key: string;
  label: string;
  nodeId: string | null;
  /** Jobs (all sources) that list the skill and the profile lacks it. */
  jobs: number;
  bySource: Record<GapSource, number>;
  /** Share of analyzed jobs with a tech stack that miss this skill (0..100). */
  share: number;
  /** Weak / failed debriefs that mention it. */
  debriefHits: number;
  /** The skill is already in the profile (only reachable through debriefs). */
  inProfile: boolean;
  /** Average match-score points gained across those jobs if the skill were added. */
  avgGain: number;
  /** jobs + 2 × debriefHits — the ranking key. */
  score: number;
  examples: string[];
}

export interface GapReport {
  /** Jobs analyzed per source (after de-duplication) and those with a tech stack. */
  counts: Record<GapSource, number> & { withStack: number; debriefs: number };
  gaps: SkillGap[];
}

/** A debrief counts as a weak spot when it failed or was self-rated 1–2 of 5. */
export const weakDebrief = (d: Pick<GapDebrief, "rating" | "outcome">) => d.outcome === "failed" || d.rating <= 2;
export const DEBRIEF_WEIGHT = 2;
/** Priority when the same job appears in several sources (applied beats saved beats target). */
const SOURCE_RANK: Record<GapSource, number> = { applied: 3, saved: 2, target: 1 };

const norm = (s: string) => s.trim().toLowerCase();

function keyOf(label: string): { key: string; node: SkillNode | undefined } {
  const node = resolveSkill(label);
  return { key: node ? node.id : norm(label), node };
}

export function aggregateGaps(input: { candidate: Candidate; jobs: GapJob[]; debriefs: GapDebrief[] }): GapReport {
  const c = input.candidate;
  // De-duplicate jobs that appear in more than one source.
  const byId = new Map<string, GapJob>();
  for (const j of input.jobs) {
    const prev = byId.get(j.id);
    if (!prev || SOURCE_RANK[j.source] > SOURCE_RANK[prev.source]) byId.set(j.id, j);
  }
  const jobs = [...byId.values()];
  const withStack = jobs.filter((j) => j.techStack.length > 0);
  const have = new Set(c.skills.map((s) => keyOf(s.name).key));

  const acc = new Map<string, SkillGap & { jobList: GapJob[] }>();
  const get = (label: string) => {
    const { key, node } = keyOf(label);
    let g = acc.get(key);
    if (!g) {
      g = {
        key,
        label: node?.label ?? label.trim(),
        nodeId: node?.id ?? null,
        jobs: 0,
        bySource: { target: 0, saved: 0, applied: 0 },
        share: 0,
        debriefHits: 0,
        inProfile: have.has(key),
        avgGain: 0,
        score: 0,
        examples: [],
        jobList: [],
      };
      acc.set(key, g);
    }
    return g;
  };

  for (const j of withStack) {
    const seen = new Set<string>();
    for (const label of scoreMatch(c, j).missingSkills) {
      const { key } = keyOf(label);
      if (seen.has(key) || have.has(key)) continue;
      seen.add(key);
      const g = get(label);
      g.jobs++;
      g.bySource[j.source]++;
      g.jobList.push(j);
      if (g.examples.length < 3) g.examples.push(j.company ? `${j.title} · ${j.company}` : j.title);
    }
  }

  const weak = input.debriefs.filter(weakDebrief);
  for (const d of weak) {
    const seen = new Set<string>();
    for (const label of extractTech(`${d.asked}\n${d.improve}`)) {
      const { key } = keyOf(label);
      if (seen.has(key)) continue;
      seen.add(key);
      get(label).debriefHits++;
    }
  }

  const gaps = [...acc.values()].map(({ jobList, ...g }) => {
    const impact = jobList.length
      ? crossJobImpact(c, jobList, jobList[0].techStack.find((t) => keyOf(t).key === g.key) ?? g.label)
      : null;
    return {
      ...g,
      share: withStack.length ? Math.round((g.jobs / withStack.length) * 100) : 0,
      avgGain: impact?.avgGain ?? 0,
      score: g.jobs + DEBRIEF_WEIGHT * g.debriefHits,
    };
  });
  gaps.sort((a, b) => b.score - a.score || b.avgGain - a.avgGain || a.label.localeCompare(b.label));

  return {
    counts: {
      target: jobs.filter((j) => j.source === "target").length,
      saved: jobs.filter((j) => j.source === "saved").length,
      applied: jobs.filter((j) => j.source === "applied").length,
      withStack: withStack.length,
      debriefs: weak.length,
    },
    gaps,
  };
}

/** The single gap the weekly coach points at (needs ≥ 2 jobs or a debrief hit to be worth it). */
export function topGap(r: GapReport): { skill: string; jobs: number; total: number; debriefs: number } | null {
  const g = r.gaps.find((x) => x.jobs >= 2 || x.debriefHits >= 1);
  return g ? { skill: g.label, jobs: g.jobs, total: r.counts.withStack, debriefs: g.debriefHits } : null;
}
