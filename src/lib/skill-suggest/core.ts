/**
 * Suggested skills for the profile (docs/skill-suggestions.md). Pure: given the skills each of the
 * user's best-matching jobs asks for (from the AI extraction or the rules fallback), finds the
 * ones the profile is missing, ranks them by how many of those jobs ask for them, and estimates
 * how much each would raise the CV's keyword coverage — the part of an ATS score a skill can move.
 * Synonyms are folded through the learning graph aliases (k8s → Kubernetes, JS → JavaScript).
 */
import { resolveSkill } from "@/lib/learning/graph";
import { skillKey } from "@/lib/profile/skills-view";
import { TECH_KEYWORDS, extractTech } from "@/lib/taxonomy";

/** How many of the best-matching jobs are analyzed. */
export const TOP_JOBS = 20;
/** Jobs below this match score are not "correlated" enough to drive suggestions. */
export const MIN_MATCH = 25;
/** A preferred ("nice to have") skill counts this much of a required one in keyword coverage. */
export const PREFERRED_WEIGHT = 0.5;
/** Labels longer than this are sentences, not skills. */
const MAX_LABEL = 40;

/**
 * Spellings the learning graph doesn't know. Keys are skillKey()-normalized; values are the
 * canonical label. Kept small on purpose: the graph aliases cover most of the stack.
 */
export const EXTRA_ALIASES: Record<string, string> = {
  microservices: "Microservices",
  "micro-services": "Microservices",
  "micro services": "Microservices",
  "microservice architecture": "Microservices",
  rest: "REST APIs",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  restful: "REST APIs",
  "restful api": "REST APIs",
  "restful apis": "REST APIs",
  "system design": "System Design",
  "distributed systems": "Distributed Systems",
  oop: "OOP",
  "object oriented programming": "OOP",
  "object-oriented programming": "OOP",
  tdd: "TDD",
  "test driven development": "TDD",
  "unit testing": "Unit Testing",
  "unit tests": "Unit Testing",
  agile: "Agile",
  scrum: "Agile",
  "agile/scrum": "Agile",
  git: "Git",
  github: "Git",
  gitlab: "Git",
  html5: "HTML",
  css3: "CSS",
  sass: "CSS",
  scss: "CSS",
  "web sockets": "WebSockets",
  websocket: "WebSockets",
  websockets: "WebSockets",
  "message queues": "Message Queues",
  "message queue": "Message Queues",
  "data structures": "Data Structures & Algorithms",
  algorithms: "Data Structures & Algorithms",
  "data structures and algorithms": "Data Structures & Algorithms",
};

/** Generic words an LLM sometimes returns that are not skills you can list on a CV. */
const NOT_SKILLS = new Set([
  "english",
  "hebrew",
  "communication",
  "communication skills",
  "teamwork",
  "team player",
  "problem solving",
  "degree",
  "bsc",
  "b.sc",
  "computer science",
  "self motivated",
  "fast learner",
  "experience",
  "programming",
  "software development",
  "coding",
]);

export interface CanonicalSkill {
  /** Stable comparison key: the learning-graph node id when known, else a normalized label. */
  key: string;
  label: string;
  nodeId: string | null;
}

/** Fold a free-text skill to one canonical key + display label. */
export function canonicalSkill(raw: string): CanonicalSkill | null {
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label || label.length > MAX_LABEL) return null;
  const k = skillKey(label);
  if (NOT_SKILLS.has(k)) return null;
  const node = resolveSkill(label) ?? resolveSkill(k.replace(/\.js$/, "")) ?? resolveSkill(k.replace(/\s+/g, ""));
  if (node) return { key: node.id, label: node.label, nodeId: node.id };
  const extra = EXTRA_ALIASES[k];
  if (extra) return { key: skillKey(extra), label: extra, nodeId: null };
  const tech = TECH_KEYWORDS[k];
  if (tech) return { key: skillKey(tech), label: tech, nodeId: null };
  return { key: k.replace(/[\s._-]+/g, ""), label, nodeId: null };
}

export interface JobSkills {
  id: string;
  title: string;
  company: string;
  /** Match score (0..100) from the jobs-page scorer, used to pick the top jobs. */
  score: number;
  required: string[];
  preferred: string[];
}

/** Lines that open a "nice to have" block, or are themselves an advantage line. */
const PREFERRED_HEAD =
  /(nice[\s-]to[\s-]have|advantage|bonus|a plus|is a plus|preferred|desired|would be great|יתרון|יתרונות|רצוי|בונוס)/i;
const REQUIRED_HEAD = /(requirements|qualifications|must have|you have|what you bring|דרישות|דרישות התפקיד|חובה)/i;

/**
 * Rules fallback when AI is off or over its limit: the job's tech stack is required; tech found in
 * the description is required too, unless it sits in a "nice to have / advantage / יתרון" block.
 */
export function heuristicJobSkills(job: { techStack: string[]; description: string }): {
  required: string[];
  preferred: string[];
} {
  const required = new Set(job.techStack);
  const preferred = new Set<string>();
  let inPreferred = false;
  for (const line of job.description.split(/\n|(?<=[.;])\s+/)) {
    const t = line.trim();
    if (!t) continue;
    const head = t.length < 60;
    if (PREFERRED_HEAD.test(t)) {
      if (head && !extractTech(t).length) {
        inPreferred = true;
        continue;
      }
      for (const x of extractTech(t)) preferred.add(x);
      continue;
    }
    if (head && REQUIRED_HEAD.test(t)) inPreferred = false;
    for (const x of extractTech(t)) (inPreferred ? preferred : required).add(x);
  }
  for (const x of required) preferred.delete(x);
  return { required: [...required], preferred: [...preferred] };
}

