"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ReferralStatus } from "@prisma/client";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { isLinkedinProfileUrl } from "@/lib/outreach/links";
import { contactsFromCsv } from "@/lib/referrals/csv";
import { generateReferralMessage, matchCompanies, referralFacts } from "@/lib/referrals/server";
import type { ReferralLang } from "@/lib/referrals/message";
import { requireUser } from "@/lib/session";

const STATUSES: ReferralStatus[] = ["ASKED", "AGREED", "SUBMITTED", "ANSWERED", "DECLINED"];

function revalidate() {
  revalidatePath("/referrals");
  revalidatePath("/jobs");
  revalidatePath("/companies", "layout");
}

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional().default(""),
  email: z
    .union([z.literal(""), z.string().trim().email().max(200)])
    .optional()
    .default(""),
  linkedinUrl: z.string().trim().max(300).optional().default(""),
  relationship: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export type ContactInput = z.input<typeof contactSchema>;

export async function addReferralContact(input: ContactInput): Promise<{ ok: true; id: string } | { error: string }> {
  const user = await requireUser();
  const p = contactSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues.some((i) => i.path[0] === "email") ? "email" : "name" };
  const d = p.data;
  if (d.linkedinUrl && !isLinkedinProfileUrl(d.linkedinUrl)) return { error: "linkedin" };
  const companyId = (await matchCompanies([d.company])).get(d.company) ?? null;
  const c = await db.contact.create({
    data: {
      userId: user.id,
      name: d.name,
      companyId,
      companyName: d.company,
      title: d.title || null,
      email: d.email ? d.email.toLowerCase() : null,
      linkedinUrl: d.linkedinUrl || null,
      relationship: d.relationship || null,
      notes: d.notes || null,
      category: "PEER",
      insider: true,
    },
    select: { id: true },
  });
  track("referral_contact_added", { matched: companyId ? 1 : 0 });
  revalidate();
  return { ok: true, id: c.id };
}

/** CSV import: upsert by (name, company) among the user's insider contacts. */
export async function importReferralContacts(
  csv: string,
): Promise<{ added: number; updated: number; skipped: number } | { error: string }> {
  const user = await requireUser();
  if (typeof csv !== "string") return { error: "no_header" };
  const res = contactsFromCsv(csv);
  if (res.error) return { error: res.error };
  const matched = await matchCompanies(res.contacts.map((c) => c.company));
  const existing = await db.contact.findMany({
    where: { userId: user.id, insider: true },
    select: { id: true, name: true, companyName: true },
    take: 5000,
  });
  const key = (n: string, c: string | null) => `${n.trim().toLowerCase()}|${(c ?? "").trim().toLowerCase()}`;
  const byKey = new Map(existing.map((e) => [key(e.name, e.companyName), e.id]));
  let added = 0;
  let updated = 0;
  for (const c of res.contacts) {
    const data = {
      companyId: matched.get(c.company) ?? null,
      companyName: c.company,
      title: c.title || null,
      linkedinUrl: c.linkedinUrl,
      email: c.email,
      ...(c.relationship ? { relationship: c.relationship } : {}),
      ...(c.notes ? { notes: c.notes } : {}),
    };
    const id = byKey.get(key(c.name, c.company));
    if (id) {
      await db.contact.update({ where: { id }, data });
      updated++;
    } else {
      await db.contact.create({ data: { ...data, userId: user.id, name: c.name, category: "PEER", insider: true } });
      added++;
    }
  }
  track("referral_contacts_imported", { added, updated, skipped: res.skipped.length });
  revalidate();
  return { added, updated, skipped: res.skipped.length };
}

/** From /outreach: an accepted connection becomes a referral contact ("יש לך מכר בפנים"). */
export async function markAsInsider(contactId: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const c = await db.contact.findFirst({
    where: { id: contactId, userId: user.id },
    select: { id: true, companyName: true, company: { select: { name: true } } },
  });
  if (!c) return { error: "not_found" };
  await db.contact.update({
    where: { id: c.id },
    data: { insider: true, companyName: c.companyName ?? c.company?.name ?? null },
  });
  track("referral_contact_added", { from: "outreach" });
  revalidate();
  revalidatePath("/outreach");
  return { ok: true };
}

export async function removeReferralContact(contactId: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const c = await db.contact.findFirst({
    where: { id: contactId, userId: user.id },
    select: { id: true, sentAt: true },
  });
  if (!c) return { error: "not_found" };
  // Outreach contacts stay in /outreach; manual/imported ones are deleted.
  if (c.sentAt) await db.contact.update({ where: { id: c.id }, data: { insider: false } });
  else await db.contact.delete({ where: { id: c.id } });
  revalidate();
  return { ok: true };
}

