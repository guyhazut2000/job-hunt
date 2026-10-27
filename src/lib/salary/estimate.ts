import { companyTier, TIER_FACTOR, type CompanyTier } from "./company-tier";
import { salaryFamily, salaryLevel } from "./family";
import { parsePostedSalary, type PostedSalary } from "./parse";
import {
  EXECUTIVE_FACTOR,
  INTERN_FACTOR,
  LEVEL_YEARS,
  REFERENCE,
  REFERENCE_YEAR,
  type SalaryFamily,
  type SalaryLevel,
} from "./reference";
import { percentile, roundTo } from "./stats";

/** k-anonymity threshold: user reports are only used (or shown) once this many exist in a bucket. */
export const MIN_REPORTS = 5;

export type SalaryBasis = "posted" | "reports" | "reference";
export type Confidence = "high" | "medium" | "low";

export interface SalaryBand {
  p25: number;
  median: number;
  p75: number;
}

export type Adjustment =
  | { kind: "tier"; tier: CompanyTier; factor: number }
  | { kind: "intern"; factor: number }
  | { kind: "executive"; factor: number }
  | { kind: "marketReports"; n: number; weight: number }
  | { kind: "companyReports"; n: number; weight: number };

export interface SalaryEstimate extends SalaryBand {
  family: SalaryFamily;
  level: SalaryLevel;
  basis: SalaryBasis;
  confidence: Confidence;
  /** True whenever the numbers are not stated by the employer. */
  isEstimate: boolean;
  adjustments: Adjustment[];
  sourceIds: string[];
  referenceYear: number;
  posted: PostedSalary | null;
  /** A non-ILS range found in the posting (shown as info, not used for the ILS band). */
  postedForeign: PostedSalary | null;
}

/** Aggregates only — never individual reports. */
export interface ReportAggregate {
  n: number;
  values: number[];
}

export interface EstimateInput {
  job: { title: string; roleCategory: string; seniority: string; description?: string | null };
  company: { slug: string; size?: string | null };
  /** Reports for this company × family × level. */
  companyReports?: ReportAggregate | null;
  /** Reports for family × level across all companies. */
  marketReports?: ReportAggregate | null;
  /** Skip title inference (used for company-wide buckets). */
  family?: SalaryFamily;
}

const scale = (b: SalaryBand, f: number): SalaryBand => ({ p25: b.p25 * f, median: b.median * f, p75: b.p75 * f });
const mix = (a: SalaryBand, b: SalaryBand, w: number): SalaryBand => ({
  p25: a.p25 * (1 - w) + b.p25 * w,
  median: a.median * (1 - w) + b.median * w,
  p75: a.p75 * (1 - w) + b.p75 * w,
});

/** Drop obvious trolls before aggregating: outside 0.4×–2.5× of the reference median. */
export function bandFromReports(values: number[], referenceMedian: number): SalaryBand | null {
  const clean = values.filter((v) => v >= referenceMedian * 0.4 && v <= referenceMedian * 2.5);
  if (clean.length < MIN_REPORTS) return null;
  return { p25: percentile(clean, 0.25), median: percentile(clean, 0.5), p75: percentile(clean, 0.75) };
}

export function referenceBand(family: SalaryFamily, level: SalaryLevel): SalaryBand {
  const [p25, median, p75] = REFERENCE[family].bands[level];
  return { p25: p25 * 1000, median: median * 1000, p75: p75 * 1000 };
}

/** Plausibility of a user report vs. the market reference: rejects annual amounts, typos and trolling. */
export function isPlausibleReport(family: SalaryFamily, level: SalaryLevel, monthlyGrossIls: number): boolean {
  const ref = referenceBand(family, level);
  return monthlyGrossIls >= ref.median * 0.3 && monthlyGrossIls <= ref.median * 3;
}

