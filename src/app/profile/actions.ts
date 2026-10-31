"use server";

import type { Prisma, Seniority, WorkMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guardedLLM } from "@/lib/ai";
import { track } from "@/lib/analytics";
import { ALLOWED_CV_TYPES, extractText, MAX_CV_BYTES, parseCvText } from "@/lib/cv/parse";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { extractProfile } from "@/lib/profile/extract";
import { preferencesSchema, professionalSchema } from "@/lib/profile/schema";
import { totalExperienceYears } from "@/lib/profile/score";
import { requireUser } from "@/lib/session";
import { ROLE_CATEGORIES } from "@/lib/taxonomy";

export type ActionState = { error?: string; ok?: string } | undefined;

function refresh() {
  revalidatePath("/profile");
  revalidatePath("/jobs");
  revalidatePath("/onboarding");
}

/** Save tab 1. Payload is JSON from the client form; validated server-side with zod. */
export async function saveProfessional(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: t.pv2.invalid };
  }
  const parsed = professionalSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${t.pv2.invalid} (${i?.path.join(".")})` };
  }
  const d = parsed.data;
  const years = totalExperienceYears(d.experience);
  const data = {
    headline: d.headline || null,
    summary: d.summary || null,
    experience: d.experience as Prisma.InputJsonValue,
    skillItems: d.skillItems as Prisma.InputJsonValue,
    education: d.education as Prisma.InputJsonValue,
    languages: d.languages as Prisma.InputJsonValue,
    linkedinUrl: d.linkedinUrl || null,
    githubUrl: d.githubUrl || null,
    portfolioUrl: d.portfolioUrl || null,
    phone: d.phone || null,
    projects: d.projects as Prisma.InputJsonValue,
    volunteering: d.volunteering as Prisma.InputJsonValue,
    customSections: d.customSections as Prisma.InputJsonValue,
    // keep v1 columns in sync for older readers (filters, CV tips)
    skills: [...new Set(d.skillItems.map((s) => s.name))].slice(0, 80),
    ...(years != null ? { yearsExperience: Math.round(years) } : {}),
  };
  await db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });

  const resumeId = String(formData.get("resumeId") ?? "");
  if (resumeId) {
    await db.resume.updateMany({ where: { id: resumeId, userId: user.id }, data: { appliedAt: new Date() } });
    // First confirmation also seeds empty preferences with the extracted guesses.
    const r = await db.resume.findFirst({ where: { id: resumeId, userId: user.id }, select: { extracted: true } });
    const x = (r?.extracted ?? {}) as { targetRoles?: string[]; targetSeniorities?: Seniority[] };
    const p = await db.profile.findUniqueOrThrow({ where: { userId: user.id } });
    const roles = (x.targetRoles ?? []).filter((v) => (ROLE_CATEGORIES as readonly string[]).includes(v));
    await db.profile.update({
      where: { userId: user.id },
      data: {
        ...(p.targetRoles.length === 0 && roles.length ? { targetRoles: roles } : {}),
        ...(p.targetSeniorities.length === 0 && x.targetSeniorities?.length
          ? { targetSeniorities: x.targetSeniorities }
          : {}),
      },
    });
    track("cv_extraction_confirmed");
  }
  refresh();
  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  return { ok: t.profile.saved };
}

const many = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean);
const intOrNull = (v: FormDataEntryValue | null) => {
  const n = Number.parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
const tagList = (v: FormDataEntryValue | null) => [
  ...new Set(
    String(v ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

/** Save tab 2 (also onboarding step 3). */
export async function savePreferences(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const parsed = preferencesSchema.safeParse({
    targetRoles: many(formData, "targetRoles").filter((r) => (ROLE_CATEGORIES as readonly string[]).includes(r)),
    targetSeniorities: many(formData, "targetSeniorities"),
    regions: many(formData, "regions"),
    workModes: many(formData, "workModes"),
    salaryMin: intOrNull(formData.get("salaryMin")),
    salaryMax: intOrNull(formData.get("salaryMax")),
    companyTypes: many(formData, "companyTypes"),
    wantedTech: tagList(formData.get("wantedTech")),
    avoidTech: tagList(formData.get("avoidTech")),
    availability: String(formData.get("availability") ?? "") || null,
  });
  if (!parsed.success) {
    const salary = parsed.error.issues.some((i) => i.path[0] === "salaryMax");
    return { error: salary ? t.pv2.salaryError : t.pv2.invalid };
  }
  const d = parsed.data;
  const data = {
    ...d,
    targetSeniorities: d.targetSeniorities as Seniority[],
    workModes: d.workModes as WorkMode[],
    // v1 mirrors
    desiredRole: d.targetRoles[0] ?? null,
    seniority: (d.targetSeniorities[0] as Seniority | undefined) ?? null,
    workMode: d.workModes.length === 1 ? (d.workModes[0] as WorkMode) : null,
    ...(formData.get("onboarding") ? { onboardedAt: new Date() } : {}),
  };
  await db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  refresh();
  if (formData.get("onboarding")) {
    track("onboarding_completed");
    redirect("/jobs?welcome=1");
  }
  return { ok: t.profile.saved };
}

/** Upload a CV version: keep the original bytes, extract text + structured profile, then go to review. */
const MAX_CV_VERSIONS = 10;
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export async function uploadCvVersion(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: t.pv2.noFile };
  if (file.size > MAX_CV_BYTES) return { error: t.pv2.tooLarge };
  // Some browsers send an empty type for .docx/.txt; fall back to the extension.
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const mime = file.type || (EXT_MIME[ext] ?? "");
  if (!(ALLOWED_CV_TYPES as readonly string[]).includes(mime)) return { error: t.pv2.badType };
  const count = await db.resume.count({ where: { userId: user.id } });
  if (count >= MAX_CV_VERSIONS) return { error: t.pv2.tooMany };
  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractText(buf, mime);
  } catch {
    return { error: t.pv2.unreadable };
  }
  const parsed = parseCvText(text);
  const extracted = await extractProfile(parsed.text, await guardedLLM("cv_extract", user.id));
  const makeDefault = count === 0 || formData.get("makeDefault") === "on";
  const label =
    String(formData.get("label") ?? "")
      .trim()
      .slice(0, 80) || null;

  const resume = await db.$transaction(async (tx) => {
    if (makeDefault) await tx.resume.updateMany({ where: { userId: user.id }, data: { isPrimary: false } });
    return tx.resume.create({
      data: {
        userId: user.id,
        fileName: file.name.slice(0, 200),
        mimeType: mime,
        sizeBytes: file.size,
        text: parsed.text.slice(0, 50_000),
        skills: extracted.skillItems.map((s) => s.name),
        isPrimary: makeDefault,
        label,
        extracted: extracted as unknown as Prisma.InputJsonValue,
        file: { create: { data: buf } },
      },
      select: { id: true },
    });
  });
  track("cv_uploaded", { mime, skills: extracted.skillItems.length, source: extracted.source });
  refresh();
  redirect(formData.get("onboarding") ? `/onboarding?step=2&cv=${resume.id}` : `/profile/review/${resume.id}`);
}

export async function setDefaultCv(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const owned = await db.resume.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return;
  await db.$transaction([
    db.resume.updateMany({ where: { userId: user.id }, data: { isPrimary: false } }),
    db.resume.update({ where: { id }, data: { isPrimary: true } }),
  ]);
  refresh();
}

export async function deleteCv(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const r = await db.resume.findFirst({ where: { id, userId: user.id }, select: { isPrimary: true } });
  if (!r) return;
  await db.resume.delete({ where: { id } });
  if (r.isPrimary) {
    const next = await db.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    if (next) await db.resume.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  refresh();
}

export async function skipOnboarding() {
  const user = await requireUser();
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, skills: [], onboardedAt: new Date() },
    update: { onboardedAt: new Date() },
  });
  redirect("/jobs");
}
