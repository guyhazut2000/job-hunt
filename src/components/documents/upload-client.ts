"use client";

import { upload } from "@vercel/blob/client";
import { keyPrefix, MIME_FOR_EXT } from "@/lib/documents/constants";
import { extOf } from "@/lib/documents/validate";

export type StorageMode = "blob" | "local" | null;

export class UploadFailure extends Error {}

/**
 * Put the raw file into private storage and return its key. Finalize (server action) then verifies
 * the stored bytes and creates the Document. Blob: direct browser upload with a token from
 * /api/documents/upload. Local: dev-only multipart route.
 */
export async function uploadToStorage(
  file: File,
  opts: { mode: StorageMode; userId: string; replacingBytes?: number; onProgress?: (pct: number) => void },
): Promise<string> {
  if (opts.mode === "local") {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/documents/local-upload", { method: "POST", body: fd });
    const json = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
    if (!res.ok || !json.key) throw new UploadFailure(json.error ?? "generic");
    opts.onProgress?.(100);
    return json.key;
  }
  if (opts.mode !== "blob") throw new UploadFailure("storage");
  const raw = extOf(file.name);
  const ext = raw === "jpeg" ? "jpg" : raw;
  const key = `${keyPrefix(opts.userId)}${crypto.randomUUID()}.${ext}`;
  try {
    const blob = await upload(key, file, {
      access: "private",
      handleUploadUrl: "/api/documents/upload",
      contentType: MIME_FOR_EXT[ext],
      clientPayload: JSON.stringify({ size: file.size, replacingBytes: opts.replacingBytes ?? 0 }),
      multipart: file.size > 5 * 1024 * 1024,
      onUploadProgress: (e) => opts.onProgress?.(Math.round(e.percentage)),
    });
    return blob.pathname;
  } catch (e) {
    const msg = (e as Error).message ?? "";
    const known = ["quota", "tooMany", "rateLimited", "forbidden", "storage"].find((k) => msg.includes(k));
    throw new UploadFailure(known === "forbidden" ? "generic" : (known ?? "generic"));
  }
}
