"use server";

import { revalidatePath } from "next/cache";
import { requireCvStandard, standardUrl } from "@/lib/cv-standard/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isTemplateId } from "@/lib/cv-templates/templates";
import { requireUser } from "@/lib/session";
import { ONBOARDING_STEPS } from "@/lib/profile/onboarding";

/** Last onboarding step: store the chosen CV template and finish. */
export async function finishOnboarding(formData: FormData) {
  const user = await requireUser("/onboarding");
  const template = formData.get("template");
  // The chosen template is what the one-page check renders, so save it before checking.
  if (isTemplateId(template))
    await db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, skills: [], cvTemplate: template },
      update: { cvTemplate: template },
    });
  // Mandatory CV standard (#94): onboarding completes only with a CV that meets it.
  if (!(await requireCvStandard(user.id)).ok) redirect(standardUrl("onboarding"));
  const data = {
    ...(isTemplateId(template) ? { cvTemplate: template } : {}),
    onboardedAt: new Date(),
    onboardingStep: ONBOARDING_STEPS,
  };
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, skills: [], ...data },
    update: data,
  });
  revalidatePath("/cv");
  revalidatePath("/profile");
  redirect("/jobs?welcome=1");
}
