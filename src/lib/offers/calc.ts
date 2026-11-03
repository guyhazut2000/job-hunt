import { z } from "zod";
import {
  CREDIT_POINT_MONTHLY,
  DEFAULT_CREDIT_POINTS,
  KH_SALARY_CEILING_MONTHLY,
  PENSION_CREDIT_DEPOSIT_PCT,
  PENSION_CREDIT_RATE,
  PENSION_CREDIT_SALARY_CAP,
  incomeTaxBeforeCredits,
  nationalInsurance,
} from "./tax";

/**
 * Offer comparison (#91, docs/offers.md). Pure functions: the page computes on the client as the user
 * types and the server re-validates before saving. Everything here is an ESTIMATE — the UI says so.
 */

const money = (max: number) => z.coerce.number().min(0).max(max).catch(0);

export const offerInputSchema = z.object({
  label: z.string().trim().max(80).catch(""),
  company: z.string().trim().max(120).catch(""),
  /** Gross monthly base salary. */
  baseMonthly: money(300_000),
  /** Expected annual bonus (₪, what you realistically expect to be paid). */
  bonusAnnual: money(3_000_000),
  /** One-time signing bonus (counted in year 1 only). */
  signingBonus: money(3_000_000),
  /** Options/RSUs granted over the whole vesting period. RSU = strike 0. */
  equityUnits: money(100_000_000),
  equityStrike: money(100_000),
  /** Current price per share you were told (409A / last round / market). Same currency as strike. */
  equitySharePrice: money(100_000),
  /** ₪ per 1 unit of the equity currency (e.g. USD→ILS). 1 if the prices are already in ₪. */
  equityFx: z.coerce.number().min(0.01).max(1000).catch(1),
  vestingYears: z.coerce.number().min(1).max(10).catch(4),
  /** Conservative haircut on the paper value (private companies: illiquid, may never exit). */
  equityHaircutPct: z.coerce.number().min(0).max(100).catch(50),
  pensionEmployerPct: z.coerce.number().min(0).max(30).catch(6.5),
  severancePct: z.coerce.number().min(0).max(30).catch(6),
  pensionEmployeePct: z.coerce.number().min(0).max(30).catch(6),
  /** 0 = no keren hishtalmut. */
  khEmployerPct: z.coerce.number().min(0).max(30).catch(7.5),
  khEmployeePct: z.coerce.number().min(0).max(30).catch(2.5),
  /** Deposits on the full salary (true) or only up to the tax-exempt ceiling (false). */
  khOnFullSalary: z.boolean().catch(false),
  /** Company car "שווי שימוש" (taxable imputed income, not cash). */
  carBenefitMonthly: money(50_000),
  /** What the car saves you per month (lease, insurance, fuel you no longer pay). */
  carSavingsMonthly: money(50_000),
  /** Travel allowance paid in cash (taxable). */
  travelMonthly: money(20_000),
  /** Meal card (Cibus / 10bis) — taxable, value to you. */
  mealsMonthly: money(20_000),
  /** Other perks you value monthly (gym, phone, learning budget…). */
  otherMonthly: money(50_000),
  remoteDaysPerWeek: z.coerce.number().int().min(0).max(5).catch(0),
  commuteMinutesOneWay: z.coerce.number().int().min(0).max(300).catch(0),
  /** Out-of-pocket commute cost per month (fuel, parking, transit) not covered by the employer. */
  commuteCostMonthly: money(20_000),
  notes: z.string().trim().max(2000).catch(""),
});
export type OfferInput = z.infer<typeof offerInputSchema>;

export const EMPTY_OFFER: OfferInput = offerInputSchema.parse({});

export interface CalcOptions {
  creditPoints?: number;
}

export interface OfferResult {
  monthly: {
    gross: number;
    taxableGross: number;
    incomeTax: number;
    nationalInsurance: number;
    pensionEmployee: number;
    khEmployee: number;
    /** Base month take-home (no bonus). */
    netCash: number;
    /** Average take-home including the bonus spread over 12 months. */
    netCashWithBonus: number;
    /** netCashWithBonus + perks you value − commute cost. */
    netValue: number;
  };
  annual: {
    base: number;
    bonus: number;
    /** Conservative (after haircut) yearly equity value, before tax. */
    equity: number;
    /** Paper value before the haircut. */
    equityPaper: number;
    employerPension: number;
    employerKh: number;
    perks: number;
    /** base + bonus + equity + employer pension/KH + perks (gross "total comp" view). */
    total: number;
    /** Year 1 total including the signing bonus. */
    firstYear: number;
    /** Rough after-tax yearly value: net value × 12 + equity after ~25% (section 102 capital track). */
    netEstimate: number;
  };
  commute: {
    officeDaysPerMonth: number;
    hoursPerMonth: number;
    costMonthly: number;
  };
}

