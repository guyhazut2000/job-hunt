import type { AtsProvider, WorkMode } from "@prisma/client";
import { extractTech, htmlToText, inferRoleCategory, inferSeniority, inferWorkMode } from "../taxonomy";
import { deriveJobFields } from "../jobs/classify";
import { normalizeLocation } from "./location";
import type { NormalizedJob, PayPeriodValue, StatedPay } from "./types";

/** Descriptions are shown in full on our page, but we cap storage; the original posting is always linked. */
const MAX_DESCRIPTION = 20_000;

export function buildJob(input: {
  externalId: string | number;
  source: AtsProvider;
  title: string;
  /** Raw location strings from the ATS (first non-empty wins for non-Israeli fallbacks). */
  locations?: (string | null | undefined)[];
  /** @deprecated use `locations` */
  location?: string | null;
  descriptionHtmlOrText: string;
  applyUrl: string;
  postedAt?: string | number | Date | null;
  workModeHint?: string | null;
  /** ATS employment hint, e.g. Lever `categories.commitment` ("Full-time", "Part-time"). */
  commitmentHint?: string | null;
  /** Last-updated timestamp reported by the ATS. */
  updatedAt?: string | number | Date | null;
  /** Department / team name from the ATS. */
  department?: string | null;
  /** Structured pay range from the ATS (validated by `cleanPay`). */
  pay?: StatedPay | null;
}): NormalizedJob | null {
  const title = input.title?.trim();
  if (!title || !input.applyUrl) return null;
  const description = htmlToText(input.descriptionHtmlOrText ?? "").slice(0, MAX_DESCRIPTION);
  const rawLocations = [...(input.locations ?? []), input.location];
  const location = normalizeLocation(...rawLocations);
  const workMode: WorkMode = inferWorkMode(`${input.workModeHint ?? ""} ${rawLocations.join(" ")} ${title}`);
  const posted = input.postedAt ? new Date(input.postedAt) : new Date();
  const postedAt = Number.isNaN(posted.getTime()) ? new Date() : posted;
  const updated = input.updatedAt ? new Date(input.updatedAt) : null;
  return {
    externalId: String(input.externalId),
    source: input.source,
    title,
    roleCategory: inferRoleCategory(title),
    seniority: inferSeniority(title),
    location,
    workMode,
    techStack: extractTech(`${title}\n${description}`),
    description,
    applyUrl: input.applyUrl,
    postedAt,
    ...deriveJobFields(title, { commitment: input.commitmentHint }),
    // ATSs without an update timestamp fall back to the posting date, so "recently updated" never sorts on nulls.
    sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : postedAt,
    department: input.department?.trim().slice(0, 120) || null,
    ...payColumns(cleanPay(input.pay)),
  };
}

function payColumns(pay: StatedPay | null) {
  return {
    payMin: pay?.min ?? null,
    payMax: pay?.max ?? null,
    payCurrency: pay?.currency ?? null,
    payPeriod: pay?.period ?? null,
  };
}

/** Accept a structured range only when it is internally consistent; plausibility is checked by the salary estimator. */
export function cleanPay(pay: StatedPay | null | undefined): StatedPay | null {
  if (!pay) return null;
  let min = Number(pay.min);
  let max = Number(pay.max);
  if (!(min > 0) && max > 0) min = max;
  if (!(max > 0) && min > 0) max = min;
  if (!(min > 0) || !(max > 0)) return null;
  if (min > max) [min, max] = [max, min];
  const currency = String(pay.currency ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { min: Math.round(min), max: Math.round(max), currency, period: pay.period };
}

/** Map ATS interval vocab ("1 YEAR", "per-month-salary", "YEARLY", "hourly"…) to our period. */
export function payPeriodOf(interval: string | null | undefined): PayPeriodValue | null {
  const t = (interval ?? "").toLowerCase();
  if (/hour/.test(t)) return "hour";
  if (/month/.test(t)) return "month";
  if (/year|annual|annum/.test(t)) return "year";
  return null;
}

/** Labels such as "US Base Pay Range" or "Canada (Tier 2)" — the range is for another country's hires. */
const OTHER_COUNTRY =
  /\b(u\.?s\.?a?|united states|america|canada|canadian|u\.?k\.?|united kingdom|britain|europe|eu|emea|apac|latam|germany|france|spain|poland|india|ireland|netherlands|australia|singapore|japan|california|new york|nyc|san francisco|bay area|seattle|boston|texas|colorado|washington|tier\s*\d)\b/i;

export interface PayCandidate extends StatedPay {
  /** The ATS's name for the range, e.g. Greenhouse "US Base Pay Range" / an Ashby tier title. */
  label?: string | null;
}

/**
 * Choose the structured range that applies to an Israeli hire: an ILS range, else one labelled for
 * Israel, else — only when every location of the posting is Israeli — an unlabelled range.
 * A range labelled for another country is never attributed to the Israeli role.
 */
export function pickStatedPay(candidates: PayCandidate[], allLocationsIsraeli: boolean): StatedPay | null {
  const valid = candidates
    .map((c) => ({ c, pay: cleanPay(c) }))
    .filter((x): x is { c: PayCandidate; pay: StatedPay } => x.pay !== null);
  const pick =
    valid.find((x) => x.pay.currency === "ILS") ??
    valid.find((x) => /israel|\bisr\b|ישראל/i.test(x.c.label ?? "")) ??
    (allLocationsIsraeli ? valid.find((x) => !OTHER_COUNTRY.test(x.c.label ?? "")) : undefined);
  return pick?.pay ?? null;
}
