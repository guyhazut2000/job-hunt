import { describe, expect, it } from "vitest";
import {
  askFor,
  bandFromReports,
  estimateSalary,
  formatBandK,
  isPlausibleReport,
  MIN_REPORTS,
  referenceBand,
} from "@/lib/salary/estimate";
import { businessFamily, salaryFamily, salaryLevel } from "@/lib/salary/family";
import { companyTier } from "@/lib/salary/company-tier";
import { REFERENCE, SALARY_FAMILIES, SALARY_LEVELS, SALARY_SOURCES } from "@/lib/salary/reference";
import { percentile } from "@/lib/salary/stats";

const job = (o: Partial<{ title: string; roleCategory: string; seniority: string; description: string }> = {}) => ({
  title: "Senior Backend Engineer",
  roleCategory: "backend",
  seniority: "SENIOR",
  description: "Build services.",
  ...o,
});
const startup = { slug: "some-startup", size: null };

describe("reference table", () => {
  it("has ordered, sourced bands for every family × level", () => {
    for (const f of SALARY_FAMILIES) {
      expect(REFERENCE[f].sources.length).toBeGreaterThan(0);
      for (const id of REFERENCE[f].sources) expect(SALARY_SOURCES[id]?.url).toMatch(/^https:\/\//);
      for (const l of SALARY_LEVELS) {
        const [p25, med, p75] = REFERENCE[f].bands[l];
        expect(p25).toBeLessThan(med);
        expect(med).toBeLessThan(p75);
        expect(p25).toBeGreaterThanOrEqual(8);
        expect(p75).toBeLessThanOrEqual(80);
      }
    }
  });
  it("is monotonic in seniority for IC levels", () => {
    for (const f of SALARY_FAMILIES) {
      const m = (["JUNIOR", "MID", "SENIOR", "LEAD"] as const).map((l) => REFERENCE[f].bands[l][1]);
      expect([...m].sort((a, b) => a - b)).toEqual(m);
    }
  });
  it("tech median roughly anchors to the CBS hi-tech average (₪34–37K)", () => {
    const seniorMedians = ["backend", "fullstack", "devops", "security", "ml"].map(
      (f) => referenceBand(f as never, "SENIOR").median,
    );
    const avg = seniorMedians.reduce((a, b) => a + b) / seniorMedians.length;
    expect(avg).toBeGreaterThan(33_000);
    expect(avg).toBeLessThan(42_000);
  });
});

describe("family & level", () => {
  it("maps tech categories directly and splits QA", () => {
    expect(salaryFamily("backend", "Senior Backend Engineer")).toBe("backend");
    expect(salaryFamily("qa", "QA Automation Engineer")).toBe("qa_automation");
    expect(salaryFamily("qa", "Manual QA Tester")).toBe("qa");
    expect(salaryFamily("management", "R&D Group Manager")).toBe("eng_management");
  });
  it("infers business families from the title", () => {
    expect(businessFamily("account executive, emea")).toBe("sales");
    expect(businessFamily("salary controller")).toBe("finance");
    expect(businessFamily("talent acquisition partner")).toBe("people");
    expect(businessFamily("legal counsel")).toBe("legal");
    expect(businessFamily("customer success manager")).toBe("customer");
    expect(businessFamily("content marketing manager")).toBe("marketing");
    expect(businessFamily("office manager")).toBe("operations");
    expect(salaryFamily("other", "Chief of Staff")).toBe("other");
  });
  it("extrapolates intern and executive levels", () => {
    expect(salaryLevel("INTERN", "Student")).toEqual({ level: "JUNIOR", extrapolated: "intern" });
    expect(salaryLevel("MANAGER", "VP Engineering")).toEqual({ level: "MANAGER", extrapolated: "executive" });
    expect(salaryLevel("MANAGER", "Engineering Manager")).toEqual({ level: "MANAGER", extrapolated: null });
  });
});

describe("estimateSalary", () => {
  it("uses the reference band for an unknown company", () => {
    const e = estimateSalary({ job: job(), company: startup });
    expect(e).toMatchObject({
      basis: "reference",
      confidence: "medium",
      isEstimate: true,
      family: "backend",
      level: "SENIOR",
    });
    expect([e.p25, e.median, e.p75]).toEqual([33_000, 38_000, 44_000]);
    expect(e.adjustments).toEqual([]);
  });

  it("applies a labelled tier premium for established companies", () => {
    const e = estimateSalary({ job: job(), company: { slug: "mobileye" } });
    expect(e.adjustments).toContainEqual({ kind: "tier", tier: "established", factor: 1.08 });
    expect(e.median).toBe(41_000);
  });

  it("lets a posted ILS range override everything", () => {
    const e = estimateSalary({
      job: job({ description: "Salary range: ₪35,000-₪45,000 per month" }),
      company: { slug: "mobileye" },
      companyReports: { n: 9, values: Array(9).fill(60_000) },
    });
    expect(e).toMatchObject({
      basis: "posted",
      confidence: "high",
      isEstimate: false,
      p25: 35_000,
      p75: 45_000,
      median: 40_000,
    });
  });

  it("keeps a foreign posted range as info only", () => {
    const e = estimateSalary({
      job: job({ description: "Base pay range: $150,000 - $190,000 per year" }),
      company: startup,
    });
    expect(e.basis).toBe("reference");
    expect(e.postedForeign?.currency).toBe("USD");
  });

  it("ignores user reports below the k-anonymity threshold", () => {
    const few = { n: MIN_REPORTS - 1, values: Array(MIN_REPORTS - 1).fill(50_000) };
    const e = estimateSalary({ job: job(), company: startup, companyReports: few, marketReports: few });
    expect(e.basis).toBe("reference");
    expect(e.median).toBe(38_000);
  });

  it("blends company reports once there are enough, replacing the tier guess", () => {
    const values = [44_000, 46_000, 48_000, 50_000, 52_000, 54_000];
    const e = estimateSalary({
      job: job(),
      company: { slug: "mobileye" },
      companyReports: { n: values.length, values },
    });
    expect(e.basis).toBe("reports");
    expect(e.adjustments.some((a) => a.kind === "tier")).toBe(false);
    expect(e.adjustments.find((a) => a.kind === "companyReports")).toMatchObject({ n: 6 });
    expect(e.median).toBeGreaterThan(38_000);
    expect(e.median).toBeLessThan(49_000);
    expect(e.sourceIds).toContain("reports");
  });

  it("caps market-report influence at 50%", () => {
    const values = Array(200).fill(60_000);
    const e = estimateSalary({ job: job(), company: startup, marketReports: { n: 200, values } });
    expect(e.median).toBeLessThanOrEqual(49_000);
    expect(e.basis).toBe("reference");
  });

  it("marks business and extrapolated roles as low confidence", () => {
    expect(
      estimateSalary({
        job: job({ title: "Account Executive", roleCategory: "other", seniority: "MID" }),
        company: startup,
      }).confidence,
    ).toBe("low");
    const intern = estimateSalary({ job: job({ title: "Software Student", seniority: "INTERN" }), company: startup });
    expect(intern.confidence).toBe("low");
    expect(intern.median).toBeLessThan(referenceBand("backend", "JUNIOR").median);
  });
});

describe("reports", () => {
  it("drops outliers before aggregating", () => {
    expect(bandFromReports([30_000, 31_000, 32_000, 33_000, 500_000], 30_000)).toBeNull();
    const b = bandFromReports([30_000, 31_000, 32_000, 33_000, 34_000, 500_000], 30_000)!;
    expect(b.median).toBe(32_000);
  });
  it("percentile interpolates", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([1], 0.75)).toBe(1);
  });
  it("rejects implausible report amounts", () => {
    expect(isPlausibleReport("backend", "SENIOR", 38_000)).toBe(true);
    expect(isPlausibleReport("backend", "SENIOR", 456_000)).toBe(false); // annual typed as monthly
    expect(isPlausibleReport("backend", "SENIOR", 3_800)).toBe(false);
  });
});

