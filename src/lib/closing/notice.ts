/**
 * Notice period on resignation (חוק הודעה מוקדמת לפיטורים ולהתפטרות, התשס"א-2001).
 * Section 5 applies the same periods to an employee who resigns as sections 3–4 set for dismissal.
 *  - Monthly salary (סעיף 3): months 1–6 → 1 day per month; month 7 to the end of year 1 → 6 days + 2.5 days per
 *    month after the sixth; from year 2 → one month.
 *  - Hourly/daily pay (סעיף 4): year 1 → 1 day per month; year 2 → 14 days + 1 day per 2 months of that year;
 *    year 3 → 21 days + 1 day per 2 months of that year; from year 4 → one month.
 * Days are calendar days. A contract may set a longer period; the longer one is used.
 * Sources: https://fs.knesset.gov.il/15/law/15_lsr_300368.pdf · https://www.kolzchut.org.il/he/הודעה_מוקדמת_להתפטרות
 * Pure — no DB, no clock (pass dates in). Dates are treated as calendar days (UTC midnight).
 */

export type PayBasis = "monthly" | "hourly";

export interface NoticeResult {
  /** Completed months of employment on the notice date. */
  months: number;
  /** Legal minimum: a number of days, or "one month". */
  legal: { kind: "days"; days: number } | { kind: "month" };
  /** Contract period in days, when given and longer than the legal one. */
  contractDays: number | null;
  /** Which rule decided the end date. */
  basis: "legal" | "contract";
  /** Last day of the notice period (YYYY-MM-DD). */
  endDate: string;
}

const DAY = 86_400_000;

/** Parse YYYY-MM-DD to a UTC-midnight Date (null when invalid). */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

/** Same day next month(s); clamps to the month's last day (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/** Completed calendar months between two dates (start inclusive). */
export function completedMonths(start: Date, on: Date): number {
  if (on <= start) return 0;
  let months = (on.getUTCFullYear() - start.getUTCFullYear()) * 12 + (on.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, months) > on) months--;
  return Math.max(0, months);
}

/** Legal minimum notice for `months` completed months of employment. */
export function legalNotice(months: number, basis: PayBasis): NoticeResult["legal"] {
  const m = Math.max(0, Math.floor(months));
  if (basis === "monthly") {
    if (m >= 12) return { kind: "month" };
    if (m <= 6) return { kind: "days", days: m };
    return { kind: "days", days: 6 + 2.5 * (m - 6) };
  }
  if (m >= 36) return { kind: "month" };
  if (m < 12) return { kind: "days", days: m };
  if (m < 24) return { kind: "days", days: 14 + Math.floor((m - 12) / 2) };
  return { kind: "days", days: 21 + Math.floor((m - 24) / 2) };
}

/**
 * Notice period when resigning on `noticeDate` after starting on `startDate`.
 * The notice period starts the day after the notice is given, so the end date is noticeDate + period.
 */
export function noticePeriod(input: {
  startDate: Date;
  noticeDate: Date;
  basis: PayBasis;
  contractDays?: number | null;
}): NoticeResult {
  const months = completedMonths(input.startDate, input.noticeDate);
  const legal = legalNotice(months, input.basis);
  const legalEnd =
    legal.kind === "month" ? addMonths(input.noticeDate, 1) : addDays(input.noticeDate, Math.ceil(legal.days));
  const cd = input.contractDays && input.contractDays > 0 ? Math.min(365, Math.round(input.contractDays)) : null;
  const contractEnd = cd ? addDays(input.noticeDate, cd) : null;
  const useContract = !!contractEnd && contractEnd > legalEnd;
  return {
    months,
    legal,
    contractDays: useContract ? cd : null,
    basis: useContract ? "contract" : "legal",
    endDate: isoDay(useContract && contractEnd ? contractEnd : legalEnd),
  };
}

/**
 * Latest day to hand in the notice so the period ends before `newStart` (the last day at the old job is the
 * day before the new start). Iterates because the period itself depends on seniority at the notice date.
 */
export function latestNoticeDate(input: {
  startDate: Date;
  newStart: Date;
  basis: PayBasis;
  contractDays?: number | null;
}): string | null {
  const lastDay = addDays(input.newStart, -1);
  for (let back = 0; back <= 400; back++) {
    const d = addDays(lastDay, -back);
    if (d < input.startDate) return null;
    const r = noticePeriod({ ...input, noticeDate: d });
    if (r.endDate <= isoDay(lastDay)) return isoDay(d);
  }
  return null;
}
