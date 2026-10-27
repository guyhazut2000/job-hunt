import type { Seniority, WorkMode } from "@prisma/client";
import { SENIORITIES } from "../taxonomy";

export interface MatchCandidate {
  skills: string[];
  desiredRole?: string | null; // role category key
  seniority?: Seniority | null;
  location?: string | null;
  workMode?: WorkMode | null;
}

export interface MatchJob {
  techStack: string[];
  roleCategory: string;
  seniority: Seniority;
  location: string;
  workMode: WorkMode;
}

export interface MatchBreakdown {
  score: number; // 0-100
  skills: number; // 0-50
  role: number; // 0-20
  seniority: number; // 0-20
  location: number; // 0-10
  matchedSkills: string[];
  missingSkills: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Explainable, deterministic match score. Runs on every feed render, so it is pure and cheap.
 * An LLM can refine it later (e.g. semantic skill similarity) behind the same output shape.
 */
export function computeMatch(c: MatchCandidate, j: MatchJob): MatchBreakdown {
  const cand = new Set(c.skills.map(norm));
  const jobSkills = j.techStack;
  const matchedSkills = jobSkills.filter((s) => cand.has(norm(s)));
  const missingSkills = jobSkills.filter((s) => !cand.has(norm(s)));
  const skills = jobSkills.length === 0 ? 25 : Math.round((matchedSkills.length / jobSkills.length) * 50);

  const role = !c.desiredRole
    ? 10
    : c.desiredRole === j.roleCategory
      ? 20
      : relatedRole(c.desiredRole, j.roleCategory)
        ? 10
        : 0;

  let seniority = 10;
  if (c.seniority) {
    const d = Math.abs(SENIORITIES.indexOf(c.seniority) - SENIORITIES.indexOf(j.seniority));
    seniority = d === 0 ? 20 : d === 1 ? 12 : 0;
  }

  let location = 5;
  if (j.workMode === "REMOTE") location = 10;
  else if (c.location) location = norm(j.location).includes(norm(c.location)) ? 10 : 2;

  const score = Math.max(0, Math.min(100, skills + role + seniority + location));
  return { score, skills, role, seniority, location, matchedSkills, missingSkills };
}

function relatedRole(a: string, b: string) {
  const groups = [
    ["backend", "fullstack", "devops"],
    ["frontend", "fullstack", "mobile", "design"],
    ["data", "ml", "backend"],
    ["product", "management", "design"],
  ];
  return groups.some((g) => g.includes(a) && g.includes(b));
}
