import { createHmac } from "node:crypto";
import type { Company, Job } from "@prisma/client";
import { db } from "@/lib/db";
import { estimateSalary, MIN_REPORTS, type ReportAggregate, type SalaryEstimate } from "./estimate";
import { salaryFamily, salaryLevel } from "./family";
import type { SalaryFamily, SalaryLevel } from "./reference";

/** Pseudonymous, non-reversible key for a reporter: HMAC(user id). Never stored alongside the user. */
export function reporterKey(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for salary reports");
  return createHmac("sha256", secret).update(`salary-report:${userId}`).digest("hex");
}

const agg = (values: number[]): ReportAggregate | null =>
  values.length >= MIN_REPORTS ? { n: values.length, values } : null;

/** Reports are only read in buckets of >= MIN_REPORTS; individual rows never leave this module. */
async function reportValues(where: { companyId?: string | { not: string }; family: string; seniority: SalaryLevel }) {
  const rows = await db.salaryReport.findMany({ where, select: { monthlyGrossIls: true } });
  return rows.map((r) => r.monthlyGrossIls);
}

export async function estimateForJob(job: Job, company: Company): Promise<SalaryEstimate> {
  const family = salaryFamily(job.roleCategory, job.title);
  const { level } = salaryLevel(job.seniority, job.title);
  const [companyValues, marketValues] = await Promise.all([
    reportValues({ companyId: company.id, family, seniority: level }),
    // Market = other companies only, so a company's own reports aren't counted twice.
    reportValues({ companyId: { not: company.id }, family, seniority: level }),
  ]);
  return estimateSalary({
    job,
    company,
    companyReports: agg(companyValues),
    marketReports: agg(marketValues),
  });
}

export interface CompanyBandRow {
  family: SalaryFamily;
  level: SalaryLevel;
  openRoles: number;
  estimate: SalaryEstimate;
}

/** One row per function × level among the company's open roles (plus reported buckets), most common first. */
export async function companyBands(company: Company, jobs: Job[]): Promise<CompanyBandRow[]> {
  const buckets = new Map<string, { family: SalaryFamily; level: SalaryLevel; jobs: Job[] }>();
  for (const j of jobs) {
    const family = salaryFamily(j.roleCategory, j.title);
    const { level } = salaryLevel(j.seniority, j.title);
    const key = `${family}:${level}`;
    const b = buckets.get(key) ?? { family, level, jobs: [] };
    b.jobs.push(j);
    buckets.set(key, b);
  }

  const reports = await db.salaryReport.findMany({
    where: { companyId: company.id },
    select: { family: true, seniority: true, monthlyGrossIls: true },
  });
  const byBucket = new Map<string, number[]>();
  for (const r of reports) {
    if (r.seniority === "INTERN") continue;
    const key = `${r.family}:${r.seniority}`;
    byBucket.set(key, [...(byBucket.get(key) ?? []), r.monthlyGrossIls]);
  }
  // A bucket with enough reports is worth showing even without an open role.
  for (const [key, values] of byBucket) {
    if (values.length < MIN_REPORTS || buckets.has(key)) continue;
    const [family, level] = key.split(":") as [SalaryFamily, SalaryLevel];
    buckets.set(key, { family, level, jobs: [] });
  }

  const rows = [...buckets.entries()].map(([key, b]) => {
    // Representative job: no posted range ever drives a company-wide band.
    const rep = { title: b.jobs[0]?.title ?? "", roleCategory: "other", seniority: b.level, description: null };
    const estimate = estimateSalary({
      job: rep,
      family: b.family,
      company,
      companyReports: agg(byBucket.get(key) ?? []),
    });
    return { family: b.family, level: b.level, openRoles: b.jobs.length, estimate };
  });
  return rows.sort((a, b) => b.openRoles - a.openRoles || b.estimate.median - a.estimate.median);
}
