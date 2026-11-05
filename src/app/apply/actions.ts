"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { standardUrl } from "@/lib/cv-standard/server";
import { requireUser } from "@/lib/session";
import { editsFromForm, readStoredFields } from "@/lib/auto-apply/fields";
import {
  approveDraft,
  blockCompanyByName,
  prepareDraft,
  saveApplySettings,
  unblockCompany,
  type ApproveResult,
} from "@/lib/auto-apply/server";
import { db } from "@/lib/db";

export async function prepareApply(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "").slice(0, 64);
  const user = await requireUser(jobId ? `/jobs/${jobId}/apply` : "/jobs");
  if (!jobId) redirect("/jobs");
  const created = await prepareDraft(user.id, jobId);
  if (!created) redirect("/jobs");
  revalidatePath("/apply");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}/apply`);
}

export async function approveApply(_prev: ApproveResult | null, formData: FormData): Promise<ApproveResult> {
  const user = await requireUser("/apply");
  const draftId = String(formData.get("draftId") ?? "");
  const row = await db.applyDraft.findFirst({
    where: { id: draftId, userId: user.id },
    select: { jobId: true, fields: true },
  });
  if (!row) return { ok: false, error: "notfound" };
  const result = await approveDraft(user.id, {
    draftId,
    values: editsFromForm(formData, readStoredFields(row.fields)),
    refs: formData.getAll("documents").map(String),
    confirmFlags: formData.get("confirmFlags") === "on",
    override: formData.get("ruleOverride") === "on",
  });
  if (!result.ok && result.error === "cv") redirect(standardUrl("applied"));
  revalidatePath("/apply");
  revalidatePath(`/jobs/${row.jobId}/apply`);
  revalidatePath("/dashboard");
  return result;
}

export async function saveApplySettingsAction(formData: FormData) {
  const user = await requireUser("/apply/settings");
  await saveApplySettings(user.id, {
    minMatchScore: formData.get("minMatchScore"),
    dailyCap: formData.get("dailyCap"),
    fullyAutomatic: formData.get("fullyAutomatic"),
  });
  revalidatePath("/apply/settings");
  redirect("/apply/settings?saved=1");
}

export async function blockCompanyAction(formData: FormData) {
  const user = await requireUser("/apply/settings");
  const result = await blockCompanyByName(user.id, String(formData.get("company") ?? ""));
  revalidatePath("/apply/settings");
  redirect(`/apply/settings?block=${result}`);
}

export async function unblockCompanyAction(formData: FormData) {
  const user = await requireUser("/apply/settings");
  await unblockCompany(user.id, String(formData.get("companyId") ?? ""));
  revalidatePath("/apply/settings");
  redirect("/apply/settings");
}
