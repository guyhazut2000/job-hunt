/**
 * Private object storage for document bytes.
 *
 * - "blob": Vercel Blob, private store (production; BLOB_READ_WRITE_TOKEN is set by the store's
 *   project connection). Browsers upload straight to Blob with a short-lived client token issued by
 *   /api/documents/upload, so files over the 4.5MB function body limit work.
 * - "local": files under .data/documents (development/tests only, never in production).
 * - null: storage not configured; uploads are disabled with a friendly message.
 *
 * Never log file contents or tokens from here.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageDriver = "blob" | "local";

export function storageDriver(): StorageDriver | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.NODE_ENV !== "production" || process.env.DOCUMENTS_LOCAL_STORAGE === "1") return "local";
  return null;
}

const LOCAL_ROOT = path.join(process.cwd(), ".data");
function localPath(key: string) {
  const p = path.join(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("bad key");
  return p;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>, max: number): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Read a whole object (bounded by `max` bytes). Returns null when missing. */
export async function readObject(key: string, max: number): Promise<Buffer | null> {
  const driver = storageDriver();
  if (driver === "blob") {
    const { get } = await import("@vercel/blob");
    const r = await get(key, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return streamToBuffer(r.stream, max);
  }
  if (driver === "local") {
    try {
      const buf = await readFile(localPath(key));
      if (buf.length > max) throw new Error("too large");
      return buf;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  return null;
}

/** Stream an object for download/preview. */
export async function streamObject(key: string): Promise<ReadableStream<Uint8Array> | null> {
  const driver = storageDriver();
  if (driver === "blob") {
    const { get } = await import("@vercel/blob");
    const r = await get(key, { access: "private" });
    return r && r.statusCode === 200 && r.stream ? r.stream : null;
  }
  if (driver === "local") {
    const buf = await readObject(key, Number.MAX_SAFE_INTEGER);
    if (!buf) return null;
    return new Blob([new Uint8Array(buf)]).stream();
  }
  return null;
}

/** Server-side write (local driver uploads, tests). Blob uploads happen client-side. */
export async function writeObject(key: string, data: Buffer, contentType: string): Promise<void> {
  const driver = storageDriver();
  if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    await put(key, data, { access: "private", contentType, addRandomSuffix: false });
    return;
  }
  if (driver === "local") {
    const p = localPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
    return;
  }
  throw new Error("storage not configured");
}

/** Best-effort delete; a missing object is not an error. */
export async function deleteObject(key: string): Promise<void> {
  const driver = storageDriver();
  try {
    if (driver === "blob") {
      const { del } = await import("@vercel/blob");
      await del(key);
    } else if (driver === "local") {
      await rm(localPath(key), { force: true });
    }
  } catch (e) {
    console.warn("[documents] delete failed", { key, error: (e as Error).name });
  }
}