export type ImpactLevel = "high" | "medium" | "low";

export interface SkillSuggestion extends CanonicalSkill {
  /** Analyzed jobs that ask for it (required or preferred). */
  jobs: number;
  /** Share of the analyzed jobs (0..100). */
  share: number;
  required: number;
  preferred: number;
  /** Up to two jobs that ask for it, best match first. */
  examples: { id: string; title: string; company: string }[];
  /** Average keyword-coverage points gained in the jobs that ask for it (0..100). */
  coverageGain: number;
  /** Keyword-coverage points gained averaged over all analyzed jobs (0..100). */
  overallGain: number;
  impact: ImpactLevel;
  /** Already written in an experience/project tech list, just not in the skills list. */
  inCv: boolean;
}

export interface SuggestionReport {
  analyzed: number;
  suggestions: SkillSuggestion[];
  /** Missing skills hidden because the user dismissed them. */
  dismissed: number;
  /** Average keyword coverage of the analyzed jobs by the current skills (0..100). */
  coverage: number;
}

export function impactLevel(share: number, requiredRatio: number, coverageGain: number): ImpactLevel {
  if ((share >= 40 && requiredRatio >= 0.5) || (share >= 25 && coverageGain >= 15)) return "high";
  if (share >= 20 || (share >= 10 && requiredRatio >= 0.5 && coverageGain >= 10)) return "medium";
  return "low";
}

/** Canonical required/preferred sets for one job (required wins when a skill is in both). */
export function jobKeywordSet(
  job: Pick<JobSkills, "required" | "preferred">,
): Map<string, { c: CanonicalSkill; required: boolean }> {
  const out = new Map<string, { c: CanonicalSkill; required: boolean }>();
  for (const [list, required] of [
    [job.required, true],
    [job.preferred, false],
  ] as const) {
    for (const raw of list) {
      const c = canonicalSkill(raw);
      if (!c) continue;
      const prev = out.get(c.key);
      if (!prev) out.set(c.key, { c, required });
      else if (required && !prev.required) prev.required = true;
    }
  }
  return out;
}

export function suggestSkills(input: {
  skills: string[];
  /** Tech written elsewhere in the CV (experience / projects), not in the skills list. */
  cvTech?: string[];
  jobs: JobSkills[];
  dismissed?: string[];
}): SuggestionReport {
  const keyOf = (s: string) => canonicalSkill(s)?.key;
  const have = new Set(input.skills.map(keyOf).filter((k): k is string => !!k));
  const inCv = new Set((input.cvTech ?? []).map(keyOf).filter((k): k is string => !!k));
  const dismissed = new Set((input.dismissed ?? []).map((d) => keyOf(d) ?? d));
  const jobs = [...input.jobs].sort((a, b) => b.score - a.score);

  type Acc = SkillSuggestion & { gainSum: number };
  const acc = new Map<string, Acc>();
  let coverageSum = 0;
  let withKeywords = 0;
  for (const j of jobs) {
    const kw = jobKeywordSet(j);
    if (!kw.size) continue;
    withKeywords++;
    let total = 0;
    let covered = 0;
    for (const [key, v] of kw) {
      const w = v.required ? 1 : PREFERRED_WEIGHT;
      total += w;
      if (have.has(key)) covered += w;
    }
    coverageSum += covered / total;
    for (const [key, v] of kw) {
      if (have.has(key)) continue;
      let g = acc.get(key);
      if (!g) {
        g = {
          ...v.c,
          jobs: 0,
          share: 0,
          required: 0,
          preferred: 0,
          examples: [],
          coverageGain: 0,
          overallGain: 0,
          impact: "low",
          inCv: inCv.has(key),
          gainSum: 0,
        };
        acc.set(key, g);
      }
      g.jobs++;
      if (v.required) g.required++;
      else g.preferred++;
      g.gainSum += ((v.required ? 1 : PREFERRED_WEIGHT) / total) * 100;
      if (g.examples.length < 2) g.examples.push({ id: j.id, title: j.title, company: j.company });
    }
  }

  const n = jobs.length;
  const all = [...acc.values()].map(({ gainSum, ...g }) => {
    const share = n ? Math.round((g.jobs / n) * 100) : 0;
    const coverageGain = Math.round(gainSum / g.jobs);
    return {
      ...g,
      share,
      coverageGain,
      overallGain: n ? Math.round((gainSum / n) * 10) / 10 : 0,
      impact: impactLevel(share, g.required / g.jobs, coverageGain),
    };
  });
  all.sort(
    (a, b) =>
      b.jobs - a.jobs || b.required - a.required || b.coverageGain - a.coverageGain || a.label.localeCompare(b.label),
  );
  const visible = all.filter((s) => !dismissed.has(s.key));
  return {
    analyzed: n,
    suggestions: visible,
    dismissed: all.length - visible.length,
    coverage: withKeywords ? Math.round((coverageSum / withKeywords) * 100) : 0,
  };
}

/** Order-insensitive fingerprint of the analyzed job set (cache invalidates when it changes). */
export function jobsKey(ids: string[]): string {
  const s = [...ids].sort().join(",");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `${ids.length}:${h.toString(36)}`;
}

/** Calendar day in Israel time, the cache's daily boundary. */
export function israelDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

export interface SuggestCache {
  day: string;
  jobsKey: string;
  source: "ai" | "rules";
  limited: string | null;
  jobs: JobSkills[];
}

/** Reuse the cached extraction only on the same day and for the same jobs. */
export function cacheUsable(cache: SuggestCache | null | undefined, day: string, key: string): cache is SuggestCache {
  return !!cache && cache.day === day && cache.jobsKey === key && Array.isArray(cache.jobs);
}