export function estimateSalary(input: EstimateInput): SalaryEstimate {
  const { job, company } = input;
  const family = input.family ?? salaryFamily(job.roleCategory, job.title);
  const { level, extrapolated } = salaryLevel(job.seniority, job.title);
  const ref = REFERENCE[family];
  const adjustments: Adjustment[] = [];

  const parsed = parsePostedSalary(job.description);
  const posted = parsed?.currency === "ILS" ? parsed : null;
  const postedForeign = parsed && parsed.currency !== "ILS" ? parsed : null;

  const base = {
    family,
    level,
    referenceYear: REFERENCE_YEAR,
    posted,
    postedForeign,
  };

  if (posted && posted.monthlyMinIls && posted.monthlyMaxIls) {
    const lo = posted.monthlyMinIls;
    const hi = posted.monthlyMaxIls;
    return {
      ...base,
      p25: lo,
      median: (lo + hi) / 2,
      p75: hi,
      basis: "posted",
      confidence: "high",
      isEstimate: false,
      adjustments,
      sourceIds: ["posting"],
    };
  }

  let band = referenceBand(family, level);
  if (extrapolated === "intern") {
    band = scale(band, INTERN_FACTOR);
    adjustments.push({ kind: "intern", factor: INTERN_FACTOR });
  } else if (extrapolated === "executive") {
    band = scale(band, EXECUTIVE_FACTOR);
    adjustments.push({ kind: "executive", factor: EXECUTIVE_FACTOR });
  }

  const sourceIds = [...ref.sources];
  let basis: SalaryBasis = "reference";

  // 1) market-wide user reports refine the survey band (capped so surveys still dominate).
  const market = input.marketReports ? bandFromReports(input.marketReports.values, band.median) : null;
  if (market && input.marketReports) {
    const n = input.marketReports.n;
    const w = Math.min(0.5, n / (n + 20));
    band = mix(band, market, w);
    adjustments.push({ kind: "marketReports", n, weight: w });
    sourceIds.push("reports");
  }

  // 2) company tier multiplier — only when we have no company-specific reports.
  const company_ = input.companyReports ? bandFromReports(input.companyReports.values, band.median) : null;
  const { tier } = companyTier(company);
  if (!company_ && tier !== "growth") {
    band = scale(band, TIER_FACTOR[tier]);
    adjustments.push({ kind: "tier", tier, factor: TIER_FACTOR[tier] });
  }

  // 3) company-specific reports dominate once there are enough of them.
  if (company_ && input.companyReports) {
    const n = input.companyReports.n;
    const w = Math.min(0.8, n / (n + 5));
    band = mix(band, company_, w);
    adjustments.push({ kind: "companyReports", n, weight: w });
    basis = "reports";
    if (!sourceIds.includes("reports")) sourceIds.push("reports");
  }

  let confidence: Confidence = ref.coverage === "good" ? "medium" : "low";
  if (extrapolated) confidence = "low";
  if (basis === "reports" && (input.companyReports?.n ?? 0) >= 15) confidence = "high";
  else if (basis === "reports") confidence = "medium";

  return {
    ...base,
    p25: roundTo(band.p25, 500),
    median: roundTo(band.median, 500),
    p75: roundTo(band.p75, 500),
    basis,
    confidence,
    isEstimate: true,
    adjustments,
    sourceIds,
  };
}

/* ───────────────────────── "what to ask for" ───────────────────────── */

export interface AskProfile {
  yearsExperience?: number | null;
  seniority?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

export interface AskGuidance {
  /** Suggested opening ask range (gross monthly ILS). */
  askLow: number;
  askHigh: number;
  /** Where the profile sits inside this band. */
  position: "below" | "lower" | "middle" | "upper" | "above" | "unknown";
  /** How the profile's own expectation compares to the band. */
  expectation: "underselling" | "aligned" | "stretch" | "aboveBand" | null;
  /** Level mismatch between the job and the profile (e.g. senior applying to junior role). */
  levelGap: number;
}

const LEVEL_ORDER: Record<string, number> = { INTERN: 0, JUNIOR: 1, MID: 2, SENIOR: 3, LEAD: 4, MANAGER: 5 };

/**
 * Place the profile in the band by years of experience relative to the level's typical span, then
 * suggest an opening ask a little above that point (people are usually negotiated down ~5–10%).
 */
export function askFor(est: SalaryBand & { level: SalaryLevel }, profile: AskProfile | null): AskGuidance {
  const span = est.p75 - est.p25;
  let t: number | null = null;
  let position: AskGuidance["position"] = "unknown";
  const years = profile?.yearsExperience;
  if (years != null) {
    const [lo, hi] = LEVEL_YEARS[est.level];
    t = (years - lo) / Math.max(1, hi - lo);
    position = t < -0.15 ? "below" : t < 0.34 ? "lower" : t < 0.67 ? "middle" : t <= 1.15 ? "upper" : "above";
    t = Math.min(1.15, Math.max(-0.1, t));
  }
  const anchor = t == null ? est.median : est.p25 + span * t;
  const askLow = roundTo(Math.max(est.p25, anchor * 1.03), 500);
  const askHigh = Math.max(askLow + 1000, Math.floor(Math.min(est.p75 * 1.1, anchor * 1.1) / 500) * 500);

  let expectation: AskGuidance["expectation"] = null;
  const want = profile?.salaryMin ?? null;
  if (want && want > 0) {
    if (want < est.p25) expectation = "underselling";
    else if (want <= est.p75) expectation = "aligned";
    else if (want <= est.p75 * 1.15) expectation = "stretch";
    else expectation = "aboveBand";
  }

  const levelGap =
    profile?.seniority && profile.seniority in LEVEL_ORDER
      ? LEVEL_ORDER[profile.seniority] - LEVEL_ORDER[est.level]
      : 0;

  return { askLow, askHigh, position, expectation, levelGap };
}

/** "₪32–42K" (whole thousands, compact). */
export function formatBandK(b: { p25: number; p75: number }): string {
  const lo = Math.round(b.p25 / 1000);
  const hi = Math.round(b.p75 / 1000);
  return lo === hi ? `₪${lo}K` : `₪${lo}–${hi}K`;
}

export function formatIls(v: number, locale: string): string {
  return `₪${Math.round(v).toLocaleString(locale === "he" ? "he-IL" : "en-GB")}`;
}
