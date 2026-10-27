import type { Seniority, WorkMode } from "@prisma/client";
import { SENIORITIES } from "../taxonomy";
import {
  type ExperienceItem,
  type Region,
  type SkillItem,
  type SkillLevel,
  experienceItem,
  parseList,
  regionOf,
  skillItem,
  spanYears,
} from "./schema";

export interface Candidate {
  skills: SkillItem[];
  targetRoles: string[];
  targetSeniorities: Seniority[];
  totalYears?: number;
  regions: Region[];
  workModes: WorkMode[];
  wantedTech: string[];
  avoidTech: string[];
}

export interface ScoredJob {
  techStack: string[];
  roleCategory: string;
  seniority: Seniority;
  location: string;
  workMode: WorkMode;
}

/** A translatable reason. `key` maps to dictionary `match.reasons[key]`; params fill {placeholders}. */
export interface Reason {
  tone: "plus" | "minus" | "neutral";
  key:
    | "skills"
    | "skillsNone"
    | "topSkill"
    | "role"
    | "roleRelated"
    | "roleOther"
    | "seniority"
    | "seniorityNear"
    | "seniorityGap"
    | "remote"
    | "region"
    | "regionMismatch"
    | "workModeMismatch"
    | "wantedTech"
    | "avoidTech";
  params?: Record<string, string | number>;
}

export interface MatchResult {
  score: number; // 0..100
  parts: { skills: number; role: number; seniority: number; location: number; bonus: number; penalty: number };
  matchedSkills: string[];
  missingSkills: string[];
  reasons: Reason[];
}

/** Weights are explicit so the UI and tests can reason about them. Sum of max parts = 100. */
export const WEIGHTS = { skills: 50, role: 15, seniority: 20, location: 15 } as const;
export const PENALTY = { workMode: 25, region: 20, avoidTech: 8, avoidTechMax: 16 } as const;

const LEVEL_WEIGHT: Record<SkillLevel, number> = { BASIC: 0.5, GOOD: 0.8, EXPERT: 1 };
const norm = (s: string) => s.trim().toLowerCase();

/** 0..1 strength of a skill: level weighted, nudged up/down by years when known. */
export function skillStrength(s: SkillItem): number {
  const base = LEVEL_WEIGHT[s.level];
  if (s.years == null) return base;
  const yearsFactor = Math.min(1.15, 0.75 + s.years * 0.1); // 0y → .75, 4y+ → 1.15
  return Math.min(1, base * yearsFactor);
}

export function inferSeniorityFromYears(years: number): Seniority {
  if (years < 1.5) return "JUNIOR";
  if (years < 4.5) return "MID";
  if (years < 9) return "SENIOR";
  return "LEAD";
}

const RELATED = [
  ["backend", "fullstack", "devops"],
  ["frontend", "fullstack", "mobile", "design"],
  ["data", "ml", "backend"],
  ["product", "management", "design"],
  ["qa", "devops", "security"],
];
const related = (a: string, b: string) => RELATED.some((g) => g.includes(a) && g.includes(b));

