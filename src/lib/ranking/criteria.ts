import type { EmploymentType, Seniority, WorkMode } from "@prisma/client";
import { regionOf, type Region } from "../profile/schema";
import { SENIORITIES } from "../taxonomy";

/**
 * Job-seeker criteria for the personal ranking (#106). Pure evaluators: each returns 0..100,
 * or null when there is no data / no preference — null criteria are skipped by the weighted
 * average, so missing data never lowers a job ("אין נתון").
 */

export const INDUSTRIES = [
  "fintech",
  "cyber",
  "health",
  "gaming",
  "ai_data",
  "ecommerce",
  "adtech",
  "devtools",
  "hardware",
  "mobility",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

const INDUSTRY_RE: Record<Industry, RegExp> = {
  fintech: /fin ?tech|financ|bank|payment|insur|crypto|trading|lending|פיננס|בנק|ביטוח|תשלומ/i,
  cyber: /cyber|security|סייבר|אבטח/i,
  health: /health|medic|bio|pharma|clinic|רפוא|בריאות/i,
  gaming: /gam(e|ing)|casino|גיימינג|משחק/i,
  ai_data: /\bai\b|artificial|machine learning|\bdata\b|analytics|בינה מלאכותית|דאטה/i,
  ecommerce: /e-?commerce|retail|marketplace|shopping|קמעונ|מסחר/i,
  adtech: /ad ?tech|advertis|marketing|martech|פרסום|שיווק/i,
  devtools: /saas|cloud|developer|devops|infrastructure|enterprise software|ענן|תשתיות/i,
  hardware: /semiconductor|chip|hardware|electronic|silicon|שבב|חומרה|אלקטרוני/i,
  mobility: /automotive|mobility|transport|vehicle|רכב|תחבורה/i,
};

/** Industries a company's free-text industry maps to (empty = unknown). */
export function industriesOf(text: string | null | undefined): Industry[] {
  if (!text?.trim()) return [];
  return INDUSTRIES.filter((k) => INDUSTRY_RE[k].test(text));
}

const SENIORITY_ORDER: readonly Seniority[] = SENIORITIES;

export function seniorityValue(job: Seniority, targets: Seniority[]): number | null {
  if (!targets.length) return null;
  const ji = SENIORITY_ORDER.indexOf(job);
  if (ji < 0) return null;
  const d = Math.min(...targets.map((t) => Math.abs(SENIORITY_ORDER.indexOf(t) - ji)));
  return d === 0 ? 100 : d === 1 ? 50 : 0;
}

/** Expected (monthly ILS) vs the job's top of range; ≥ expected = 100, each 1% short = −3. */
export function salaryValue(expected: number | null, offered: number | null): number | null {
  if (!expected || !offered) return null;
  if (offered >= expected) return 100;
  return Math.max(0, Math.round(100 - ((expected - offered) / expected) * 300));
}

export function locationValue(job: { location: string; workMode: WorkMode }, regions: Region[]): number | null {
  if (!regions.length) return null;
  if (job.workMode === "REMOTE") return 100;
  const r = regionOf(job.location);
  if (!r) return null;
  return regions.includes(r) ? 100 : 0;
}

export function workModeValue(job: WorkMode, wanted: WorkMode[]): number | null {
  if (!wanted.length) return null;
  if (wanted.includes(job)) return 100;
  // Hybrid is half-way between remote and onsite.
  return job === "HYBRID" ? 50 : 0;
}

export function employmentValue(job: EmploymentType, wanted: EmploymentType[]): number | null {
  if (!wanted.length) return null;
  return wanted.includes(job) ? 100 : 0;
}

export function industryValue(company: Industry[], wanted: Industry[]): number | null {
  if (!wanted.length || !company.length) return null;
  return company.some((i) => wanted.includes(i)) ? 100 : 20;
}

export type CompanyType = "startup" | "mid" | "enterprise";
export function companySizeValue(company: CompanyType | null, wanted: CompanyType[]): number | null {
  if (!wanted.length || !company) return null;
  if (wanted.includes(company)) return 100;
  // "mid" is adjacent to both ends.
  return company === "mid" || wanted.includes("mid") ? 50 : 0;
}

/** Tech-stack overlap: skill strength share (0..100) nudged by wanted (+10 each) / avoided (−30 each) tech. */
export function techValue(opts: {
  techStack: string[];
  skillShare: number | null;
  wanted: string[];
  avoid: string[];
}): number | null {
  if (!opts.techStack.length || opts.skillShare === null) return null;
  const tech = new Set(opts.techStack.map((t) => t.trim().toLowerCase()));
  const has = (t: string) => tech.has(t.trim().toLowerCase());
  const v = opts.skillShare + 10 * opts.wanted.filter(has).length - 30 * opts.avoid.filter(has).length;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Default employment types when the user hasn't chosen: everything but internships (unless they target intern roles). */
export function defaultEmployment(targets: Seniority[]): EmploymentType[] {
  const base: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"];
  return targets.includes("INTERN") ? [...base, "INTERNSHIP"] : base;
}
