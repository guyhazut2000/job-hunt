"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { israelLocalToUtc } from "@/lib/notifications/israel-time";
import { requireUser } from "@/lib/session";

export type InterviewState = { ok?: boolean; error?: "invalid" } | undefined;

const form = z.object({
  applicationId: z.string().min(1).max(64),
  at: z.string().max(32).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
  clear: z.string().optional(),
});

/**
 * Set (or clear) the interview date on one of the signed-in user's applications. The input is an
 * Israel wall-clock "YYYY-MM-DDTHH:mm"; reminders fire ~24h and ~2h before (hourly cron).
 */
export async function setInterview(_prev: InterviewState, formData: FormData): Promise<InterviewState> {
  const user = await requireUser();
  const parsed = form.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { applicationId, at, note, clear } = parsed.data;
  let interviewAt: Date | null = null;
  if (!clear) {
    interviewAt = israelLocalToUtc(at);
    if (!interviewAt) return { error: "invalid" };
    // Keep it sane: not more than a day in the past, not more than a year ahead.
    const now = Date.now();
    if (interviewAt.getTime() < now - 86_400_000 || interviewAt.getTime() > now + 366 * 86_400_000)
      return { error: "invalid" };
  }
  const res = await db.application.updateMany({
    where: { id: applicationId, userId: user.id },
    data: { interviewAt, interviewNote: interviewAt ? note || null : null },
  });
  if (res.count === 0) return { error: "invalid" };
  revalidatePath("/dashboard");
  return { ok: true };
}
