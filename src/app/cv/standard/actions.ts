"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { contentStrings } from "@/lib/cv-templates/content";
import { loadCvSource } from "@/lib/cv-templates/server";
import { isTemplateId } from "@/lib/cv-templates/templates";
import { draftSchema, mergeDraft, type Draft } from "@/lib/cv-standard/draft";
import { improveBullet, type ImproveResult } from "@/lib/cv-standard/improve";
import { checkCvStandard } from "@/lib/cv-standard/server";
import { db } from "@/lib/db";
import { readProfessional } from "@/lib/profile/load";
import { totalExperienceYears } from "@/lib/profile/score";
import { requireUser } from "@/lib/session";
import { toCheckView, type CheckView } from "./view";

export type SaveStandardResult = { ok: true; check: CheckView } | { ok: false; error: "invalid"; path?: string };

/** Save the guided editor's draft into the profile, then re-run the full check (real PDF). */
export async function saveStandardAction(draft: Draft): Promise<SaveStandardResult> {
  const user = await requireUser("/cv/standard");
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "invalid", path: parsed.error.issues[0]?.path.join(".") };
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  const merged = mergeDraft(readProfessional(profile), parsed.data);
  if (!merged.ok) return { ok: false, error: "invalid", path: merged.path };
  const d = merged.professional;
  const years = totalExperienceYears(d.experience);
  const data = {
    headline: d.headline || null,
    summary: d.summary || null,
    experience: d.experience as Prisma.InputJsonValue,
    projects: d.projects as Prisma.InputJsonValue,
    skillItems: d.skillItems as Prisma.InputJsonValue,
    skills: [...new Set(d.skillItems.map((s) => s.name))].slice(0, 80),
    linkedinUrl: d.linkedinUrl || null,
    githubUrl: d.githubUrl || null,
    portfolioUrl: d.portfolioUrl || null,
    phone: d.phone || null,
    location: parsed.data.location || null,
    ...(years != null ? { yearsExperience: Math.round(years) } : {}),
  };
  await db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  if (parsed.data.name) await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  const check = await checkCvStandard(user.id);
  revalidatePath("/cv/standard");
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true, check: toCheckView(check) };
}

/** Page check for another template / language (the meter's pickers); does not change the record. */
export async function recheckAction(template: string, lang: "he" | "en" | null): Promise<CheckView> {
  const user = await requireUser("/cv/standard");
  const c = await checkCvStandard(user.id, isTemplateId(template) ? { template, lang } : { lang });
  return toCheckView(c);
}

/** "שפר ניסוח" for one bullet. Never invents facts — see src/lib/cv-standard/improve.ts. */
export async function improveAction(input: {
  text: string;
  lang: "he" | "en";
  section: "experience" | "projects";
  index: number;
  metric?: string;
}): Promise<ImproveResult> {
  const user = await requireUser("/cv/standard");
  const text = String(input.text ?? "").slice(0, 600);
  const metric = input.metric ? String(input.metric).slice(0, 120) : undefined;
  const source = await loadCvSource(user.id);
  const entry = source.content[input.section === "projects" ? "projects" : "experience"][Number(input.index) || 0];
  return improveBullet(
    {
      text,
      lang: input.lang === "en" ? "en" : "he",
      role: entry?.title,
      company: entry?.org,
      metric,
      corpus: contentStrings(source.content).join("\n"),
    },
    user.id,
  );
}