export function scoreMatch(c: Candidate, j: ScoredJob): MatchResult {
  const reasons: Reason[] = [];
  const bySkill = new Map(c.skills.map((s) => [norm(s.name), s]));

  // ── Skills (level + years weighted) ──
  const matched: SkillItem[] = [];
  const missingSkills: string[] = [];
  for (const t of j.techStack) {
    const s = bySkill.get(norm(t));
    if (s) matched.push({ ...s, name: t });
    else missingSkills.push(t);
  }
  let skills: number;
  if (j.techStack.length === 0) skills = Math.round(WEIGHTS.skills / 2);
  else {
    const strength = matched.reduce((a, s) => a + skillStrength(s), 0);
    skills = Math.round((strength / j.techStack.length) * WEIGHTS.skills);
  }
  if (j.techStack.length) {
    if (matched.length) {
      reasons.push({ tone: "plus", key: "skills", params: { n: matched.length, total: j.techStack.length } });
      const top = [...matched].sort((a, b) => skillStrength(b) - skillStrength(a))[0];
      if (top.level === "EXPERT" || (top.years ?? 0) >= 3)
        reasons.push({
          tone: "plus",
          key: "topSkill",
          params: { skill: top.name, years: top.years ?? 0, level: top.level },
        });
    } else reasons.push({ tone: "minus", key: "skillsNone", params: { total: j.techStack.length } });
  }

  // ── Role ──
  let role: number;
  if (!c.targetRoles.length) role = Math.round(WEIGHTS.role / 2);
  else if (c.targetRoles.includes(j.roleCategory)) {
    role = WEIGHTS.role;
    reasons.push({ tone: "plus", key: "role" });
  } else if (c.targetRoles.some((r) => related(r, j.roleCategory))) {
    role = Math.round(WEIGHTS.role / 2);
    reasons.push({ tone: "neutral", key: "roleRelated" });
  } else {
    role = 0;
    reasons.push({ tone: "minus", key: "roleOther" });
  }

  // ── Seniority (explicit targets, else inferred from experience years) ──
  const targets: Seniority[] = c.targetSeniorities.length
    ? c.targetSeniorities
    : c.totalYears != null
      ? [inferSeniorityFromYears(c.totalYears)]
      : [];
  let seniority = Math.round(WEIGHTS.seniority / 2);
  if (targets.length) {
    const ji = SENIORITIES.indexOf(j.seniority);
    const d = Math.min(...targets.map((t) => Math.abs(SENIORITIES.indexOf(t) - ji)));
    seniority = d === 0 ? WEIGHTS.seniority : d === 1 ? Math.round(WEIGHTS.seniority / 2) : 0;
    reasons.push(
      d === 0
        ? { tone: "plus", key: "seniority" }
        : d === 1
          ? { tone: "neutral", key: "seniorityNear" }
          : { tone: "minus", key: "seniorityGap" },
    );
  }

  // ── Location / hard filters (as penalties, so nothing silently disappears from the feed) ──
  let location = Math.round(WEIGHTS.location / 2);
  let penalty = 0;
  const jobRegion = regionOf(j.location);
  if (j.workMode === "REMOTE") {
    location = WEIGHTS.location;
    reasons.push({ tone: "plus", key: "remote" });
  } else if (c.regions.length && jobRegion) {
    if (c.regions.includes(jobRegion)) {
      location = WEIGHTS.location;
      reasons.push({ tone: "plus", key: "region", params: { region: jobRegion } });
    } else {
      location = 0;
      penalty += PENALTY.region;
      reasons.push({ tone: "minus", key: "regionMismatch", params: { region: jobRegion } });
    }
  }
  if (c.workModes.length && !c.workModes.includes(j.workMode)) {
    penalty += PENALTY.workMode;
    reasons.push({ tone: "minus", key: "workModeMismatch", params: { mode: j.workMode } });
  }

  // ── Wanted / unwanted tech ──
  const jobTech = new Set(j.techStack.map(norm));
  const wanted = c.wantedTech.filter((t) => jobTech.has(norm(t)));
  const avoided = c.avoidTech.filter((t) => jobTech.has(norm(t)));
  const bonus = Math.min(5, wanted.length * 3);
  if (wanted.length) reasons.push({ tone: "plus", key: "wantedTech", params: { tech: wanted.join(", ") } });
  if (avoided.length) {
    penalty += Math.min(PENALTY.avoidTechMax, avoided.length * PENALTY.avoidTech);
    reasons.push({ tone: "minus", key: "avoidTech", params: { tech: avoided.join(", ") } });
  }

  const score = Math.max(0, Math.min(100, skills + role + seniority + location + bonus - penalty));
  return {
    score,
    parts: { skills, role, seniority, location, bonus, penalty },
    matchedSkills: matched.map((s) => s.name),
    missingSkills,
    reasons,
  };
}

export function totalExperienceYears(items: ExperienceItem[], now = new Date()): number | undefined {
  const dated = items.filter((e) => e.start);
  if (!dated.length) return undefined;
  return Math.round(dated.reduce((a, e) => a + spanYears(e.start || undefined, e.end || undefined, now), 0) * 10) / 10;
}

/** Shape of the Profile columns the scorer needs (keeps this module free of DB access). */
export interface ProfileLike {
  skills: string[];
  skillItems?: unknown;
  experience?: unknown;
  desiredRole?: string | null;
  seniority?: Seniority | null;
  yearsExperience?: number | null;
  workMode?: WorkMode | null;
  targetRoles?: string[];
  targetSeniorities?: Seniority[];
  regions?: string[];
  workModes?: WorkMode[];
  wantedTech?: string[];
  avoidTech?: string[];
}

/** Build a scoring candidate from a Profile row, falling back to v1 fields for older profiles. */
export function toCandidate(p: ProfileLike): Candidate {
  const items = parseList(skillItem, p.skillItems);
  const known = new Set(items.map((s) => norm(s.name)));
  const legacy: SkillItem[] = p.skills
    .filter((s) => !known.has(norm(s)))
    .map((name) => ({ name, level: "GOOD", years: null, category: "other" }));
  const exp = parseList(experienceItem, p.experience);
  return {
    skills: [...items, ...legacy],
    targetRoles: p.targetRoles?.length ? p.targetRoles : p.desiredRole ? [p.desiredRole] : [],
    targetSeniorities: p.targetSeniorities?.length ? p.targetSeniorities : p.seniority ? [p.seniority] : [],
    totalYears: totalExperienceYears(exp) ?? p.yearsExperience ?? undefined,
    regions: (p.regions ?? []) as Region[],
    workModes: p.workModes?.length ? p.workModes : p.workMode ? [p.workMode] : [],
    wantedTech: p.wantedTech ?? [],
    avoidTech: p.avoidTech ?? [],
  };
}

export function hasScorableProfile(p: ProfileLike | null | undefined): p is ProfileLike {
  if (!p) return false;
  return p.skills.length > 0 || parseList(skillItem, p.skillItems).length > 0;
}
