"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ContactCategory, ContactStatus } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { getLocale } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { CONTACT_CATEGORIES, isLinkedinProfileUrl } from "@/lib/outreach/links";
import { outreachContext } from "@/lib/outreach/context";
import { generateOutreach, type OutreachLang, type OutreachMessage } from "@/lib/outreach/messages";
import { requireUser } from "@/lib/session";

const STATUSES: ContactStatus[] = ["NOT_CONTACTED", "SENT", "REPLIED", "REFERRED"];

async function revalidateFor(jobId: string | null, companyId: string | null) {
  revalidatePath("/dashboard");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  if (companyId) {
    const c = await db.company.findUnique({ where: { id: companyId }, select: { slug: true } });
    if (c) revalidatePath(`/companies/${c.slug}`);
  }
}

/** AI-personalised draft for one audience. Templates are already rendered server-side; this is the upgrade. */
export async function draftOutreach(input: {
  companyId: string;
  jobId?: string | null;
  category: ContactCategory;
  lang: OutreachLang;
}): Promise<OutreachMessage | { error: string }> {
  const user = await requireUser();
  if (!CONTACT_CATEGORIES.includes(input.category) || !["he", "en"].includes(input.lang)) return { error: "invalid" };
  const [company, job, profile, me] = await Promise.all([
    db.company.findUnique({ where: { id: input.companyId }, select: { name: true } }),
    input.jobId
      ? db.job.findUnique({
          where: { id: input.jobId },
          select: { title: true, applyUrl: true, techStack: true, companyId: true },
        })
      : null,
    db.profile.findUnique({ where: { userId: user.id } }),
    db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
  ]);
  if (!company || (job && job.companyId !== input.companyId)) return { error: "not_found" };
  const provider = await guardedLLM("outreach", user.id);
  const msg = await generateOutreach(
    provider,
    input.category,
    outreachContext(company, job, profile, me?.name),
    input.lang,
  );
  track("outreach_drafted", { category: input.category, lang: input.lang, source: msg.source });
  if (provider.limited) return { ...msg, notice: aiLimitMessage(provider.limited, await getLocale()) };
  return msg;
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: optional(160),
  linkedinUrl: optional(400).refine((v) => v === null || isLinkedinProfileUrl(v), "linkedin"),
  category: z.enum(CONTACT_CATEGORIES as [ContactCategory, ...ContactCategory[]]),
  notes: optional(2000),
  jobId: optional(64),
  companyId: z.string().min(1).max(64),
});

export type ContactFormState = { ok?: boolean; error?: "linkedin" | "invalid"; at?: number } | undefined;

export async function addContact(_: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const user = await requireUser();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.message === "linkedin") ? "linkedin" : "invalid" };
  }
  const d = parsed.data;
  const company = await db.company.findUnique({ where: { id: d.companyId }, select: { id: true } });
  if (!company) return { error: "invalid" };
  if (d.jobId) {
    const job = await db.job.findUnique({ where: { id: d.jobId }, select: { companyId: true } });
    if (!job || job.companyId !== d.companyId) return { error: "invalid" };
  }
  await db.contact.create({ data: { ...d, userId: user.id } });
  track("contact_saved", { category: d.category });
  await revalidateFor(d.jobId, d.companyId);
  return { ok: true, at: Date.now() };
}

export async function updateContactStatus(id: string, status: ContactStatus) {
  const user = await requireUser();
  if (!STATUSES.includes(status)) return;
  const c = await db.contact.findFirst({ where: { id, userId: user.id }, select: { jobId: true, companyId: true } });
  if (!c) return;
  await db.contact.update({ where: { id }, data: { status } });
  track("contact_status_changed", { status });
  await revalidateFor(c.jobId, c.companyId);
}

export async function deleteContact(id: string) {
  const user = await requireUser();
  const c = await db.contact.findFirst({ where: { id, userId: user.id }, select: { jobId: true, companyId: true } });
  if (!c) return;
  await db.contact.delete({ where: { id } });
  await revalidateFor(c.jobId, c.companyId);
}
