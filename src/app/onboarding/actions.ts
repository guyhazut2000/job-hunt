"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isTemplateId } from "@/lib/cv-templates/templates";
import { requireUser } from "@/lib/session";
import { ONBOARDING_STEPS } from "@/lib/profile/onboarding";

/** Last onboarding step: store the chosen CV template and finish. */
export async function finishOnboarding(formData: FormData) {
  const user = await requireUser("/onboarding");
  const template = formData.get("template");
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
