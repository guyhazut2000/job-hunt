/**
 * Israeli payroll parameters for tax year 2026 — used ONLY for the clearly-labeled "net-ish" estimate
 * in the offer comparison (/salary/offers). Not tax advice. Every number below is copied from an
 * official publication; review every January (see docs/offers.md).
 */

export const TAX_YEAR = 2026;

export interface TaxSource {
  id: string;
  nameHe: string;
  name: string;
  url: string;
  /** When the figures took effect. */
  effective: string;
  /** When we last read the page. */
  checked: string;
}

export const TAX_SOURCES: TaxSource[] = [
  {
    id: "ita-booklet",
    nameHe: "רשות המסים: לוח ניכויים חודשי 2026 (מדרגות מס, נקודת זיכוי, תקרת קרן השתלמות)",
    name: "Israel Tax Authority: 2026 monthly deductions booklet (brackets, credit point, keren hishtalmut ceiling)",
    url: "https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf",
    effective: "2026-01-01",
    checked: "2026-11-03",
  },
  {
    id: "btl-rates",
    nameHe: "ביטוח לאומי: שיעורי דמי ביטוח לעובדים שכירים",
    name: "National Insurance Institute: contribution rates for employees",
    url: "https://www.btl.gov.il/Insurance/Rates/Pages/%d7%9c%d7%a2%d7%95%d7%91%d7%93%d7%99%d7%9d%20%d7%a9%d7%9b%d7%99%d7%a8%d7%99%d7%9d.aspx",
    effective: "2026-01-01",
    checked: "2026-11-03",
  },
  {
    id: "kolzchut-brackets",
    nameHe: "כל זכות: מדרגות מס הכנסה 2026",
    name: "Kol Zchut: 2026 income tax brackets",
    url: "https://www.kolzchut.org.il/he/%D7%9E%D7%93%D7%A8%D7%92%D7%95%D7%AA_%D7%9E%D7%A1_%D7%94%D7%9B%D7%A0%D7%A1%D7%94",
    effective: "2026-01-01",
    checked: "2026-11-03",
  },
];

/** Monthly income-tax brackets on employment income: [upper bound ₪/month, rate]. Last one is open. */
export const BRACKETS_2026: [number, number][] = [
  [7_010, 0.1],
  [10_060, 0.14],
  [19_000, 0.2],
  [25_100, 0.31],
  [46_690, 0.35],
  [60_130, 0.47],
  [Infinity, 0.5], // 47% + 3% surtax (section 121B)
];

/** Value of one tax credit point per month. A resident gets 2.25, a woman 2.75 (more for kids etc.). */
export const CREDIT_POINT_MONTHLY = 242;
export const DEFAULT_CREDIT_POINTS = 2.25;

/** National insurance + health, employee share. */
export const NI_REDUCED_CEILING = 7_703;
export const NI_MAX_INCOME = 51_910;
export const NI_REDUCED_RATE = 0.0427;
export const NI_FULL_RATE = 0.1217;

/** Keren hishtalmut: salary ceiling for tax-exempt employer deposits (188,544 ₪/year ÷ 12). */
export const KH_SALARY_CEILING_MONTHLY = 15_712;
/** Pension credit: 35% of the employee deposit, on up to 7% of 9,700 ₪/month. */
export const PENSION_CREDIT_RATE = 0.35;
export const PENSION_CREDIT_SALARY_CAP = 9_700;
export const PENSION_CREDIT_DEPOSIT_PCT = 0.07;

export function incomeTaxBeforeCredits(taxableMonthly: number): number {
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of BRACKETS_2026) {
    if (taxableMonthly <= prev) break;
    tax += (Math.min(taxableMonthly, top) - prev) * rate;
    prev = top;
  }
  return tax;
}

export function nationalInsurance(grossMonthly: number): number {
  const g = Math.max(0, Math.min(grossMonthly, NI_MAX_INCOME));
  const low = Math.min(g, NI_REDUCED_CEILING);
  return low * NI_REDUCED_RATE + Math.max(0, g - NI_REDUCED_CEILING) * NI_FULL_RATE;
}
