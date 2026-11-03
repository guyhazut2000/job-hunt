"use server";

import { revalidatePath } from "next/cache";
import { generateCoachReport } from "@/lib/coach/run";
import { requireUser } from "@/lib/session";

export type CoachRefreshState = { ok?: boolean; error?: string } | undefined;

/** "Refresh now": rebuild last week's coach report for the signed-in user (no notification). */
export async function refreshCoachNow(): Promise<CoachRefreshState> {
  const user = await requireUser();
  try {
    await generateCoachReport(user.id, new Date(), { send: false });
    revalidatePath("/coach");
    return { ok: true };
  } catch {
    return { error: "failed" };
  }
}