/** Average weeks per month. */
const WEEKS = 52 / 12;
const EQUITY_TAX = 0.25;

const r = (n: number) => Math.round(n);

/** Take-home for a given taxable/NI-able monthly gross and pension deposit. */
function takeHome(taxable: number, pensionDeposit: number, creditPoints: number) {
  const credits = creditPoints * CREDIT_POINT_MONTHLY;
  const pensionCredit =
    PENSION_CREDIT_RATE *
    Math.min(pensionDeposit, PENSION_CREDIT_DEPOSIT_PCT * Math.min(taxable, PENSION_CREDIT_SALARY_CAP));
  const tax = Math.max(0, incomeTaxBeforeCredits(taxable) - credits - pensionCredit);
  const ni = nationalInsurance(taxable);
  return { tax, ni };
}

export function computeOffer(o: OfferInput, opts: CalcOptions = {}): OfferResult {
  const points = opts.creditPoints ?? DEFAULT_CREDIT_POINTS;
  const base = o.baseMonthly;
  const khBase = o.khOnFullSalary ? base : Math.min(base, KH_SALARY_CEILING_MONTHLY);
  const khEmployer = (o.khEmployerPct / 100) * khBase;
  // Employer KH deposits above the exempt ceiling are taxable income to the employee.
  const khTaxableExcess = o.khOnFullSalary
    ? (o.khEmployerPct / 100) * Math.max(0, base - KH_SALARY_CEILING_MONTHLY)
    : 0;
  const khEmployee = o.khEmployerPct > 0 ? (o.khEmployeePct / 100) * khBase : 0;
  const pensionEmployee = (o.pensionEmployeePct / 100) * base;
  const employerPension = ((o.pensionEmployerPct + o.severancePct) / 100) * base;

  const taxable = base + o.travelMonthly + o.mealsMonthly + o.carBenefitMonthly + khTaxableExcess;
  const { tax, ni } = takeHome(taxable, pensionEmployee, points);
  const cash = base + o.travelMonthly; // meals are a card, car benefit is imputed
  const netCash = cash - tax - ni - pensionEmployee - khEmployee;

  const withBonus = takeHome(taxable + o.bonusAnnual / 12, pensionEmployee, points);
  const netCashWithBonus = cash + o.bonusAnnual / 12 - withBonus.tax - withBonus.ni - pensionEmployee - khEmployee;

  const officeDays = (5 - o.remoteDaysPerWeek) * WEEKS;
  const commuteHours = (officeDays * 2 * o.commuteMinutesOneWay) / 60;
  const perksMonthly = o.mealsMonthly + o.otherMonthly + o.carSavingsMonthly;
  const netValue = netCashWithBonus + perksMonthly - o.commuteCostMonthly;

  const spread = Math.max(0, o.equitySharePrice - o.equityStrike);
  const equityPaper = (spread * o.equityUnits * o.equityFx) / o.vestingYears;
  const equity = equityPaper * (1 - o.equityHaircutPct / 100);

  const perksAnnual = (o.travelMonthly + perksMonthly) * 12;
  const total = base * 12 + o.bonusAnnual + equity + (employerPension + khEmployer) * 12 + perksAnnual;

  return {
    monthly: {
      gross: r(base),
      taxableGross: r(taxable),
      incomeTax: r(tax),
      nationalInsurance: r(ni),
      pensionEmployee: r(pensionEmployee),
      khEmployee: r(khEmployee),
      netCash: r(netCash),
      netCashWithBonus: r(netCashWithBonus),
      netValue: r(netValue),
    },
    annual: {
      base: r(base * 12),
      bonus: r(o.bonusAnnual),
      equity: r(equity),
      equityPaper: r(equityPaper),
      employerPension: r(employerPension * 12),
      employerKh: r(khEmployer * 12),
      perks: r(perksAnnual),
      total: r(total),
      firstYear: r(total + o.signingBonus),
      netEstimate: r(netValue * 12 + equity * (1 - EQUITY_TAX)),
    },
    commute: {
      officeDaysPerMonth: Math.round(officeDays * 10) / 10,
      hoursPerMonth: Math.round(commuteHours * 10) / 10,
      costMonthly: r(o.commuteCostMonthly),
    },
  };
}

/** Index of the best offer by a metric (ties → first), or -1 when nothing is filled in. */
export function bestBy(results: OfferResult[], pick: (r: OfferResult) => number): number {
  let best = -1;
  let val = 0;
  results.forEach((res, i) => {
    const v = pick(res);
    if (v > val) {
      val = v;
      best = i;
    }
  });
  return best;
}
