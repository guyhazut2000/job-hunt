/**
 * Documents: pure validation helpers (no IO) — magic-byte sniffing, upload checks, metadata schema,
 * expiry status and quota math. Unit-tested in tests/documents.test.ts.
 */
import { z } from "zod";
import {
  ALLOWED_MIMES,
  type AllowedMime,
  DOCUMENT_TYPES,
  EXPIRY_SOON_DAYS,
  KEY_RE,
  keyPrefix,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_USER,
  MIME,
  MIME_FOR_EXT,
  UPLOAD_TYPES,
  USER_QUOTA_BYTES,
} from "./constants";

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** Find an ASCII marker inside the first `limit` bytes (ZIP central directory names etc.). */
function hasAscii(b: Uint8Array, marker: string, limit = b.length): boolean {
  const m = Array.from(marker, (c) => c.charCodeAt(0));
  const end = Math.min(b.length, limit) - m.length;
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < m.length; j++) if (b[i + j] !== m[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * Detect the real file type from its leading bytes. Returns null for anything not allowed.
 * DOCX is a ZIP whose entries include `word/` and `[Content_Types].xml`.
 */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length < 8) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return MIME.pdf; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return MIME.png;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return MIME.jpg;
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return hasAscii(bytes, "word/") && hasAscii(bytes, "[Content_Types].xml") ? MIME.docx : null;
  }
  return null;
}

export const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "").slice(0, 8);

export type UploadError = "noFile" | "tooLarge" | "badType" | "mismatch" | "quota" | "tooMany" | "rateLimited";

/** Cheap pre-checks done before any bytes are stored (client and token route). */
export function precheckUpload(f: { name: string; size: number; type?: string }): UploadError | null {
  if (!f.name || f.size <= 0) return "noFile";
  if (f.size > MAX_DOCUMENT_BYTES) return "tooLarge";
  const byExt = MIME_FOR_EXT[extOf(f.name)];
  if (!byExt) return "badType";
  if (f.type && !(ALLOWED_MIMES as readonly string[]).includes(f.type)) return "badType";
  return null;
}

/**
 * Final check on the stored bytes: the sniffed type must be allowed and agree with the extension
 * (a renamed .exe -> .pdf fails here). Returns the trusted mime.
 */
export function verifyBytes(
  name: string,
  bytes: Uint8Array,
): { ok: true; mime: AllowedMime } | { ok: false; error: UploadError } {
  if (bytes.length === 0) return { ok: false, error: "noFile" };
  if (bytes.length > MAX_DOCUMENT_BYTES) return { ok: false, error: "tooLarge" };
  const sniffed = sniffMime(bytes);
  if (!sniffed) return { ok: false, error: "badType" };
  const byExt = MIME_FOR_EXT[extOf(name)];
  if (byExt !== sniffed) return { ok: false, error: "mismatch" };
  return { ok: true, mime: sniffed };
}

export interface QuotaState {
  usedBytes: number;
  count: number;
  recentUploads: number;
}
/** Quota/rate checks. `replacingBytes` is the size of the version being replaced (freed on success). */
export function checkQuota(
  s: QuotaState,
  incoming: number,
  replacingBytes = 0,
  uploadsPerHour = 30,
): UploadError | null {
  if (s.recentUploads >= uploadsPerHour) return "rateLimited";
  if (!replacingBytes && s.count >= MAX_DOCUMENTS_PER_USER) return "tooMany";
  if (s.usedBytes - replacingBytes + incoming > USER_QUOTA_BYTES) return "quota";
  return null;
}

/** A storage key is acceptable only if it is well-formed and under the caller's own prefix. */
export const ownsKey = (userId: string, key: string) => key.startsWith(keyPrefix(userId)) && KEY_RE.test(key);

const optDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "date" });
      return z.NEVER;
    }
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "date" });
      return z.NEVER;
    }
    return d;
  });
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const tagsFrom = (v: string | undefined) =>
  [
    ...new Set(
      (v ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim().slice(0, 30))
        .filter(Boolean),
    ),
  ].slice(0, 12);

/** Editable metadata (upload form and edit sheet). */
export const metadataSchema = z
  .object({
    type: z.enum(UPLOAD_TYPES as unknown as [string, ...string[]]),
    title: z.string().trim().min(1).max(120),
    issuer: optText(120),
    issueDate: optDate,
    expiryDate: optDate,
    language: z
      .enum(["he", "en", ""])
      .optional()
      .transform((v) => v || null),
    tags: z.string().max(400).optional().transform(tagsFrom),
    notes: optText(1000),
    skills: z.array(z.string().max(60)).max(20).default([]),
  })
  .refine((d) => !d.issueDate || !d.expiryDate || d.expiryDate >= d.issueDate, {
    path: ["expiryDate"],
    message: "expiryBeforeIssue",
  });
export type DocumentMetadata = z.output<typeof metadataSchema>;

export const isDocumentType = (v: string): v is (typeof DOCUMENT_TYPES)[number] =>
  (DOCUMENT_TYPES as readonly string[]).includes(v);

export type ExpiryStatus = "none" | "valid" | "soon" | "expired";
export function expiryStatus(
  expiry: Date | null | undefined,
  now = new Date(),
  soonDays = EXPIRY_SOON_DAYS,
): ExpiryStatus {
  if (!expiry) return "none";
  const ms = expiry.getTime() - now.getTime();
  if (ms < 0) return "expired";
  return ms <= soonDays * 86_400_000 ? "soon" : "valid";
}

/** Default title from a file name: drop extension, turn separators into spaces. */
export function titleFromFileName(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Document"
  );
}

/** ASCII-safe Content-Disposition with an RFC 5987 UTF-8 name. */
export function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const formatBytes = (n: number) =>
  n <= 0 ? "0 KB" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
