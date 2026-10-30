"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { interviewStrings } from "@/lib/i18n/interview";
import { advanceSession, createInterviewSession, finishSession } from "@/lib/interview/server";
import { isMode } from "@/lib/interview/types";
import { looksLikeSecret } from "@/lib/learning/tutor";
import { requireUser } from "@/lib/session";

export type StartState = { error?: string } | undefined;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Start a session for a job (`job`) or application (`app`; or `target` = "app:<id>" / "job:<id>"). */
export async function startInterviewAction(_: StartState, formData: FormData): Promise<StartState> {
  const user = await requireUser();
  const locale = await getLocale();
  const t = interviewStrings(locale);
  let jobId = str(formData.get("job"));
  let applicationId = str(formData.get("app"));
  const target = str(formData.get("target"));
  if (target?.startsWith("app:")) applicationId = target.slice(4);
  else if (target?.startsWith("job:")) jobId = target.slice(4);
  const mode = str(formData.get("mode"));
  const lang = str(formData.get("language"));
  if (!isMode(mode) || (!jobId && !applicationId)) return { error: t.notFound };
  const res = await createInterviewSession(user.id, {
    jobId,
    applicationId,
    mode,
    language: lang === "en" ? "en" : lang === "he" ? "he" : locale,
  });
  if (!res) return { error: t.notFound };
  revalidatePath("/interview");
  redirect(`/interview/${res.id}${res.reason ? `?limit=${res.reason}` : ""}`);
}

export type TurnResult = { ok: boolean; done: boolean; limit?: string; error?: string };

export async function answerAction(id: string, answer: string): Promise<TurnResult> {
  const user = await requireUser();
  if (looksLikeSecret(answer)) return { ok: false, done: false, error: interviewStrings(await getLocale()).secret };
  const r = await advanceSession(user.id, id, { answer });
  revalidatePath(`/interview/${id}`);
  return { ok: r.ok, done: r.done, limit: r.reason };
}

export async function skipAction(id: string): Promise<TurnResult> {
  const user = await requireUser();
  const r = await advanceSession(user.id, id, { skip: true });
  revalidatePath(`/interview/${id}`);
  return { ok: r.ok, done: r.done, limit: r.reason };
}

export async function finishAction(id: string): Promise<TurnResult> {
  const user = await requireUser();
  const r = await finishSession(user.id, id);
  revalidatePath(`/interview/${id}`);
  revalidatePath("/interview");
  return { ok: !!r, done: !!r, limit: r?.reason };
}

export async function deleteInterviewAction(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id) await db.interviewSession.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/interview");
  redirect("/interview");
}
