/**
 * Parse a salary range stated in a job description ("₪30K–40K", "30,000-38,000 ש״ח ברוטו",
 * "$150,000 - $190,000 USD per year", "45-60 ₪ לשעה"). Pay transparency is not mandated in Israel so
 * most Israeli postings have none — when one exists it beats any estimate.
 *
 * Conservative by design: a match needs an explicit currency AND salary context (a salary keyword
 * nearby or a pay period), and the result must be a plausible monthly wage, so funding rounds,
 * revenue figures or headcounts are not mistaken for pay.
 */

export type Currency = "ILS" | "USD" | "EUR" | "GBP";
export type PayPeriod = "month" | "year" | "hour";

export interface PostedSalary {
  min: number;
  max: number;
  currency: Currency;
  period: PayPeriod;
  /** Gross monthly ILS — only set when currency is ILS. */
  monthlyMinIls: number | null;
  monthlyMaxIls: number | null;
  raw: string;
}

/** Monthly-equivalent hours for a full-time Israeli position (42h week × 52 / 12 ≈ 182). */
export const HOURS_PER_MONTH = 182;
const MONTHLY_BOUNDS_ILS: [number, number] = [6_000, 150_000];
/** Rough plausibility bounds in the posting's own currency, per month. */
const MONTHLY_BOUNDS_FOREIGN: [number, number] = [1_500, 60_000];

const CUR = String.raw`(₪|ש["״׳']?ח|שקלים|nis|ils|usd|us\$|\$|eur|€|gbp|£)`;
const NUM = String.raw`(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)\s*(k|K|אלף|א['׳])?`;
const DASH = String.raw`\s*(?:-|–|—|to|עד|ל-)\s*`;
const RANGE = new RegExp(String.raw`${CUR}?\s*${NUM}\s*${CUR}?${DASH}${CUR}?\s*${NUM}\s*${CUR}?`, "giu");
const SINGLE = new RegExp(
  String.raw`(?:salary|base pay|compensation|שכר|משכורת)[^\d₪$€£\n]{0,20}${CUR}?\s*${NUM}\s*${CUR}?`,
  "giu",
);

const KEYWORDS =
  /salary|compensation|pay range|base pay|pay scale|wage|ote|שכר|משכורת|תגמול|ברוטו|gross|per (year|month|hour|annum)|annual|monthly|hourly|\/(yr|year|mo|month|hr|hour)\b|לחודש|לשנה|לשעה|חודשי|שנתי|שעתי/i;

function currencyOf(token: string | undefined): Currency | null {
  if (!token) return null;
  const t = token.toLowerCase();
  if (t === "₪" || t === "nis" || t === "ils" || t.startsWith("ש")) return "ILS";
  if (t === "$" || t === "usd" || t === "us$") return "USD";
  if (t === "€" || t === "eur") return "EUR";
  if (t === "£" || t === "gbp") return "GBP";
  return null;
}

function toNumber(digits: string, suffix: string | undefined): number {
  // "32,000" / "32.000" / "32 000" are thousands separators; "32.5" is a decimal.
  const grouped = /^\d{1,3}(?:[,.\s]\d{3})+$/.test(digits);
  const n = grouped ? Number(digits.replace(/[,.\s]/g, "")) : Number(digits);
  return suffix ? n * 1000 : n;
}

function periodFrom(context: string): PayPeriod | null {
  const c = context.toLowerCase();
  if (/per hour|hourly|an hour|\/\s?(hr|hour)\b|לשעה|שעתי/.test(c)) return "hour";
  if (/per year|per annum|annual|yearly|a year|\/\s?(yr|year)\b|לשנה|שנתי/.test(c)) return "year";
  if (/per month|monthly|a month|\/\s?(mo|month)\b|לחודש|חודשי/.test(c)) return "month";
  return null;
}

function toMonthly(v: number, p: PayPeriod) {
  return p === "year" ? v / 12 : p === "hour" ? v * HOURS_PER_MONTH : v;
}

/** Guess the period from magnitude when the text does not say. */
function inferPeriod(max: number, currency: Currency): PayPeriod | null {
  const [lo, hi] = currency === "ILS" ? MONTHLY_BOUNDS_ILS : MONTHLY_BOUNDS_FOREIGN;
  if (max >= lo && max <= hi) return currency === "ILS" ? "month" : max >= 20_000 ? "year" : "month";
  if (max > hi && max / 12 <= hi * 1.2) return "year";
  if (max < 400) return "hour";
  return null;
}

/** `periodText` = text right around the amount (period words after it win over words before it). */
function finish(
  min: number,
  max: number,
  currency: Currency,
  periodText: [string, string],
  raw: string,
): PostedSalary | null {
  if (!(min > 0) || !(max > 0)) return null;
  if (min > max) [min, max] = [max, min];
  if (max > min * 3) return null; // not a salary band
  const period = periodFrom(periodText[1]) ?? periodFrom(periodText[0]) ?? inferPeriod(max, currency);
  if (!period) return null;
  const [lo, hi] = currency === "ILS" ? MONTHLY_BOUNDS_ILS : MONTHLY_BOUNDS_FOREIGN;
  const mMin = toMonthly(min, period);
  const mMax = toMonthly(max, period);
  if (mMin < lo * 0.8 || mMax > hi) return null;
  const ils = currency === "ILS";
  return {
    min,
    max,
    currency,
    period,
    monthlyMinIls: ils ? Math.round(mMin) : null,
    monthlyMaxIls: ils ? Math.round(mMax) : null,
    raw: raw.trim(),
  };
}

export function parsePostedSalary(text: string | null | undefined): PostedSalary | null {
  if (!text) return null;
  const found: PostedSalary[] = [];

  for (const m of text.matchAll(RANGE)) {
    const [raw, c1, n1, k1, c2, c3, n2, k2, c4] = m;
    const currency = currencyOf(c1) ?? currencyOf(c2) ?? currencyOf(c3) ?? currencyOf(c4);
    if (!currency) continue;
    const start = m.index ?? 0;
    const context = text.slice(Math.max(0, start - 120), start + raw.length + 40);
    if (!KEYWORDS.test(context)) continue;
    // "30-40K" → both ends in thousands
    const kBoth = k2 && !k1 && Number(n1) < 1000;
    const end = start + raw.length;
    const around: [string, string] = [text.slice(Math.max(0, start - 30), start), text.slice(end, end + 30)];
    const r = finish(toNumber(n1, k1 ?? (kBoth ? k2 : undefined)), toNumber(n2, k2), currency, around, raw);
    if (r) found.push(r);
  }

  if (!found.length) {
    for (const m of text.matchAll(SINGLE)) {
      const [raw, c1, n1, k1, c2] = m;
      const currency = currencyOf(c1) ?? currencyOf(c2);
      if (!currency) continue;
      const start = m.index ?? 0;
      const end = start + raw.length;
      const v = toNumber(n1, k1);
      const r = finish(v, v, currency, [raw, text.slice(end, end + 30)], raw);
      if (r) found.push(r);
    }
  }

  // Prefer ILS (local contract), then the first occurrence.
  return found.find((f) => f.currency === "ILS") ?? found[0] ?? null;
}
