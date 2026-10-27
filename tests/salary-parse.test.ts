import { describe, expect, it } from "vitest";
import { parsePostedSalary } from "@/lib/salary/parse";

describe("parsePostedSalary", () => {
  it.each([
    ["Salary: ₪30K–40K per month", 30_000, 40_000, "month"],
    ["שכר: 30,000-38,000 ש״ח ברוטו", 30_000, 38_000, "month"],
    ['טווח שכר 25-32 אלף ש"ח לחודש', 25_000, 32_000, "month"],
    ["Monthly salary range: 28,000 – 34,000 NIS", 28_000, 34_000, "month"],
    ["Base salary ILS 420,000-480,000 per year", 420_000, 480_000, "year"],
    ["שכר: 60-75 ₪ לשעה", 60, 75, "hour"],
    ["Compensation: 30-40K ILS", 30_000, 40_000, "month"],
  ] as const)("%s", (text, min, max, period) => {
    const r = parsePostedSalary(text);
    expect(r).not.toBeNull();
    expect(r!.currency).toBe("ILS");
    expect(r!.min).toBe(min);
    expect(r!.max).toBe(max);
    expect(r!.period).toBe(period);
  });

  it("normalises annual and hourly ILS to monthly", () => {
    expect(parsePostedSalary("Base salary ILS 420,000-480,000 per year")).toMatchObject({
      monthlyMinIls: 35_000,
      monthlyMaxIls: 40_000,
    });
    expect(parsePostedSalary("שכר: 60-75 ₪ לשעה")).toMatchObject({ monthlyMinIls: 10_920, monthlyMaxIls: 13_650 });
  });

  it("parses US pay-transparency ranges but leaves ILS fields empty", () => {
    const r = parsePostedSalary("The base pay range for this role is $150,000 - $190,000 USD per year.");
    expect(r).toMatchObject({ currency: "USD", min: 150_000, max: 190_000, period: "year", monthlyMinIls: null });
  });

  it("prefers the ILS range when several currencies are listed", () => {
    const r = parsePostedSalary("Salary: $120,000-$140,000 per year (US). Israel: ₪32,000-₪38,000 per month");
    expect(r?.currency).toBe("ILS");
    expect(r?.monthlyMinIls).toBe(32_000);
  });

  it("accepts a single stated salary", () => {
    expect(parsePostedSalary("שכר: 35,000 ₪ ברוטו")).toMatchObject({ min: 35_000, max: 35_000, period: "month" });
  });

  it.each([
    "We raised $120M - $150M in our Series D", // funding, no salary context
    "Revenue grew from $10M to $40M annual recurring revenue last year", // implausible as pay
    "3-5 years of experience with Node.js", // no currency
    "Competitive compensation package which includes base salary and equity", // no number
    "Team of 30-40 engineers, salary reviews twice a year", // no currency
    "Salary: ₪5-6 per month", // implausible
    "",
  ])("ignores %j", (text) => {
    expect(parsePostedSalary(text)).toBeNull();
  });

  it("handles null/undefined", () => {
    expect(parsePostedSalary(null)).toBeNull();
    expect(parsePostedSalary(undefined)).toBeNull();
  });
});
