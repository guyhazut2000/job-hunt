/**
 * Curated market reference bands for Israeli hi-tech — gross monthly BASE salary in ILS
 * (excludes equity, bonus, commission, car and pension/keren-hishtalmut contributions).
 *
 * These are NOT copied from any single table. Each cell is our own synthesis of several publicly
 * published 2026 salary surveys by Israeli placement firms (ranges per role × years of experience),
 * sanity-checked against the official CBS average wage for the high-tech sector. Where the surveys
 * disagree we take the overlap and widen p25/p75 to cover it. See docs/salary.md for the method.
 *
 * Review at least once a year (surveys are republished every spring) and bump `REFERENCE_YEAR`.
 */

export const REFERENCE_YEAR = 2026;

export interface SalarySource {
  id: string;
  name: string;
  nameHe: string;
  url: string;
  /** What we use it for. */
  role: "survey" | "official" | "posting" | "community";
  published: string;
}

export const SALARY_SOURCES: Record<string, SalarySource> = {
  sqlink: {
    id: "sqlink",
    name: "SQLink hi-tech salary tables 2026",
    nameHe: "טבלאות השכר של SQLink ל-2026",
    url: "https://www.sqlink.com/salary/",
    role: "survey",
    published: "2026-04",
  },
  techjob: {
    id: "techjob",
    name: "TechJob 2026 hi-tech salary survey (software)",
    nameHe: "סקר השכר של TechJob ל-2026 (תוכנה)",
    url: "https://www.techjob.co.il/salary-survey/software",
    role: "survey",
    published: "2026",
  },
  alljobs: {
    id: "alljobs",
    name: "AllJobs 2026 salary tables",
    nameHe: "טבלאות השכר של AllJobs ל-2026",
    url: "https://www.alljobs.co.il/User/SalaryCompound/SalarySurvey.aspx",
    role: "survey",
    published: "2026",
  },
  jobinfo: {
    id: "jobinfo",
    name: "JobInfo 2026 hi-tech salary tables",
    nameHe: "טבלאות השכר של ג'ובאינפו ל-2026",
    url: "https://www.jobinfo.co.il/%D7%98%D7%91%D7%9C%D7%90%D7%95%D7%AA-%D7%A9%D7%9B%D7%A8.aspx",
    role: "survey",
    published: "2026",
  },
  cbs: {
    id: "cbs",
    name: "Israel CBS — average wage per employee job, high-tech sector (Jul 2026: ₪34,301)",
    nameHe: 'הלמ"ס — שכר ממוצע למשרת שכיר בתחום ההייטק (יולי 2026: ‎₪34,301)',
    url: "https://www.cbs.gov.il/he/mediarelease/DocLib/2026/275/26_26_275b.pdf",
    role: "official",
    published: "2026-10",
  },
};

/** Salary family: finer than roleCategory for business roles, coarser than a job title. */
export const SALARY_FAMILIES = [
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "devops",
  "data",
  "ml",
  "qa",
  "qa_automation",
  "security",
  "hardware",
  "product",
  "design",
  "eng_management",
  "sales",
  "marketing",
  "customer",
  "operations",
  "finance",
  "people",
  "legal",
  "other",
] as const;
export type SalaryFamily = (typeof SALARY_FAMILIES)[number];

/** Levels the reference table is keyed on. Surveys use 0–2 / 3–5 / 6+ years / team lead / manager. */
export const SALARY_LEVELS = ["JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"] as const;
export type SalaryLevel = (typeof SALARY_LEVELS)[number];

/** Typical years of experience per level — used for "what to ask for" positioning. */
export const LEVEL_YEARS: Record<SalaryLevel, [number, number]> = {
  JUNIOR: [0, 2],
  MID: [3, 5],
  SENIOR: [6, 10],
  LEAD: [7, 12],
  MANAGER: [8, 15],
};

/** [p25, median, p75] in thousands of ILS / month. */
type Triple = [number, number, number];
type Row = Record<SalaryLevel, Triple>;

export interface ReferenceRow {
  bands: Row;
  sources: string[];
  /** Business roles are covered more thinly by the surveys → lower confidence. */
  coverage: "good" | "thin";
}

const tech = (bands: Row, sources = ["sqlink", "techjob", "alljobs", "cbs"]): ReferenceRow => ({
  bands,
  sources,
  coverage: "good",
});
const biz = (bands: Row, sources = ["sqlink", "jobinfo", "alljobs", "cbs"]): ReferenceRow => ({
  bands,
  sources,
  coverage: "thin",
});

