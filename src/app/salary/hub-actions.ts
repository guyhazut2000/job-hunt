"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { offerInputSchema } from "@/lib/offers/calc";
import { SALARY_FAMILIES, SALARY_LEVELS } from "@/lib/salary/reference";
import { SALARY_CITIES } from "@/lib/i18n/salary-hub";
import { requireUser } from "@/lib/session";

/** Private salary data (#91): asked salary per application, own data points, saved offers. */

export type FormState = { ok?: boolean; error?: "invalid" } | undefined;

const MIN_MONTHLY = 3_000;
const MAX_MONTHLY = 300_000;
const amount = z.coerce.number().int().min(MIN_MONTHLY).max(MAX_MONTHLY);

const askedForm = z.object({
  applicationId: z.string().min(1).max(64),
  amount: z.string().max(20).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
  clear: z.string().optional(),
});

/** Set or clear the salary the user asked for on one of their applications. */
export async function setAskedSalary(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = askedForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { applicationId, note, clear } = parsed.data;
  let value: number | null = null;
  if (!clear) {
    const a = amount.safeParse(parsed.data.amount.replace(/[,\s₪]/g, ""));
    if (!a.success) return { error: "invalid" };
    value = a.data;
  }
  const res = await db.application.updateMany({
    where: { id: applicationId, userId: user.id },
    data: { askedSalaryMonthly: value, salaryNote: value ? note || null : null },
  });
  if (res.count === 0) return { error: "invalid" };
  if (value) track("salary_asked_saved");
  revalidatePath("/dashboard");
  revalidatePath("/salary");
  return { ok: true };
}

const pointForm = z.object({
  family: z.enum(SALARY_FAMILIES),
  level: z.enum(SALARY_LEVELS),
  city: z.enum(SALARY_CITIES).optional().default("any"),
  amount: z.string().max(20),
  company: z.string().trim().max(120).optional().default(""),
  source: z.string().trim().min(2).max(300),
  observedAt: z.string().max(10).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

export async function addSalaryDataPoint(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = pointForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  const a = amount.safeParse(d.amount.replace(/[,\s₪]/g, ""));
  if (!a.success) return { error: "invalid" };
  const observed = /^\d{4}-\d{2}(-\d{2})?$/.test(d.observedAt)
    ? new Date(d.observedAt.length === 7 ? `${d.observedAt}-01` : d.observedAt)
    : null;
  const count = await db.salaryDataPoint.count({ where: { userId: user.id } });
  if (count >= 500) return { error: "invalid" };
  await db.salaryDataPoint.create({
    data: {
      userId: user.id,
      family: d.family,
      level: d.level,
      city: d.city === "any" ? null : d.city,
      company: d.company || null,
      monthlyGrossIls: a.data,
      source: d.source,
      observedAt: observed && !Number.isNaN(observed.getTime()) ? observed : null,
      note: d.note || null,
    },
  });
  track("salary_datapoint_saved", { family: d.family, level: d.level });
  revalidatePath("/salary");
  return { ok: true };
}

export async function deleteSalaryDataPoint(id: string): Promise<void> {
  const user = await requireUser();
  await db.salaryDataPoint.deleteMany({ where: { id: String(id).slice(0, 64), userId: user.id } });
  revalidatePath("/salary");
}

const MAX_OFFERS = 20;

/** Create or update a saved offer. Returns the id. */
export async function saveOffer(input: {
  id?: string | null;
  applicationId?: string | null;
  data: unknown;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  const user = await requireUser();
  const data = offerInputSchema.parse(input.data ?? {});
  const label = data.label || data.company || "Offer";
  let applicationId: string | null = null;
  if (input.applicationId) {
    const app = await db.application.findFirst({
      where: { id: String(input.applicationId), userId: user.id },
      select: { id: true },
    });
    applicationId = app?.id ?? null;
  }
  if (input.id) {
    const res = await db.jobOffer.updateMany({
      where: { id: String(input.id), userId: user.id },
      data: { label, data, applicationId },
    });
    if (res.count === 0) return { ok: false };
    revalidatePath("/salary/offers");
    return { ok: true, id: String(input.id) };
  }
  if ((await db.jobOffer.count({ where: { userId: user.id } })) >= MAX_OFFERS) return { ok: false };
  const row = await db.jobOffer.create({ data: { userId: user.id, label, data, applicationId } });
  track("offer_saved");
  revalidatePath("/salary/offers");
  return { ok: true, id: row.id };
}

export async function deleteOffer(id: string): Promise<void> {
  const user = await requireUser();
  await db.jobOffer.deleteMany({ where: { id: String(id).slice(0, 64), userId: user.id } });
  revalidatePath("/salary/offers");
}
