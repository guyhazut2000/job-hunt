import type { StartupCandidateStatus } from "@prisma/client";

/** A suggestion is shown as "being checked now" for this long after it was saved (the instant check). */
export const CHECKING_WINDOW_MS = 3 * 60 * 1000;
/** /api/cron/discover runs daily at 03:30 UTC (vercel.json). */
const NIGHTLY_UTC_HOUR = 3;
const NIGHTLY_UTC_MINUTE = 30;
/** "My suggestions" shows this many rows (SUGGEST_DAILY_LIMIT is 5/day; docs/ui-data-density.md). */
export const MY_SUGGESTIONS_LIMIT = 10;

export type SuggestionReason = "noCareersPage" | "noIsraelJobs" | "noBoard" | "siteError";

export type SuggestionStatus =
  | { kind: "checking" }
  | { kind: "nightly"; at: Date }
  | { kind: "added"; companySlug: string | null; jobs: number }
  | { kind: "review"; reason: SuggestionReason }
  | { kind: "rejected" }
  | { kind: "duplicate"; companySlug: string | null };

export interface SuggestionRow {
  status: StartupCandidateStatus;
  createdAt: Date;
  checkedAt: Date | null;
  checkError: string | null;
  careersUrl: string | null;
  website: string;
  company?: { slug: string; jobs?: number } | null;
}

/** Next nightly discovery run after `now`. */
export function nextNightlyRun(now: Date): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), NIGHTLY_UTC_HOUR, NIGHTLY_UTC_MINUTE),
  );
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Why a checked suggestion waits for an admin, in plain terms (from checkCandidate's stored result). */
export function reviewReason(c: Pick<SuggestionRow, "checkError" | "careersUrl" | "website">): SuggestionReason {
  const err = c.checkError ?? "";
  if (err.startsWith("no jobs:")) return "noIsraelJobs";
  if (err) return "siteError";
  if (!c.careersUrl || c.careersUrl.replace(/\/$/, "") === c.website.replace(/\/$/, "")) return "noCareersPage";
  return "noBoard";
}

export function suggestionStatus(c: SuggestionRow, now = new Date()): SuggestionStatus {
  switch (c.status) {
    case "ADDED":
      return { kind: "added", companySlug: c.company?.slug ?? null, jobs: c.company?.jobs ?? 0 };
    case "REJECTED":
      return { kind: "rejected" };
    case "DUPLICATE":
      return { kind: "duplicate", companySlug: c.company?.slug ?? null };
    default:
      if (c.checkedAt) return { kind: "review", reason: reviewReason(c) };
      if (now.getTime() - c.createdAt.getTime() < CHECKING_WINDOW_MS) return { kind: "checking" };
      return { kind: "nightly", at: nextNightlyRun(now) };
  }
}

/** The user id from a USER candidate's `sourceUrl` marker (`user:<id>`), or null. */
export function suggesterId(sourceUrl: string | null | undefined): string | null {
  return sourceUrl?.startsWith("user:") ? sourceUrl.slice(5) || null : null;
}
