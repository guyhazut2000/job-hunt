import type { CommuteMode } from "@/lib/commute/keys";
import type { CommuteResult } from "@/lib/commute/types";
import type { Reason } from "@/lib/profile/score";

/**
 * Tool outputs shared by the server (tools) and the client (cards). Pure types only, so client
 * components can import them. Dates are ISO strings: outputs are persisted as JSON and streamed.
 */

/** Everything `JobCard` reads, minus the description (never sent to the client or the model). */
export interface ChatJobCard {
  id: string;
  title: string;
  location: string;
  workMode: string;
  seniority: string;
  level: string;
  domain: string;
  roleCategory: string;
  techStack: string[];
  postedAt: string;
  applyUrl: string;
  linkedinUrl: string | null;
  linkedinCheckedAt: string | null;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  employmentType: string;
  department: string | null;
  company: {
    id: string;
    slug: string;
    name: string;
    industry: string | null;
    size: string | null;
    website: string | null;
  };
  score?: number;
  commute?: CommuteResult;
  /** Fastest commute in minutes for the requested mode (or any mode). */
  commuteMinutes?: number | null;
}

export interface SearchJobsOutput {
  kind: "jobs";
  total: number;
  shown: number;
  jobs: ChatJobCard[];
  /** Same search on /jobs (filters + commute), for "see all". */
  href: string;
  /** What was actually applied, echoed back so the reply can be honest about it. */
  applied: {
    q?: string;
    domain?: string[];
    city?: string;
    level?: string[];
    workMode?: string[];
    company?: string[];
    commute?: { mode?: CommuteMode; maxMinutes: number; from: string; estimated: boolean };
  };
  /** Commute asked for but no origin: the reply should ask for a city or a saved place. */
  needsOrigin?: boolean;
  unknownCompany?: string;
}

export interface ExplainMatchOutput {
  kind: "match";
  error?: "no_profile" | "not_found";
  job?: ChatJobCard;
  score?: number;
  parts?: Record<string, number>;
  reasons?: Reason[];
  /** Reasons already rendered in the chat language (for the model). */
  reasonText?: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  /** Ordered learning plan for the missing skills (first steps), with links to /learn. */
  plan?: { skill: string; href: string; hours: number; gain: number; prerequisite: boolean }[];
  scoreAfterPlan?: number;
  unmappedSkills?: string[];
  profile?: { roles: string[]; seniorities: string[]; years?: number; skills: string[] };
}

export interface HiringStageCard {
  kind: string;
  title: string;
  duration: string | null;
  sourceUrl: string | null;
}

export interface CompanyInfoOutput {
  kind: "company";
  error?: "not_found";
  query?: string;
  company?: {
    id: string;
    slug: string;
    name: string;
    website: string | null;
    careersUrl: string | null;
    industry: string | null;
    size: string | null;
    hqLocation: string | null;
    linkedinUrl: string | null;
  };
  domains?: { domain: string; count: number }[];
  locations?: string[];
  activeJobs?: number;
  topJobs?: ChatJobCard[];
  commute?: { from: string; minutes: Partial<Record<CommuteMode, number | null>>; estimated: boolean } | null;
  hiring?: {
    status: "found" | "none" | "unknown";
    scope?: "job" | "company";
    confidence?: string;
    duration?: string | null;
    stages: HiringStageCard[];
    sources: { url: string; title: string }[];
    checkedAt?: string;
    mine: boolean;
  };
  community?: { id: string; site: string; url: string }[];
  /** Other companies that matched an ambiguous name. */
  alternatives?: { slug: string; name: string }[];
}

export type ChatToolOutput = SearchJobsOutput | ExplainMatchOutput | CompanyInfoOutput;
