"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { layoutSchema } from "@/lib/cv-templates/sections";
import { isTemplateId } from "@/lib/cv-templates/templates";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type CvActionResult = { ok: true } | { ok: false; error: "invalid" };

/** Save one template's layout (order, visibility, renamed headings) for the signed-in user. */
export async function saveCvLayoutAction(template: string, sections: unknown): Promise<CvActionResult> {
  const user = await requireUser("/cv");
  const parsed = layoutSchema.safeParse(sections);
  if (!isTemplateId(template) || !parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data as unknown as Prisma.InputJsonValue;
  await db.cvLayout.upsert({
    where: { userId_template: { userId: user.id, template } },
    create: { userId: user.id, template, sections: data },
    update: { sections: data },
  });
  revalidatePath("/cv");
  return { ok: true };
}

/** Forget the saved layout so the template's default order applies again. */
export async function resetCvLayoutAction(template: string): Promise<CvActionResult> {
  const user = await requireUser("/cv");
  if (!isTemplateId(template)) return { ok: false, error: "invalid" };
  await db.cvLayout.deleteMany({ where: { userId: user.id, template } });
  revalidatePath("/cv");
  return { ok: true };
}

/** The user's default template (shown first in the gallery and used by the onboarding preview). */
export async function setCvTemplateAction(template: string): Promise<CvActionResult> {
  const user = await requireUser("/cv");
  if (!isTemplateId(template)) return { ok: false, error: "invalid" };
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, cvTemplate: template },
    update: { cvTemplate: template },
  });
  revalidatePath("/cv");
  return { ok: true };
}
