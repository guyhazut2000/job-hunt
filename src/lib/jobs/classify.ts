import type { EmploymentType, JobLevel } from "@prisma/client";
import { inferRoleCategory, inferSeniority, type RoleCategory } from "../taxonomy";

/**
 * Broad job functions, in the order they are shown in the filter panel.
 * Finer than nothing, coarser than `roleCategory` (which only splits engineering specialisations
 * and lumps every business role into "other").
 */
export const JOB_FUNCTIONS = [
  "engineering",
  "data",
  "devops",
  "qa",
  "security",
  "hardware",
  "product",
  "design",
  "sales",
  "marketing",
  "customer",
  "operations",
  "finance",
  "people",
  "legal",
  "other",
] as const;
export type JobFunction = (typeof JOB_FUNCTIONS)[number];

export const JOB_LEVELS: JobLevel[] = ["INTERN", "ENTRY", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "EXECUTIVE"];
export const EMPLOYMENT_TYPES: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"];

const clean = (title: string) =>
  ` ${title
    .toLowerCase()
    .replace(/office of the (cto|ceo)|\b(cto|ceo)\s+(office|group|team|org|operations)\b/g, " ")
    .replace(/[–—]/g, "-")} `;

/** Engineering work that happens inside a business team ("Engineering Manager, Partnerships"). */
const STRONG_ENGINEERING =
  /engineering manager|\br&d\b|software|\bdeveloper\b(?!\s+(support|relations|advocate|experience))|full[\s-]?stack|back[\s-]?end|front[\s-]?end/;

/** Catch-all postings that are not a real role. */
const NOT_A_ROLE = /general application|open application|talent (network|pool|community)|didn'?t see|spontaneous/;

/** Ordered: the first matching rule wins. Only applied when the title is not clearly an engineering role. */
const BUSINESS_RULES: [JobFunction, RegExp][] = [
  [
    "devops",
    /\bmis\b|\bit (support|manager|specialist|engineer|admin\w*|team|operations)\b|help ?desk|sysadmin|system administrator/,
  ],
  [
    "people",
    /recruit\w*|sourcer|talent acquisition|talent partner|\bhr\b|hrbp|human resources|people (partner|operations|ops|business)|employee experience|\bpeople\b|learning (&|and) development|compensation|benefits/,
  ],
  ["legal", /\blegal\b|counsel|paralegal|attorney|lawyer|privacy officer|compliance/],
  [
    "finance",
    /financ\w*|fp&a|accountant|accounting|bookkeep\w*|controller|payroll|accounts (payable|receivable)|\btax\b|treasury|collections?\b|billing|revenue accountant|audit|investor relations|stock (administration|plan)|equity|(portfolio|credit) risk/,
  ],
  [
    "design",
    /designer|\bux\b|ui\/ux|product design|design (lead|manager|director)|technical artist|\banimator\b|illustrat\w*|motion|creative director|art director|\b3d\b/,
  ],
  [
    "marketing",
    /marketing|growth|\bbrand\b|content (writer|manager|lead|marketing|strategist)|\bseo\b|\bsem\b|\bppc\b|communications|\bpr\b(?!&)|public relations|community|demand gen|campaign|social media|copywriter|events? manager/,
  ],
  ["product", /\bproduct (execution|strategy|operations|associate|analyst|specialist)\b/],
  [
    "operations",
    /business (applications|systems)|salesforce|netsuite|\berp\b|revops|revenue operations|sales operations|\boperations?\b|\bops\b|office (manager|admin\w*)|\badmin\b|administrator|procurement|purchasing|supply chain|logistics|facilities|executive assistant|chief of staff|program manager|project manager|program management|strategy|corporate development|\bm&a\b|chargebacks?|disputes|\behs\b|safety officer/,
  ],
  [
    "customer",
    /customer (success|support|experience|care|service)|\bsupport (engineer|specialist|analyst|manager|lead|team)\b|technical support|support engineer|tier \d|implementation|onboarding (specialist|manager)|professional services|technical account manager|\btam\b|customer solutions|success manager/,
  ],
  [
    "sales",
    /\bsales\b|account executive|account manager|business development|\bbdr\b|\bsdr\b|partnerships?|channel|pre-?sales|solutions? (engineer|architect|consultant)|sales engineer|commercial|deal desk|go-to-market|\bgtm\b|revenue/,
  ],
];

const ROLE_TO_FUNCTION: Record<RoleCategory, JobFunction> = {
  backend: "engineering",
  frontend: "engineering",
  fullstack: "engineering",
  mobile: "engineering",
  devops: "devops",
  data: "data",
  ml: "data",
  qa: "qa",
  security: "security",
  product: "product",
  design: "design",
  hardware: "hardware",
  management: "other",
  other: "other",
};

