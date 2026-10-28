import type { AtsProvider, EmploymentType, JobLevel, Seniority, WorkMode } from "@prisma/client";

export type PayPeriodValue = "month" | "year" | "hour";

/** A pay range the employer published in a structured ATS field (never inferred). */
export interface StatedPay {
  min: number;
  max: number;
  /** ISO 4217, upper-case (ILS, USD, EUR…). */
  currency: string;
  period: PayPeriodValue;
}

/** A job normalized from any ATS into our canonical shape. */
export interface NormalizedJob {
  externalId: string;
  source: AtsProvider;
  title: string;
  roleCategory: string;
  seniority: Seniority;
  location: string;
  workMode: WorkMode;
  techStack: string[];
  description: string;
  applyUrl: string;
  postedAt: Date;
  jobFunction: string;
  /** Professional domain (see `src/lib/jobs/domains.ts`). */
  domain: string;
  level: JobLevel;
  employmentType: EmploymentType;
  sourceUpdatedAt: Date;
  department: string | null;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payPeriod: PayPeriodValue | null;
}

export interface AdapterContext {
  /**
   * Provider-specific board identifier: Greenhouse board token, Lever site ("eu:" prefix for the EU
   * instance), Comeet "uid:token", Ashby org, Workable account, SmartRecruiters company id, Recruitee
   * subdomain, Workday "tenant/wdN/site". See sources.ts.
   */
  boardId: string;
  fetchImpl?: typeof fetch;
}

/**
 * An ATS adapter knows how to fetch a company's public job board and normalize it.
 * Add a new ATS by implementing this interface and registering it in `registry.ts`.
 */
export interface AtsAdapter<Raw = unknown> {
  provider: AtsProvider;
  fetchRaw(ctx: AdapterContext): Promise<Raw[]>;
  /** Whether the raw posting is located in Israel (or remote from Israel). */
  isInIsrael(raw: Raw): boolean;
  normalize(raw: Raw): NormalizedJob | null;
  /**
   * For sources whose list endpoint has no description (Workday, SmartRecruiters): fetch one posting's
   * details. The runner calls it only for postings we have not stored yet, within a per-run budget.
   */
  detail?: {
    externalId(raw: Raw, ctx: AdapterContext): string;
    fetch(raw: Raw, ctx: AdapterContext): Promise<Raw>;
  };
}
