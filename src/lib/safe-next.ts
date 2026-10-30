/**
 * A same-site path to return to after login, or undefined. Rejects absolute / protocol-relative URLs
 * and backslash tricks (`/\evil.com` is treated as `//evil.com` by browsers).
 */
export function safeNextPath(next: string | null | undefined): string | undefined {
  if (!next || next.length > 512) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  if (/[\\\u0000-\u001f]/.test(next)) return undefined;
  return next;
}

/** `/login`, carrying the page to come back to when it is a safe path. */
export function loginPath(next?: string): string {
  const safe = safeNextPath(next);
  return safe && safe !== "/login" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
