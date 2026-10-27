import type { Profile } from "@prisma/client";
import {
  type Preferences,
  type Professional,
  educationItem,
  experienceItem,
  languageItem,
  parseList,
  skillItem,
} from "./schema";

export function readProfessional(p: Profile | null): Professional {
  return {
    headline: p?.headline ?? "",
    summary: p?.summary ?? "",
    experience: parseList(experienceItem, p?.experience),
    skillItems: parseList(skillItem, p?.skillItems).length
      ? parseList(skillItem, p?.skillItems)
      : (p?.skills ?? []).map((name) => ({ name, level: "GOOD" as const, years: null, category: "other" as const })),
    education: parseList(educationItem, p?.education),
    languages: parseList(languageItem, p?.languages),
    linkedinUrl: p?.linkedinUrl ?? "",
    githubUrl: p?.githubUrl ?? "",
    portfolioUrl: p?.portfolioUrl ?? "",
  };
}

export function readPreferences(p: Profile | null): Preferences {
  return {
    targetRoles: p?.targetRoles.length ? p.targetRoles : p?.desiredRole ? [p.desiredRole] : [],
    targetSeniorities: p?.targetSeniorities.length ? p.targetSeniorities : p?.seniority ? [p.seniority] : [],
    regions: (p?.regions ?? []) as Preferences["regions"],
    workModes: p?.workModes.length ? p.workModes : p?.workMode ? [p.workMode] : [],
    salaryMin: p?.salaryMin ?? null,
    salaryMax: p?.salaryMax ?? null,
    companyTypes: (p?.companyTypes ?? []) as Preferences["companyTypes"],
    wantedTech: p?.wantedTech ?? [],
    avoidTech: p?.avoidTech ?? [],
    availability: p?.availability ?? null,
  };
}
