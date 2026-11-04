"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { criteriaJson, normalizePrefs, prefsSchema, type PrefsInput, type RankingPrefs } from "@/lib/ranking/personal";

export async function saveRankingPrefs(input: PrefsInput): Promise<{ ok: true; prefs: RankingPrefs } | { ok: false }> {
  const user = await requireUser("/jobs/ranking");
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const prefs = normalizePrefs(parsed.data);
  const data = {
    include: prefs.include,
    exclude: prefs.exclude,
    weights: prefs.weights,
    defaultSort: prefs.defaultSort,
    criteria: criteriaJson(prefs),
  };
  await db.rankingPrefs.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  revalidatePath("/jobs");
  revalidatePath("/jobs/ranking");
  return { ok: true, prefs };
}