async function target(userId: string, applicationId: string | null, jobId: string | null) {
  if (applicationId) {
    const a = await db.application.findFirst({
      where: { id: applicationId, userId },
      select: {
        id: true,
        jobId: true,
        title: true,
        company: true,
        url: true,
        job: { select: { applyUrl: true, techStack: true } },
      },
    });
    if (a)
      return {
        applicationId: a.id,
        jobId: a.jobId,
        title: a.title,
        company: a.company,
        url: a.job?.applyUrl ?? a.url,
        techStack: a.job?.techStack ?? [],
      };
  }
  if (jobId) {
    const j = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, applyUrl: true, techStack: true, company: { select: { name: true } } },
    });
    if (j)
      return {
        applicationId: null,
        jobId: j.id,
        title: j.title,
        company: j.company.name,
        url: j.applyUrl,
        techStack: j.techStack,
      };
  }
  return { applicationId: null, jobId: null, title: null, company: null, url: null, techStack: [] as string[] };
}

export async function draftReferralRequest(input: {
  contactId: string;
  applicationId?: string | null;
  jobId?: string | null;
  lang: ReferralLang;
}): Promise<{ body: string; source: "ai" | "template" | "limited" } | { error: string }> {
  const user = await requireUser();
  if (!["he", "en"].includes(input.lang)) return { error: "invalid" };
  const contact = await db.contact.findFirst({
    where: { id: input.contactId, userId: user.id },
    select: { name: true, relationship: true, companyName: true, company: { select: { name: true } } },
  });
  if (!contact) return { error: "not_found" };
  const t = await target(user.id, input.applicationId ?? null, input.jobId ?? null);
  const facts = await referralFacts(user.id, contact, t);
  const msg = await generateReferralMessage(user.id, facts, input.lang);
  track("referral_draft", { lang: input.lang, source: msg.source });
  return msg;
}

/** "שלחתי": start tracking a referral request (one open request per contact + application). */
export async function createReferral(input: {
  contactId: string;
  applicationId?: string | null;
  jobId?: string | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const user = await requireUser();
  const contact = await db.contact.findFirst({ where: { id: input.contactId, userId: user.id }, select: { id: true } });
  if (!contact) return { error: "not_found" };
  const t = await target(user.id, input.applicationId ?? null, input.jobId ?? null);
  const open = await db.referral.findFirst({
    where: {
      userId: user.id,
      contactId: contact.id,
      applicationId: t.applicationId,
      jobId: t.applicationId ? undefined : t.jobId,
      status: { in: ["ASKED", "AGREED", "SUBMITTED"] },
    },
    select: { id: true },
  });
  if (open) return { ok: true, id: open.id };
  const r = await db.referral.create({
    data: { userId: user.id, contactId: contact.id, applicationId: t.applicationId, jobId: t.jobId },
    select: { id: true },
  });
  track("referral_requested", { linked: t.applicationId ? 1 : 0 });
  revalidate();
  return { ok: true, id: r.id };
}

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES as [ReferralStatus, ...ReferralStatus[]]).optional(),
  outcome: z.enum(["positive", "negative", ""]).optional(),
  note: z.string().max(1000).optional(),
  applicationId: z.string().nullable().optional(),
  followedUp: z.boolean().optional(),
});

export async function updateReferral(input: z.input<typeof updateSchema>): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const p = updateSchema.safeParse(input);
  if (!p.success) return { error: "invalid" };
  const d = p.data;
  const r = await db.referral.findFirst({ where: { id: d.id, userId: user.id }, select: { id: true, status: true } });
  if (!r) return { error: "not_found" };
  if (d.applicationId) {
    const ok = await db.application.findFirst({
      where: { id: d.applicationId, userId: user.id },
      select: { id: true },
    });
    if (!ok) return { error: "invalid" };
  }
  const now = new Date();
  await db.referral.update({
    where: { id: r.id },
    data: {
      ...(d.status && d.status !== r.status ? { status: d.status, statusAt: now } : {}),
      ...(d.outcome !== undefined ? { outcome: d.outcome || null } : {}),
      ...(d.note !== undefined ? { note: d.note.trim() || null } : {}),
      ...(d.applicationId !== undefined ? { applicationId: d.applicationId } : {}),
      ...(d.followedUp ? { followedUpAt: now } : {}),
    },
  });
  if (d.status && d.status !== r.status) track("referral_status", { status: d.status });
  revalidate();
  return { ok: true };
}

export async function deleteReferral(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const res = await db.referral.deleteMany({ where: { id, userId: user.id } });
  if (!res.count) return { error: "not_found" };
  revalidate();
  return { ok: true };
}
