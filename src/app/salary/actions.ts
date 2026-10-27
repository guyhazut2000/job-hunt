"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isPlausibleReport } from "@/lib/salary/estimate";
import { SALARY_FAMILIES, SALARY_LEVELS } from "@/lib/salary/reference";
import { reporterKey } from "@/lib/salary/server";
import { requireUser } from "@/lib/session";

export type SalaryReportState =
  { ok: true; updated: boolean } | { ok?: false; error: "invalid" | "outOfRange" | "rate" | "not_found" } | undefined;

/** Max new/updated reports per reporter per rolling 24h. */
const DAILY_LIMIT = 5;

const schema = z.object({
  companyId: z.string().min(1).max(40),
  family: z.enum(SALARY_FAMILIES),
  seniority: z.enum(SALARY_LEVELS),
  yearsExperience: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(50).optional(),
  ),
  monthlyGrossIls: z.coerce.number().int().min(3_000).max(200_000),
});

export async function reportSalary(_prev: SalaryReportState, form: FormData): Promise<SalaryReportState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const { companyId, family, seniority, yearsExperience, monthlyGrossIls } = parsed.data;
  if (!isPlausibleReport(family, seniority, monthlyGrossIls)) return { error: "outOfRange" };

  const company = await db.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  if (!company) return { error: "not_found" };

  const key = reporterKey(user.id);
  const recent = await db.salaryReport.count({
    where: { reporterKey: key, updatedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
  });
  if (recent >= DAILY_LIMIT) return { error: "rate" };

  const where = { reporterKey_companyId_family: { reporterKey: key, companyId, family } };
  const existing = await db.salaryReport.findUnique({ where, select: { id: true } });
  const data = { seniority, yearsExperience: yearsExperience ?? null, monthlyGrossIls };
  await db.salaryReport.upsert({ where, create: { reporterKey: key, companyId, family, ...data }, update: data });

  revalidatePath(`/companies/${company.slug}`);
  return { ok: true, updated: !!existing };
}
