import { describe, expect, it } from "vitest";
import { EMPTY_OFFER, bestBy, computeOffer, offerInputSchema } from "@/lib/offers/calc";
import { incomeTaxBeforeCredits, nationalInsurance } from "@/lib/offers/tax";

const offer = (o: Partial<typeof EMPTY_OFFER>) => offerInputSchema.parse({ ...EMPTY_OFFER, ...o });

describe("2026 tax parameters", () => {
  it("applies the widened 2026 brackets", () => {
    expect(incomeTaxBeforeCredits(7_010)).toBeCloseTo(701, 0);
    // 701 + 427 + 1788 + 1891 + 4900*0.35
    expect(incomeTaxBeforeCredits(30_000)).toBeCloseTo(6522, 0);
    expect(incomeTaxBeforeCredits(0)).toBe(0);
  });
  it("adds the 3% surtax above 60,130", () => {
    expect(incomeTaxBeforeCredits(70_130) - incomeTaxBeforeCredits(60_130)).toBeCloseTo(5_000, 0);
  });
  it("national insurance: reduced, full, and capped", () => {
    expect(nationalInsurance(7_703)).toBeCloseTo(7_703 * 0.0427, 1);
    expect(nationalInsurance(60_000)).toBeCloseTo(nationalInsurance(51_910), 5);
  });
});

describe("computeOffer", () => {
  it("estimates take-home for a typical 30k offer", () => {
    const r = computeOffer(offer({ baseMonthly: 30_000 }));
    // 30000 − tax 5740 − NI 3042 − pension 1800 − KH 393 ≈ 19,025
    expect(r.monthly.netCash).toBeGreaterThan(18_900);
    expect(r.monthly.netCash).toBeLessThan(19_150);
    expect(r.annual.employerPension).toBe(Math.round(30_000 * 0.125 * 12));
    expect(r.annual.employerKh).toBe(Math.round(15_712 * 0.075 * 12));
  });
  it("empty offer is all zeros", () => {
    const r = computeOffer(EMPTY_OFFER);
    expect(r.annual.total).toBe(0);
    expect(r.monthly.netCash).toBe(0);
  });
  it("equity: spread × units × fx / vesting with haircut", () => {
    const r = computeOffer(
      offer({
        equityUnits: 10_000,
        equityStrike: 1,
        equitySharePrice: 5,
        equityFx: 3.7,
        vestingYears: 4,
        equityHaircutPct: 50,
      }),
    );
    expect(r.annual.equityPaper).toBe(Math.round((4 * 10_000 * 3.7) / 4));
    expect(r.annual.equity).toBe(Math.round(r.annual.equityPaper / 2));
  });
  it("underwater options are worth 0", () => {
    expect(computeOffer(offer({ equityUnits: 1000, equityStrike: 10, equitySharePrice: 5 })).annual.equity).toBe(0);
  });
  it("commute hours scale with office days", () => {
    const r = computeOffer(offer({ remoteDaysPerWeek: 2, commuteMinutesOneWay: 45 }));
    expect(r.commute.officeDaysPerMonth).toBeCloseTo(13, 0);
    expect(r.commute.hoursPerMonth).toBeCloseTo(19.5, 0);
  });
  it("bonus raises the average take-home but less than its gross", () => {
    const a = computeOffer(offer({ baseMonthly: 30_000 }));
    const b = computeOffer(offer({ baseMonthly: 30_000, bonusAnnual: 60_000 }));
    const diff = b.monthly.netCashWithBonus - a.monthly.netCashWithBonus;
    expect(diff).toBeGreaterThan(2_000);
    expect(diff).toBeLessThan(5_000);
  });
  it("taxable KH above the ceiling only when depositing on the full salary", () => {
    const a = computeOffer(offer({ baseMonthly: 40_000 }));
    const b = computeOffer(offer({ baseMonthly: 40_000, khOnFullSalary: true }));
    expect(b.monthly.taxableGross).toBeGreaterThan(a.monthly.taxableGross);
  });
  it("bad input falls back to safe defaults", () => {
    const o = offerInputSchema.parse({ baseMonthly: "abc", remoteDaysPerWeek: 9, vestingYears: 0 });
    expect(o.baseMonthly).toBe(0);
    expect(o.remoteDaysPerWeek).toBe(0);
    expect(o.vestingYears).toBe(4);
  });
  it("bestBy picks the highest and ignores all-zero", () => {
    const rs = [computeOffer(offer({ baseMonthly: 20_000 })), computeOffer(offer({ baseMonthly: 25_000 }))];
    expect(bestBy(rs, (r) => r.monthly.netCash)).toBe(1);
    expect(bestBy([computeOffer(EMPTY_OFFER)], (r) => r.annual.total)).toBe(-1);
  });
});