/** Derive a broad job function from a job title (English or Hebrew-ish ATS titles). */
export function inferJobFunction(title: string): JobFunction {
  const t = clean(title);
  if (NOT_A_ROLE.test(t)) return "other";
  // `inferRoleCategory` already routes business titles (sales, HR, finance…) to "other"; only those
  // (plus generic management/design titles) are split further, so "Billing Platform Engineer" stays engineering.
  const role = inferRoleCategory(title);
  const strongTech = STRONG_ENGINEERING.test(t);
  if (!strongTech && (role === "other" || role === "management" || role === "design")) {
    for (const [fn, re] of BUSINESS_RULES) {
      // "Operations" only when the title isn't a tech ops role (DevOps/SecOps/DataOps/MLOps all fail \bops\b).
      if (fn === "operations" && /security operations|network operations|\bnoc\b|\bsoc\b/.test(t)) continue;
      if (re.test(t)) return fn;
    }
  }
  if (/secops|devsecops/.test(t)) return "security";
  if (/mlops|dataops/.test(t)) return "data";
  if (/release (manager|engineer)/.test(t)) return "devops";
  if (role === "management") {
    if (/engineering|r&d|technolog|software|platform|infrastructure|\bcto\b|software development/.test(t))
      return "engineering";
    if (/\bdata\b|analytics|\bai\b|\bml\b/.test(t)) return "data";
    return "other";
  }
  if (role === "other") {
    if (/engineer|architect|developer|programmer|integrator|\btech lead\b/.test(t)) return "engineering";
    if (/\banalyst\b|scientist|research/.test(t)) return "data";
    if (/\bproduct\b/.test(t)) return "product";
    return "other";
  }
  return ROLE_TO_FUNCTION[role];
}

const EXECUTIVE =
  /\b(vp|svp|evp|vice president|chief|cto|ceo|cfo|coo|cmo|ciso|cpo|cro|cio|president|co-?founder|founder|general manager)\b|סמנכ"ל|מנכ"ל/;
const DIRECTOR = /\b(director|head of|head,|department head)\b|\bhead\b(?! (start|count))/;
const LEAD =
  /\b(team lead|tech lead|technical lead|lead|leader|principal|staff|architect|distinguished)\b|ראש צוות|ר"צ/;
const ENTRY =
  /\b(junior|jr\.?|entry[\s-]level|graduate|new grad|associate)\b(?! (director|vp|general counsel|principal|partner))|ג'וניור|מתחיל/;

/** Derive a job-board style experience level from the title. */
export function inferLevel(title: string): JobLevel {
  const t = clean(title);
  if (/\b(intern|internship|student|working student)\b|סטודנט/.test(t)) return "INTERN";
  if (EXECUTIVE.test(t) && !/\bassistant\b|account executive/.test(t)) return "EXECUTIVE";
  if (DIRECTOR.test(t)) return "DIRECTOR";
  if (inferSeniority(title) === "MANAGER") return "MANAGER";
  if (LEAD.test(t)) return "LEAD";
  if (/\b(senior|sr\.?|expert)\b|בכיר/.test(t)) return "SENIOR";
  if (ENTRY.test(t)) return "ENTRY";
  return "MID";
}

/**
 * Employment type from an ATS hint (Lever `categories.commitment`) and the title.
 * Most Israeli tech postings are full-time and don't say so, hence the default.
 */
export function inferEmploymentType(title: string, hint?: string | null): EmploymentType {
  const h = (hint ?? "").toLowerCase();
  const t = clean(title);
  if (/intern|student/.test(h) || /\b(intern|internship|student)\b|סטודנט/.test(t)) return "INTERNSHIP";
  if (/part[\s-]?time/.test(h) || /part[\s-]?time|משרה חלקית|חצי משרה/.test(t)) return "PART_TIME";
  if (/contract|freelance/.test(h) || /\b(contract|contractor|freelance\w*)\b/.test(t)) return "CONTRACT";
  if (
    /temp|fixed/.test(h) ||
    /\btemporary\b|\btemp\b|maternity|parental leave|leave (cover|replacement)|fixed[\s-]term|\d+\s*(months?|years?)\b.*\)|החלפה/.test(
      t,
    )
  )
    return "TEMPORARY";
  return "FULL_TIME";
}

export interface DerivedJobFields {
  jobFunction: JobFunction;
  level: JobLevel;
  employmentType: EmploymentType;
}

export function deriveJobFields(title: string, hints: { commitment?: string | null } = {}): DerivedJobFields {
  return {
    jobFunction: inferJobFunction(title),
    level: inferLevel(title),
    employmentType: inferEmploymentType(title, hints.commitment),
  };
}
