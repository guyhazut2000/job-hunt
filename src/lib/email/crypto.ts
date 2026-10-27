import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for OAuth refresh tokens at rest. Key: EMAIL_TOKEN_ENC_KEY = 32 random bytes,
 * base64 (`openssl rand -base64 32`). Format: v1.<iv>.<tag>.<ciphertext> (base64url parts).
 */
const VERSION = "v1";

export function loadKey(raw = process.env.EMAIL_TOKEN_ENC_KEY): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "base64");
  return key.length === 32 ? key : null;
}

function requireKey(key?: Buffer | null): Buffer {
  const k = key ?? loadKey();
  if (!k) throw new Error("EMAIL_TOKEN_ENC_KEY is missing or not 32 bytes (base64)");
  return k;
}

export function encryptSecret(plain: string, key?: Buffer | null): string {
  const k = requireKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(
    ".",
  );
}

export function decryptSecret(payload: string, key?: Buffer | null): string {
  const k = requireKey(key);
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== VERSION || !iv || !tag || !ct) throw new Error("Unsupported token format");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
