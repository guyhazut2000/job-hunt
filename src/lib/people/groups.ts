import type { ContactCategory, PeopleGroup } from "@prisma/client";
import { cleanCompanyName, domainTerms } from "@/lib/outreach/links";

/** Display order of the group chips. */
export const PEOPLE_GROUPS: PeopleGroup[] = ["RECRUITER", "TEAM_LEAD", "ENGINEER", "MANAGER", "SENIOR_MGMT", "FOUNDER"];

export const isPeopleGroup = (v: unknown): v is PeopleGroup => PEOPLE_GROUPS.includes(v as PeopleGroup);

/** Each search group reuses an existing outreach audience for its message templates and saved contacts. */
export const GROUP_CATEGORY: Record<PeopleGroup, ContactCategory> = {
  RECRUITER: "RECRUITER",
  TEAM_LEAD: "TEAM_LEAD",
  ENGINEER: "PEER",
  MANAGER: "TEAM_LEAD",
  SENIOR_MGMT: "SENIOR_MGMT",
  FOUNDER: "FOUNDER",
};

/** Title keywords per group (English + Hebrew). Matched against the result title/snippet as well. */
export const GROUP_TERMS: Record<PeopleGroup, string[]> = {
  RECRUITER: ["recruiter", "talent acquisition", "sourcer", "recruitment", "מגייס", "מגייסת", "גיוס"],
  TEAM_LEAD: ["team lead", "tech lead", "group lead", "team leader", "ראש צוות", "ראש קבוצה"],
  ENGINEER: ["engineer", "developer", "מפתח", "מפתחת", "מהנדס", "מהנדסת"],
  MANAGER: ["engineering manager", "r&d manager", "development manager", "director", "מנהל פיתוח", "מנהלת פיתוח"],
  SENIOR_MGMT: ["vp", "cto", "head of", "chief", "סמנכ״ל", 'סמנכ"ל'],
  FOUNDER: ["ceo", "founder", "co-founder", "cofounder", "מנכ״ל", 'מנכ"ל', "מייסד", "מייסדת"],
};

/** Groups whose query is narrowed by the job's domain (e.g. Backend). */
const DOMAIN_GROUPS = new Set<PeopleGroup>(["TEAM_LEAD", "ENGINEER", "MANAGER"]);

const quote = (s: string) => `"${s.replace(/["״]/g, "")}"`;
const term = (s: string) => (/\s|&|-/.test(s) || /[^\x00-\x7F]/.test(s) ? quote(s) : s);
const anyOf = (xs: string[]) => (xs.length === 1 ? term(xs[0]) : `(${xs.map(term).join(" OR ")})`);

/** Query terms actually sent (a shorter list than GROUP_TERMS keeps Brave's query parser happy). */
const QUERY_TERMS: Record<PeopleGroup, string[]> = {
  RECRUITER: ["recruiter", "talent acquisition", "sourcer", "מגייסת", "מגייס"],
  TEAM_LEAD: ["team lead", "tech lead", "group lead", "ראש צוות"],
  ENGINEER: ["engineer", "developer", "מפתח", "מהנדס"],
  MANAGER: ["engineering manager", "R&D manager", "director", "מנהל פיתוח"],
  SENIOR_MGMT: ["VP", "CTO", "head of", "סמנכ״ל"],
  FOUNDER: ["CEO", "founder", "co-founder", "מנכ״ל"],
};

/**
 * Brave web-search query, e.g. `site:linkedin.com/in "Wiz" (recruiter OR "talent acquisition") Israel`.
 * Only public search-engine results — LinkedIn itself is never fetched.
 */
export function buildPeopleQuery(company: string, group: PeopleGroup, roleCategory?: string | null): string {
  const parts = ["site:linkedin.com/in", quote(cleanCompanyName(company)), anyOf(QUERY_TERMS[group])];
  const domain = DOMAIN_GROUPS.has(group) ? domainTerms(roleCategory) : [];
  if (domain.length) parts.push(anyOf(domain));
  parts.push("Israel");
  return parts.join(" ");
}
