"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { GRAPH, learnedSkillItem, resolveSkill } from "@/lib/learning/graph";
import { parseList, skillItem } from "@/lib/profile/schema";
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

const norm = (s: string) => s.trim().toLowerCase();

/** Remove a learned skill from the profile (only called for skills this feature added). */
async function removeFromProfile(userId: string, label: string) {
  const p = await db.profile.findUnique({ where: { userId } });
  if (!p) return;
  const items = parseList(skillItem, p.skillItems).filter((s) => norm(s.name) !== norm(label));
  await db.profile.update({
    where: { userId },
    data: {
      skillItems: items as Prisma.InputJsonValue,
      skills: p.skills.filter((s) => norm(s) !== norm(label)),
    },
  });
}

/** Add a learned skill (BASIC) unless the profile already covers that node by any alias. Returns true if added. */
async function addToProfile(userId: string, skillId: string): Promise<boolean> {
  const node = GRAPH.byId.get(skillId)!;
  const p = await db.profile.findUnique({ where: { userId } });
  const items = parseList(skillItem, p?.skillItems ?? []);
  const names = [...items.map((s) => s.name), ...(p?.skills ?? [])];
  if (names.some((n) => resolveSkill(n)?.id === skillId)) return false;
  const nextItems = [...items, learnedSkillItem(node)].slice(0, 80);
  const nextSkills = [...new Set([...(p?.skills ?? []), node.label])].slice(0, 80);
  const data = { skillItems: nextItems as Prisma.InputJsonValue, skills: nextSkills };
  await db.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return true;
}

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
  const node = GRAPH.byId.get(skill);
  if (!node) return { ok: false, error: "invalid" };

  const prev = await db.skillProgress.findUnique({ where: { userId_skill: { userId: user.id, skill } } });
  let added = false;

  if (status !== "DONE" && prev?.addedToProfile) await removeFromProfile(user.id, node.label);

  if (status === "NONE") {
    if (prev) await db.skillProgress.delete({ where: { id: prev.id } });
  } else {
    let addedToProfile = false;
    if (status === "DONE") {
      if (prev?.status === "DONE") addedToProfile = prev.addedToProfile;
      else addedToProfile = added = await addToProfile(user.id, skill);
    }
    const data = { status, proofUrl: proofUrl || null, addedToProfile };
    await db.skillProgress.upsert({
      where: { userId_skill: { userId: user.id, skill } },
      create: { userId: user.id, skill, ...data },
      update: data,
    });
  }

  for (const p of ["/learn", `/learn/${skill}`, "/jobs", "/profile", "/dashboard"]) revalidatePath(p);
  revalidatePath("/jobs/[id]", "page");
  return { ok: true, added };
}
