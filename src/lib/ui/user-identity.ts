/** What the header user button shows for the signed-in user. Pure so it is unit-tested. */
export interface UserIdentityInput {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface UserIdentity {
  /** Name to show; falls back to the part of the email before "@". */
  displayName: string;
  email: string;
  /** One or two letters for the avatar fallback (works for Hebrew and Latin names). */
  initials: string;
  /** Only http(s) or root-relative image URLs are used; anything else falls back to initials. */
  image: string | null;
}

function letters(word: string): string {
  // First grapheme-ish character, skipping punctuation such as quotes or dots.
  const match = word.match(/[\p{L}\p{N}]/u);
  return match ? match[0] : "";
}

export function userInitials(name?: string | null, email?: string | null): string {
  const words = (name ?? "")
    .trim()
    .split(/[\s._-]+/)
    .filter((w) => letters(w));
  if (words.length >= 2) return (letters(words[0]) + letters(words[words.length - 1])).toUpperCase();
  if (words.length === 1) return letters(words[0]).toUpperCase();
  const local = (email ?? "").split("@")[0] ?? "";
  const parts = local.split(/[._+-]+/).filter((w) => letters(w));
  if (parts.length >= 2) return (letters(parts[0]) + letters(parts[1])).toUpperCase();
  if (parts.length === 1) return letters(parts[0]).toUpperCase();
  return "?";
}

function safeImage(image?: string | null): string | null {
  if (!image) return null;
  const src = image.trim();
  if (/^https?:\/\//i.test(src) || (src.startsWith("/") && !src.startsWith("//"))) return src;
  return null;
}

export function userIdentity(user: UserIdentityInput): UserIdentity {
  const email = (user.email ?? "").trim();
  const name = (user.name ?? "").trim();
  return {
    displayName: name || email.split("@")[0] || email,
    email,
    initials: userInitials(name, email),
    image: safeImage(user.image),
  };
}