// prettier-ignore
export const REFERENCE: Record<SalaryFamily, ReferenceRow> = {
  backend: tech({ JUNIOR: [18, 21, 25], MID: [26, 31, 36], SENIOR: [33, 38, 44], LEAD: [38, 44, 50], MANAGER: [42, 48, 56] }),
  frontend: tech({ JUNIOR: [16, 19, 23], MID: [24, 28, 33], SENIOR: [30, 35, 40], LEAD: [34, 39, 45], MANAGER: [38, 44, 50] }),
  fullstack: tech({ JUNIOR: [17, 20, 24], MID: [25, 30, 35], SENIOR: [31, 36, 42], LEAD: [36, 41, 47], MANAGER: [40, 46, 52] }),
  mobile: tech({ JUNIOR: [18, 21, 25], MID: [26, 30, 35], SENIOR: [32, 37, 42], LEAD: [36, 41, 46], MANAGER: [40, 45, 52] }),
  devops: tech({ JUNIOR: [18, 22, 25], MID: [26, 30, 35], SENIOR: [32, 37, 42], LEAD: [36, 41, 46], MANAGER: [40, 45, 52] }, ["sqlink", "alljobs", "cbs"]),
  data: tech({ JUNIOR: [15, 18, 22], MID: [22, 26, 31], SENIOR: [28, 33, 38], LEAD: [32, 37, 43], MANAGER: [36, 42, 48] }, ["sqlink", "alljobs", "cbs"]),
  ml: tech({ JUNIOR: [22, 26, 30], MID: [30, 35, 40], SENIOR: [36, 42, 48], LEAD: [40, 46, 53], MANAGER: [45, 52, 60] }, ["sqlink", "techjob", "alljobs", "cbs"]),
  qa: tech({ JUNIOR: [11, 14, 17], MID: [16, 20, 25], SENIOR: [22, 26, 31], LEAD: [26, 30, 35], MANAGER: [28, 33, 38] }, ["sqlink", "alljobs", "cbs"]),
  qa_automation: tech({ JUNIOR: [18, 21, 25], MID: [24, 28, 32], SENIOR: [29, 33, 37], LEAD: [32, 36, 40], MANAGER: [34, 38, 43] }, ["sqlink", "cbs"]),
  security: tech({ JUNIOR: [18, 22, 26], MID: [26, 31, 37], SENIOR: [34, 40, 47], LEAD: [40, 46, 54], MANAGER: [45, 53, 62] }, ["sqlink", "alljobs", "cbs"]),
  hardware: tech({ JUNIOR: [17, 20, 24], MID: [23, 27, 31], SENIOR: [28, 33, 38], LEAD: [32, 37, 42], MANAGER: [35, 40, 46] }, ["sqlink", "alljobs", "cbs"]),
  product: tech({ JUNIOR: [20, 24, 28], MID: [27, 32, 37], SENIOR: [34, 39, 45], LEAD: [38, 43, 49], MANAGER: [42, 48, 56] }, ["sqlink", "alljobs", "cbs"]),
  design: biz({ JUNIOR: [13, 16, 20], MID: [19, 23, 28], SENIOR: [25, 30, 35], LEAD: [28, 33, 38], MANAGER: [32, 37, 43] }),
  eng_management: tech({ JUNIOR: [38, 44, 50], MID: [38, 44, 50], SENIOR: [40, 46, 52], LEAD: [42, 47, 53], MANAGER: [45, 52, 60] }, ["sqlink", "alljobs", "cbs"]),
  sales: biz({ JUNIOR: [13, 17, 22], MID: [18, 23, 29], SENIOR: [24, 30, 38], LEAD: [28, 35, 43], MANAGER: [32, 40, 50] }),
  marketing: biz({ JUNIOR: [12, 15, 19], MID: [17, 21, 26], SENIOR: [22, 27, 33], LEAD: [26, 31, 37], MANAGER: [30, 36, 43] }),
  customer: biz({ JUNIOR: [10, 13, 17], MID: [15, 19, 24], SENIOR: [20, 25, 30], LEAD: [24, 28, 34], MANAGER: [27, 32, 38] }),
  operations: biz({ JUNIOR: [11, 14, 18], MID: [16, 20, 25], SENIOR: [21, 26, 31], LEAD: [25, 30, 35], MANAGER: [28, 34, 40] }),
  finance: biz({ JUNIOR: [12, 15, 19], MID: [17, 22, 27], SENIOR: [23, 28, 34], LEAD: [27, 32, 38], MANAGER: [32, 38, 46] }),
  people: biz({ JUNIOR: [11, 14, 17], MID: [15, 19, 24], SENIOR: [20, 25, 30], LEAD: [24, 28, 33], MANAGER: [27, 32, 38] }),
  legal: biz({ JUNIOR: [15, 19, 24], MID: [22, 27, 33], SENIOR: [29, 35, 42], LEAD: [34, 40, 47], MANAGER: [38, 45, 55] }),
  other: biz({ JUNIOR: [12, 16, 20], MID: [18, 23, 28], SENIOR: [24, 29, 35], LEAD: [28, 33, 39], MANAGER: [32, 38, 45] }),
};

/** Multipliers for levels outside the surveyed range (applied to the nearest surveyed level). */
export const INTERN_FACTOR = 0.6; // full-time-equivalent of a student position, relative to JUNIOR
export const EXECUTIVE_FACTOR = 1.3; // director / VP / head-of, relative to MANAGER
