import type { ContactCategory } from "@prisma/client";

/**
 * Builds people-search *links* only. We never scrape LinkedIn or call any unofficial API —
 * the user opens the search in their own LinkedIn session and picks people themselves.
 */

export const CONTACT_CATEGORIES: ContactCategory[] = ["TEAM_LEAD", "RECRUITER", "PEER", "SENIOR_MGMT", "FOUNDER", "HR"];

/** Role domain → title keywords (English + Hebrew) used to narrow team leads / peers to the right team. */
const DOMAIN: Record<string, { en: string[]; he: string[] }> = {
  backend: { en: ["Backend"], he: ["בקאנד"] },
  frontend: { en: ["Frontend"], he: ["פרונטאנד"] },
  fullstack: { en: ["Full Stack", "Fullstack"], he: ["פולסטאק"] },
  mobile: { en: ["Mobile", "iOS", "Android"], he: ["מובייל"] },
  devops: { en: ["DevOps", "Platform", "SRE"], he: ["דבאופס"] },
  data: { en: ["Data"], he: ["דאטה"] },
  ml: { en: ["Machine Learning", "AI"], he: ["בינה מלאכותית"] },
  qa: { en: ["QA", "Automation"], he: ["בדיקות", "אוטומציה"] },
  security: { en: ["Security", "Cyber"], he: ["סייבר", "אבטחת מידע"] },
  product: { en: ["Product"], he: ["מוצר"] },
  design: { en: ["Design", "UX"], he: ["עיצוב"] },
  hardware: { en: ["Hardware"], he: ["חומרה"] },
};

/** Title keywords per audience. Hebrew acronyms use gershayim (״) so they survive inside quoted phrases. */
const TITLES: Record<ContactCategory, { en: string[]; he: string[] }> = {
  TEAM_LEAD: { en: ["Team Lead", "Engineering Manager", "Tech Lead", "Group Lead"], he: ["ראש צוות", "ראש קבוצה"] },
  RECRUITER: { en: ["Recruiter", "Talent Acquisition", "Sourcer"], he: ["מגייס", "מגייסת", "גיוס"] },
  PEER: { en: ["Engineer", "Developer"], he: ["מפתח", "מפתחת", "מהנדס"] },
  SENIOR_MGMT: {
    en: ["VP R&D", "VP Engineering", "CTO", "Head of R&D", "Director of Engineering"],
    he: ["סמנכ״ל פיתוח", "מנהל פיתוח"],
  },
  FOUNDER: { en: ["CEO", "Founder", "Co-Founder"], he: ["מנכ״ל", "מייסד", "מייסדת"] },
  HR: { en: ["HR", "Human Resources", "People Partner", "HRBP"], he: ["משאבי אנוש"] },
};

/** Categories that should be narrowed by the role's domain. Leadership/recruiting/HR are company-wide. */
export const DOMAIN_SCOPED = new Set<ContactCategory>(["TEAM_LEAD", "PEER"]);

const LEGAL_SUFFIX = /[\s,]+(ltd\.?|inc\.?|llc|corp\.?|corporation|gmbh|plc|technologies|בע"?מ|בע״מ)\.?$/i;

/** "Wix.com Ltd." → "Wix.com" — legal suffixes rarely appear on people's profiles. */
export function cleanCompanyName(name: string): string {
  let n = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  for (let i = 0; i < 3 && LEGAL_SUFFIX.test(n); i++) n = n.replace(LEGAL_SUFFIX, "").trim();
  return n.replace(/["״]/g, "").replace(/\s+/g, " ").trim() || name.trim();
}

const q = (s: string) => `"${s.replace(/"/g, "")}"`;
const anyOf = (terms: string[]) => (terms.length === 1 ? q(terms[0]) : `(${terms.map(q).join(" OR ")})`);

export function titleTerms(category: ContactCategory) {
  const t = TITLES[category];
  return [...t.en, ...t.he];
}

export function domainTerms(roleCategory?: string | null) {
  const d = roleCategory ? DOMAIN[roleCategory] : undefined;
  return d ? [...d.en, ...d.he] : [];
}

/** LinkedIn keyword query, e.g. `"Wix" ("Team Lead" OR "ראש צוות") ("Backend" OR "בקאנד")`. */
export function linkedinKeywords(company: string, category: ContactCategory, roleCategory?: string | null): string {
  const parts = [q(cleanCompanyName(company)), anyOf(titleTerms(category))];
  const domain = DOMAIN_SCOPED.has(category) ? domainTerms(roleCategory) : [];
  if (domain.length) parts.push(anyOf(domain));
  return parts.join(" ");
}

export function linkedinPeopleSearchUrl(company: string, category: ContactCategory, roleCategory?: string | null) {
  const u = new URL("https://www.linkedin.com/search/results/people/");
  u.searchParams.set("keywords", linkedinKeywords(company, category, roleCategory));
  u.searchParams.set("origin", "GLOBAL_SEARCH_HEADER");
  return u.toString();
}

/** Google fallback for people without LinkedIn search access: site:linkedin.com/in "<company>" ("title" OR …). */
export function googleFallbackUrl(company: string, category: ContactCategory, roleCategory?: string | null) {
  const parts = ["site:linkedin.com/in", q(cleanCompanyName(company)), anyOf(titleTerms(category))];
  const domain = DOMAIN_SCOPED.has(category) ? domainTerms(roleCategory) : [];
  if (domain.length) parts.push(anyOf(domain));
  const u = new URL("https://www.google.com/search");
  u.searchParams.set("q", parts.join(" "));
  return u.toString();
}

export interface PeopleLink {
  category: ContactCategory;
  linkedin: string;
  google: string;
}

export function peopleLinks(company: string, roleCategory?: string | null): PeopleLink[] {
  return CONTACT_CATEGORIES.map((category) => ({
    category,
    linkedin: linkedinPeopleSearchUrl(company, category, roleCategory),
    google: googleFallbackUrl(company, category, roleCategory),
  }));
}

/** Only accept profile URLs the user pastes from LinkedIn itself. */
export function isLinkedinProfileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(u.hostname) && /^\/(in|pub|company)\//i.test(u.pathname)
    );
  } catch {
    return false;
  }
}
