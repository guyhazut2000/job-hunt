"use server";

import { revalidatePath } from "next/cache";
import { generateDigest } from "@/lib/digest/run";
import { requireUser } from "@/lib/session";

export type GenerateDigestState = { ok?: boolean; id?: string; sent?: boolean; error?: string } | undefined;

/** "Generate now": build (or refresh) today's digest for the signed-in user and send it unless empty. */
export async function generateDigestNow(): Promise<GenerateDigestState> {
  const user = await requireUser();
  try {
    const r = await generateDigest(user.id, new Date());
    revalidatePath("/digest");
    revalidatePath(`/digest/${r.id}`);
    return { ok: true, id: r.id, sent: r.sent };
  } catch {
    return { error: "failed" };
  }
}
