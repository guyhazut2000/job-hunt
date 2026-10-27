"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const KEY = /^[\p{L}\p{N}\-_.%]{2,100}$/u;

/**
 * Hide a search result for me, or report it ("not this person / please remove") which hides it for everyone.
 * Reported profiles are filtered out of everyone's results at read time.
 */
export async function suppressPerson(profileKey: string, reason: "HIDDEN" | "REPORTED"): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!KEY.test(profileKey) || (reason !== "HIDDEN" && reason !== "REPORTED")) return { ok: false };
  await db.peopleSearchSuppression.upsert({
    where: { userId_profileKey: { userId: user.id, profileKey } },
    create: { userId: user.id, profileKey, reason },
    // A report always wins over a plain hide.
    update: reason === "REPORTED" ? { reason } : {},
  });
  return { ok: true };
}
