"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cvDocSchema } from "@/lib/cv-tailor/schema";
import { generateTailoredCv, resolveTarget, saveEditedVersion } from "@/lib/cv-tailor/server";
import type { CvDoc } from "@/lib/cv-tailor/types";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { requireUser } from "@/lib/session";

export type GenerateState = { error?: string } | undefined;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Create a tailored version for a job (?job) or application (?app) and open it. */
export async function generateTailoredAction(_: GenerateState, formData: FormData): Promise<GenerateState> {
  const user = await requireUser();
  const locale = await getLocale();
  const t = cvTailorStrings(locale);
  const jobText = str(formData.get("jobText"));
  const resolved = await resolveTarget(
    user.id,
    { jobId: str(formData.get("job")), applicationId: str(formData.get("app")) },
    jobText,
  );
  if (!resolved) return { error: t.notFound };
  if (resolved.needsText) return { error: t.needsText };
  const lang = str(formData.get("language"));
  const res = await generateTailoredCv(user.id, resolved, {
    language: lang === "he" || lang === "en" ? lang : null,
    jobText,
    uiLocale: locale,
  });
  revalidatePath("/profile");
  const q = new URLSearchParams();
  if (res.reverted) q.set("reverted", String(res.reverted));
  if (res.reason) q.set("limit", res.reason);
  redirect(`/cv/tailor/${res.id}${q.size ? `?${q}` : ""}`);
}

export type SaveResult = { id?: string; error?: string };

/** Save the editor's content as a new version. */
export async function saveTailoredAction(id: string, doc: CvDoc): Promise<SaveResult> {
  const user = await requireUser();
  const t = cvTailorStrings(await getLocale());
  const parsed = cvDocSchema.safeParse(doc);
  if (!parsed.success) return { error: t.saveError };
  const newId = await saveEditedVersion(user.id, id, parsed.data);
  if (!newId) return { error: t.notFound };
  revalidatePath("/profile");
  return { id: newId };
}

export async function deleteTailoredAction(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;
  const row = await db.tailoredCv.findFirst({
    where: { id, userId: user.id },
    select: { jobId: true, applicationId: true },
  });
  if (!row) return;
  await db.tailoredCv.delete({ where: { id } });
  revalidatePath("/profile");
  redirect(
    row.jobId
      ? `/cv/tailor?job=${row.jobId}`
      : row.applicationId
        ? `/cv/tailor?app=${row.applicationId}`
        : "/profile?tab=documents",
  );
}