describe("askFor", () => {
  const band = { p25: 33_000, median: 38_000, p75: 44_000, level: "SENIOR" as const };
  it("anchors on the median without a profile", () => {
    const a = askFor(band, null);
    expect(a.position).toBe("unknown");
    expect(a.askLow).toBe(39_000);
    expect(a.askHigh).toBe(41_500);
  });
  it("positions by years of experience", () => {
    expect(askFor(band, { yearsExperience: 6 }).position).toBe("lower");
    expect(askFor(band, { yearsExperience: 8 }).position).toBe("middle");
    expect(askFor(band, { yearsExperience: 10 }).position).toBe("upper");
    expect(askFor(band, { yearsExperience: 15 }).position).toBe("above");
    expect(askFor(band, { yearsExperience: 2 }).position).toBe("below");
    const hi = askFor(band, { yearsExperience: 10 });
    const lo = askFor(band, { yearsExperience: 6 });
    expect(hi.askLow).toBeGreaterThan(lo.askLow);
    expect(lo.askLow).toBeGreaterThanOrEqual(band.p25);
    expect(hi.askHigh).toBeLessThanOrEqual(band.p75 * 1.1);
  });
  it("compares the profile expectation to the band", () => {
    expect(askFor(band, { salaryMin: 25_000 }).expectation).toBe("underselling");
    expect(askFor(band, { salaryMin: 40_000 }).expectation).toBe("aligned");
    expect(askFor(band, { salaryMin: 48_000 }).expectation).toBe("stretch");
    expect(askFor(band, { salaryMin: 70_000 }).expectation).toBe("aboveBand");
  });
  it("flags level gaps", () => {
    expect(askFor(band, { seniority: "LEAD" }).levelGap).toBe(1);
    expect(askFor(band, { seniority: "JUNIOR" }).levelGap).toBe(-2);
  });
});

describe("formatting & tiers", () => {
  it("formats compact bands", () => {
    expect(formatBandK({ p25: 32_000, p75: 42_000 })).toBe("₪32–42K");
    expect(formatBandK({ p25: 35_000, p75: 35_000 })).toBe("₪35K");
  });
  it("derives tier from the curated list or size", () => {
    expect(companyTier({ slug: "wiz" }).tier).toBe("established");
    expect(companyTier({ slug: "x", size: "1000+" }).tier).toBe("established");
    expect(companyTier({ slug: "x", size: "10-50" }).tier).toBe("early");
    expect(companyTier({ slug: "x", size: "200-500" }).tier).toBe("growth");
  });
});
