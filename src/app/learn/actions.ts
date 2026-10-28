"use server";

import { z } from "zod";
import { GRAPH } from "@/lib/learning/graph";
import { applySkillStatus, revalidateLearning } from "@/lib/learning/status";
import { requireUser } from "@/lib/session";

export type LearnStatusInput = "NONE" | "LEARNING" | "DONE";
export type SetStatusResult = { ok: true; added: boolean } | { ok: false; error: "invalid" | "url" };

const input = z.object({
  skill: z.string().min(1).max(60),
  status: z.enum(["NONE", "LEARNING", "DONE"]),
  proofUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "url")
    .default(""),
});

export async function setSkillStatus(raw: {
  skill: string;
  status: LearnStatusInput;
  proofUrl?: string;
}): Promise<SetStatusResult> {
  const user = await requireUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "proofUrl") ? "url" : "invalid" };
  }
  const { skill, status, proofUrl } = parsed.data;
  if (!GRAPH.byId.has(skill)) return { ok: false, error: "invalid" };
  const added = await applySkillStatus(user.id, skill, status, proofUrl);
  revalidateLearning(skill);
  return { ok: true, added };
}
