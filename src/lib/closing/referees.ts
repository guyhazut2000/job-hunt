import { z } from "zod";

/** Referees (ממליצים): input validation and consent states. Pure. */

export const CONSENT = ["NOT_ASKED", "ASKED", "AGREED", "DECLINED"] as const;
export type Consent = (typeof CONSENT)[number];

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();

export const refereeInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: opt(120),
  company: opt(120),
  email: opt(200).refine((s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "email"),
  phone: opt(40).refine((s) => !s || /^[+\d][\d\s()-]{5,}$/.test(s), "phone"),
  linkedinUrl: opt(300).refine((s) => !s || /^https?:\/\/([a-z]+\.)?linkedin\.com\/\S+$/i.test(s), "linkedin"),
  /** Comma-separated in the form → array of up to 10 role tags. */
  fitsRoles: z
    .string()
    .max(500)
    .optional()
    .transform((s) =>
      Array.from(
        new Set(
          (s ?? "")
            .split(/[,،\n]/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => x.slice(0, 60)),
        ),
      ).slice(0, 10),
    ),
  consent: z.enum(CONSENT).default("NOT_ASKED"),
  lastContactedAt: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : null)),
  notes: opt(2000),
});
export type RefereeInput = z.infer<typeof refereeInputSchema>;

const HOUR = 3_600_000;

/** Brief reminder: the call is expected within 48h and the referee was not briefed yet. */
export function needsBrief(link: { expectedCallAt: Date | null; briefedAt: Date | null }, now: Date): boolean {
  if (!link.expectedCallAt || link.briefedAt) return false;
  const left = link.expectedCallAt.getTime() - now.getTime();
  return left > 0 && left <= 48 * HOUR;
}

/** Thank-you is due once the call happened (or its expected time passed) and no thanks was recorded. */
export function needsThanks(
  link: { expectedCallAt: Date | null; calledAt: Date | null; thankedAt: Date | null },
  now: Date,
): boolean {
  if (link.thankedAt) return false;
  if (link.calledAt) return true;
  return !!link.expectedCallAt && link.expectedCallAt.getTime() < now.getTime();
}

/** Referees whose fitsRoles mention a word from the role title come first. */
export function rankForRole<T extends { fitsRoles: string[]; consent: string; name: string }>(
  rows: T[],
  role: string,
): T[] {
  const words = role
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((w) => w.length > 1);
  const score = (r: T) =>
    (r.fitsRoles.some((f) => words.some((w) => f.toLowerCase().includes(w))) ? 2 : 0) +
    (r.consent === "AGREED" ? 1 : 0);
  return [...rows].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}
