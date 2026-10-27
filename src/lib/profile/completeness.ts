import { educationItem, experienceItem, languageItem, parseList, skillItem } from "./schema";

export type CompletenessKey =
  | "cv"
  | "headline"
  | "summary"
  | "experience"
  | "skills"
  | "skillDepth"
  | "education"
  | "languages"
  | "links"
  | "roles"
  | "location"
  | "availability";

export interface CompletenessInput {
  hasCv: boolean;
  profile: {
    headline?: string | null;
    summary?: string | null;
    experience?: unknown;
    skillItems?: unknown;
    skills?: string[];
    education?: unknown;
    languages?: unknown;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
    targetRoles?: string[];
    targetSeniorities?: string[];
    regions?: string[];
    workModes?: string[];
    availability?: string | null;
  } | null;
}

/** Weighted checklist; weights sum to 100. Each item links to the tab that fixes it. */
const ITEMS: { key: CompletenessKey; weight: number; tab: "pro" | "prefs" | "cvs" }[] = [
  { key: "cv", weight: 15, tab: "cvs" },
  { key: "headline", weight: 8, tab: "pro" },
  { key: "summary", weight: 7, tab: "pro" },
  { key: "experience", weight: 15, tab: "pro" },
  { key: "skills", weight: 12, tab: "pro" },
  { key: "skillDepth", weight: 8, tab: "pro" },
  { key: "education", weight: 7, tab: "pro" },
  { key: "languages", weight: 4, tab: "pro" },
  { key: "links", weight: 4, tab: "pro" },
  { key: "roles", weight: 10, tab: "prefs" },
  { key: "location", weight: 6, tab: "prefs" },
  { key: "availability", weight: 4, tab: "prefs" },
];

export function computeCompleteness({ hasCv, profile: p }: CompletenessInput) {
  const skills = parseList(skillItem, p?.skillItems);
  const done: Record<CompletenessKey, boolean> = {
    cv: hasCv,
    headline: !!p?.headline?.trim(),
    summary: (p?.summary?.trim().length ?? 0) >= 40,
    experience: parseList(experienceItem, p?.experience).length > 0,
    skills: skills.length >= 3 || (p?.skills?.length ?? 0) >= 3,
    skillDepth: skills.length > 0 && skills.filter((s) => s.years != null).length >= Math.ceil(skills.length / 2),
    education: parseList(educationItem, p?.education).length > 0,
    languages: parseList(languageItem, p?.languages).length > 0,
    links: !!(p?.linkedinUrl || p?.githubUrl || p?.portfolioUrl),
    roles: (p?.targetRoles?.length ?? 0) > 0 && (p?.targetSeniorities?.length ?? 0) > 0,
    location: (p?.regions?.length ?? 0) > 0 || (p?.workModes?.length ?? 0) > 0,
    availability: !!p?.availability,
  };
  const percent = ITEMS.reduce((a, i) => a + (done[i.key] ? i.weight : 0), 0);
  return { percent, missing: ITEMS.filter((i) => !done[i.key]), done };
}
