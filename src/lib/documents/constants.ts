/**
 * Documents: shared constants. Client-safe (no server imports).
 * See docs/documents.md.
 */

export const DOCUMENT_TYPES = [
  "CV",
  "TRANSCRIPT",
  "DEGREE",
  "CERTIFICATION",
  "RECOMMENDATION_LETTER",
  "PORTFOLIO",
  "COVER_LETTER",
  "OTHER",
] as const;
export type DocumentTypeKey = (typeof DOCUMENT_TYPES)[number];

/** Types uploadable on /documents. CVs go through the profile flow, which also parses them. */
export const UPLOAD_TYPES = DOCUMENT_TYPES.filter((t) => t !== "CV");

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB per file
export const USER_QUOTA_BYTES = 100 * 1024 * 1024; // 100MB per user
export const MAX_DOCUMENTS_PER_USER = 200;
/** Uploads (finalized documents) allowed per user per rolling hour. */
export const UPLOADS_PER_HOUR = 30;
/** Certifications expiring within this many days get an "expiring soon" badge. */
export const EXPIRY_SOON_DAYS = 60;

export const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
} as const;
export type AllowedMime = (typeof MIME)[keyof typeof MIME];
export const ALLOWED_MIMES: readonly AllowedMime[] = Object.values(MIME);

export const EXT_FOR_MIME: Record<AllowedMime, string> = {
  [MIME.pdf]: "pdf",
  [MIME.docx]: "docx",
  [MIME.png]: "png",
  [MIME.jpg]: "jpg",
};

export const MIME_FOR_EXT: Record<string, AllowedMime> = {
  pdf: MIME.pdf,
  docx: MIME.docx,
  png: MIME.png,
  jpg: MIME.jpg,
  jpeg: MIME.jpg,
};

/** `accept` attribute for <input type="file">. */
export const ACCEPT_ATTR = ".pdf,.docx,.png,.jpg,.jpeg," + ALLOWED_MIMES.join(",");

/** Inline preview is only offered for these; everything else is download-only. */
export const isPreviewable = (mime: string) => mime === MIME.pdf || mime === MIME.png || mime === MIME.jpg;

/** Storage keys always live under the owner's prefix; the server rejects anything else. */
export const keyPrefix = (userId: string) => `documents/${userId}/`;
export const KEY_RE = /^documents\/[a-z0-9]{10,40}\/[a-f0-9-]{36}\.(pdf|docx|png|jpg)$/;
