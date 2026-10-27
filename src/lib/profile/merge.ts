import type { ExtractedProfile } from "./extract";
import type { Professional, SkillItem } from "./schema";

const key = (...parts: string[]) => parts.map((p) => p.trim().toLowerCase()).join("|");

function uniqBy<T>(items: T[], k: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const kk = k(i);
    if (seen.has(kk)) return false;
    seen.add(kk);
    return true;
  });
}

/**
 * Proposal shown on the review screen: what the user already wrote wins; extraction fills gaps and
 * appends new list entries. For a skill present in both, the extracted years fill a missing value
 * but never override a level the user set.
 */
export function mergeProfessional(current: Professional, x: ExtractedProfile): Professional {
  const skills = new Map<string, SkillItem>();
  for (const s of current.skillItems) skills.set(key(s.name), s);
  for (const s of x.skillItems) {
    const have = skills.get(key(s.name));
    if (!have) skills.set(key(s.name), s);
    else if (have.years == null && s.years != null) skills.set(key(s.name), { ...have, years: s.years });
  }
  return {
    headline: current.headline || x.headline,
    summary: current.summary || x.summary,
    experience: uniqBy([...current.experience, ...x.experience], (e) => key(e.company, e.title)),
    skillItems: [...skills.values()],
    education: uniqBy([...current.education, ...x.education], (e) => key(e.kind, e.institution)),
    languages: uniqBy([...current.languages, ...x.languages], (l) => key(l.name)),
    linkedinUrl: current.linkedinUrl || x.linkedinUrl,
    githubUrl: current.githubUrl || x.githubUrl,
    portfolioUrl: current.portfolioUrl || x.portfolioUrl,
  };
}
