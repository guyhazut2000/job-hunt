/**
 * Documents: server helpers (DB). The future apply flow should only use `getAttachableDocuments`
 * and `sanitizeSelection` (picker.ts) — see docs/documents.md.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { GRAPH, learnedSkillItem, resolveSkill } from "@/lib/learning/graph";
import { parseList, skillItem } from "@/lib/profile/schema";
import type { DocumentTypeKey } from "./constants";
import type { AttachableDocument } from "./picker";
import { expiryStatus, type QuotaState } from "./validate";

/**
 * Everything a user can attach to an application, newest first: Document rows plus profile CVs
 * (Resume rows that still have their original file). Pass `types` to narrow (e.g. ["CV","TRANSCRIPT"]).
 * Never returns file bytes or storage keys; fetch files through /api/documents/[id]/file or /api/cv/[id].
 */
export async function getAttachableDocuments(userId: string, types?: DocumentTypeKey[]): Promise<AttachableDocument[]> {
  const wanted = types?.length ? types : undefined;
  const now = new Date();
  const [docs, cvs] = await Promise.all([
    db.document.findMany({
      where: { userId, ...(wanted ? { type: { in: wanted } } : {}) },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        isDefault: true,
        expiryDate: true,
        createdAt: true,
      },
    }),
    !wanted || wanted.includes("CV")
      ? db.resume.findMany({
          where: { userId, file: { isNot: null } },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            label: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            isPrimary: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  return [
    ...cvs.map((r): AttachableDocument => ({
      ref: `cv:${r.id}`,
      id: r.id,
      source: "resume",
      type: "CV",
      title: r.label || r.fileName,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      isDefault: r.isPrimary,
      expired: false,
      createdAt: r.createdAt.toISOString(),
    })),
    ...docs.map((d): AttachableDocument => ({
      ref: `doc:${d.id}`,
      id: d.id,
      source: "document",
      type: d.type,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      isDefault: d.isDefault,
      expired: expiryStatus(d.expiryDate, now) === "expired",
      createdAt: d.createdAt.toISOString(),
    })),
  ];
}

/** Current usage for quota/rate checks. */
export async function quotaState(userId: string, uploadsPerHour = 30): Promise<QuotaState & { limit: number }> {
  const since = new Date(Date.now() - 3_600_000);
  const [agg, recentUploads] = await Promise.all([
    db.document.aggregate({ where: { userId }, _sum: { sizeBytes: true }, _count: true }),
    // Files created or replaced in the last hour.
    db.document.count({ where: { userId, uploadedAt: { gte: since } } }),
  ]);
  return { usedBytes: agg._sum.sizeBytes ?? 0, count: agg._count, recentUploads, limit: uploadsPerHour };
}

/** Keep only known learning-graph node ids. */
export const validSkillIds = (ids: string[]) => [...new Set(ids.filter((id) => GRAPH.byId.has(id)))].slice(0, 20);

/**
 * A certification proves skills: add the ones missing from the profile at BASIC level.
 * Returns the labels added. Never removes anything.
 */
export async function addCertifiedSkills(userId: string, skillIds: string[]): Promise<string[]> {
  const ids = validSkillIds(skillIds);
  if (!ids.length) return [];
  const p = await db.profile.findUnique({ where: { userId } });
  const items = parseList(skillItem, p?.skillItems ?? []);
  const have = new Set(
    [...items.map((s) => s.name), ...(p?.skills ?? [])].map((n) => resolveSkill(n)?.id).filter(Boolean) as string[],
  );
  const nodes = ids.filter((id) => !have.has(id)).map((id) => GRAPH.byId.get(id)!);
  if (!nodes.length) return [];
  const nextItems = [...items, ...nodes.map(learnedSkillItem)].slice(0, 80);
  const nextSkills = [...new Set([...(p?.skills ?? []), ...nodes.map((n) => n.label)])].slice(0, 80);
  const data = { skillItems: nextItems as Prisma.InputJsonValue, skills: nextSkills };
  await db.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return nodes.map((n) => n.label);
}
