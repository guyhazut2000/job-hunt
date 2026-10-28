import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseList, skillItem } from "@/lib/profile/schema";
import { GRAPH, learnedSkillItem, resolveSkill } from "./graph";

/** Server-only core of skill status changes (shared by /learn and the stage workspace). */

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

export type SkillStatusValue = "NONE" | "LEARNING" | "DONE";

/**
 * Set a skill's status for a user. DONE adds it to the profile (so match scores recalculate);
 * leaving DONE removes only what this feature added. `proofUrl` undefined keeps the stored one.
 * Returns whether the skill was added to the profile.
 */
export async function applySkillStatus(
  userId: string,
  skill: string,
  status: SkillStatusValue,
  proofUrl?: string,
): Promise<boolean> {
  const node = GRAPH.byId.get(skill);
  if (!node) return false;
  const prev = await db.skillProgress.findUnique({ where: { userId_skill: { userId, skill } } });
  let added = false;

  if (status !== "DONE" && prev?.addedToProfile) await removeFromProfile(userId, node.label);

  if (status === "NONE") {
    if (prev) await db.skillProgress.delete({ where: { id: prev.id } });
  } else {
    let addedToProfile = false;
    if (status === "DONE") {
      if (prev?.status === "DONE") addedToProfile = prev.addedToProfile;
      else addedToProfile = added = await addToProfile(userId, skill);
    }
    const proof = proofUrl === undefined ? (prev?.proofUrl ?? null) : proofUrl || null;
    const data = { status, proofUrl: proof, addedToProfile };
    await db.skillProgress.upsert({
      where: { userId_skill: { userId, skill } },
      create: { userId, skill, ...data },
      update: data,
    });
  }
  return added;
}

export function revalidateLearning(skill: string) {
  for (const p of ["/learn", "/learn/me", `/learn/${skill}`, "/jobs", "/profile", "/dashboard"]) revalidatePath(p);
  revalidatePath("/learn/[skill]/[stage]", "page");
  revalidatePath("/jobs/[id]", "page");
}
