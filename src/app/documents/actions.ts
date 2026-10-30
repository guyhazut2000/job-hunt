"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MAX_DOCUMENT_BYTES, UPLOAD_TYPES, UPLOADS_PER_HOUR, type DocumentTypeKey } from "@/lib/documents/constants";
import { addCertifiedSkills, quotaState, validSkillIds } from "@/lib/documents/server";
import { signedFileUrl } from "@/lib/documents/signing";
import { deleteObject, readObject } from "@/lib/documents/storage";
import {
  checkQuota,
  extOf,
  metadataSchema,
  ownsKey,
  titleFromFileName,
  verifyBytes,
  type UploadError,
} from "@/lib/documents/validate";
import { requireUser } from "@/lib/session";

type Fail = { ok: false; error: UploadError | "storage" | "invalid" | "notFound" | "generic" | "expiryBeforeIssue" };

function refresh() {
  revalidatePath("/profile");
}

/** Keep a display-safe base name; the extension always comes from the verified storage key. */
function safeFileName(name: string, keyExt: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"<>|]/g, "")
    .replace(/\.[^.]*$/, "")
    .trim()
    .slice(0, 150);
  return `${base || "document"}.${keyExt}`;
}

/**
 * Turn an uploaded object into a Document after verifying the stored bytes (magic bytes, size,
 * quota). Upload bytes always come from storage, never from the client. With `replaceId`, the file
 * of an existing document is swapped (version + 1) and the old object deleted.
 */
export async function finalizeDocument(input: {
  key: string;
  fileName: string;
  type?: string;
  replaceId?: string;
}): Promise<{ ok: true; id: string } | Fail> {
  const user = await requireUser();
  const key = String(input.key ?? "");
  if (!ownsKey(user.id, key)) return { ok: false, error: "invalid" };
  const keyExt = extOf(key);
  const fileName = safeFileName(String(input.fileName ?? ""), keyExt);

  const cleanup = async (error: Fail["error"]): Promise<Fail> => {
    await deleteObject(key);
    return { ok: false, error };
  };

  if (await db.document.findUnique({ where: { storageKey: key }, select: { id: true } })) {
    return { ok: false, error: "invalid" };
  }
  const existing = input.replaceId
    ? await db.document.findFirst({ where: { id: input.replaceId, userId: user.id } })
    : null;
  if (input.replaceId && !existing) return cleanup("notFound");
  const type = (existing?.type ?? input.type) as DocumentTypeKey;
  if (!existing && !(UPLOAD_TYPES as readonly string[]).includes(type)) return cleanup("invalid");

  let bytes: Buffer | null;
  try {
    bytes = await readObject(key, MAX_DOCUMENT_BYTES);
  } catch (e) {
    return cleanup((e as Error).message === "too large" ? "tooLarge" : "storage");
  }
  if (!bytes) return { ok: false, error: "storage" };

  const verdict = verifyBytes(fileName, bytes);
  if (!verdict.ok) return cleanup(verdict.error);

  const quotaErr = checkQuota(await quotaState(user.id), bytes.length, existing?.sizeBytes ?? 0, UPLOADS_PER_HOUR);
  if (quotaErr) return cleanup(quotaErr);

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = {
    fileName,
    mimeType: verdict.mime,
    sizeBytes: bytes.length,
    sha256,
    storageKey: key,
    uploadedAt: new Date(),
  };

  try {
    if (existing) {
      const oldKey = existing.storageKey;
      await db.document.update({ where: { id: existing.id }, data: { ...file, version: { increment: 1 } } });
      await deleteObject(oldKey);
      refresh();
      return { ok: true, id: existing.id };
    }
    const hasOfType = await db.document.count({ where: { userId: user.id, type } });
    const doc = await db.document.create({
      data: { userId: user.id, type, title: titleFromFileName(fileName), isDefault: hasOfType === 0, ...file },
      select: { id: true },
    });
    refresh();
    return { ok: true, id: doc.id };
  } catch (e) {
    console.error("[documents] finalize failed", { name: (e as Error).name });
    return cleanup("generic");
  }
}

export interface MetadataInput {
  type: string;
  title: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  language?: string;
  tags?: string;
  notes?: string;
  skills?: string[];
}

/** Edit a document's details. Certification skills not yet on the profile are added to it. */
export async function updateDocument(
  id: string,
  input: MetadataInput,
): Promise<{ ok: true; skillsAdded: string[] } | (Fail & { field?: string })> {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, userId: user.id }, select: { id: true, type: true } });
  if (!doc) return { ok: false, error: "notFound" };
  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message === "expiryBeforeIssue" ? "expiryBeforeIssue" : "invalid",
      field: String(issue?.path[0] ?? ""),
    };
  }
  const m = parsed.data;
  const type = m.type as DocumentTypeKey;
  const skills = type === "CERTIFICATION" ? validSkillIds(m.skills) : [];
  const typeChanged = type !== doc.type;
  const otherDefault = typeChanged ? await db.document.count({ where: { userId: user.id, type, isDefault: true } }) : 1;
  await db.document.update({
    where: { id: doc.id },
    data: {
      type,
      title: m.title,
      issuer: m.issuer,
      issueDate: m.issueDate,
      expiryDate: m.expiryDate,
      language: m.language,
      tags: m.tags,
      notes: m.notes,
      skills,
      ...(typeChanged ? { isDefault: otherDefault === 0 } : {}),
    },
  });
  const skillsAdded = skills.length ? await addCertifiedSkills(user.id, skills) : [];
  refresh();
  if (skillsAdded.length) revalidatePath("/profile");
  return { ok: true, skillsAdded };
}

/** Make this the default document of its type (used to preselect it when applying). */
export async function setDefaultDocument(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, userId: user.id }, select: { id: true, type: true } });
  if (!doc) return { ok: false };
  await db.$transaction([
    db.document.updateMany({ where: { userId: user.id, type: doc.type }, data: { isDefault: false } }),
    db.document.update({ where: { id: doc.id }, data: { isDefault: true } }),
  ]);
  refresh();
  return { ok: true };
}

/** Delete the row and its stored file. The next newest of the type becomes default. */
export async function deleteDocument(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return { ok: false };
  await db.document.delete({ where: { id: doc.id } });
  await deleteObject(doc.storageKey);
  if (doc.isDefault) {
    const next = await db.document.findFirst({
      where: { userId: user.id, type: doc.type },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (next) await db.document.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  refresh();
  return { ok: true };
}

/** A fresh short-lived URL for previewing or downloading one of the caller's documents. */
export async function documentFileUrl(id: string, download = false): Promise<string | null> {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  return doc ? signedFileUrl(doc.id, user.id, { download }) : null;
}
