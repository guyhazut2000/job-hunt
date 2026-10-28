/**
 * Short-lived signed file URLs. A token binds (documentId, userId, expiry) with HMAC-SHA256 so a
 * leaked link stops working after a few minutes and never works for a different signed-in user.
 * The file route still requires the session and checks ownership; the token is defense in depth.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const FILE_URL_TTL_SECONDS = 10 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required");
  return "dev-only-documents-secret";
}

const mac = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

export function signFileToken(
  docId: string,
  userId: string,
  now = Date.now(),
  ttl = FILE_URL_TTL_SECONDS,
  key = secret(),
) {
  const exp = Math.floor(now / 1000) + ttl;
  return { exp, sig: mac(`doc:${docId}:${userId}:${exp}`, key) };
}

export function verifyFileToken(
  docId: string,
  userId: string,
  exp: number,
  sig: string,
  now = Date.now(),
  key = secret(),
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(mac(`doc:${docId}:${userId}:${exp}`, key));
  const got = Buffer.from(sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Relative URL of the protected file route. */
export function signedFileUrl(docId: string, userId: string, opts: { download?: boolean } = {}) {
  const { exp, sig } = signFileToken(docId, userId);
  const q = new URLSearchParams({ exp: String(exp), sig });
  if (opts.download) q.set("download", "1");
  return `/api/documents/${docId}/file?${q}`;
}
