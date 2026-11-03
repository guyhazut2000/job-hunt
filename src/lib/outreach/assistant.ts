import type { ContactCategory, ContactStatus } from "@prisma/client";
import { z } from "zod";

/**
 * LinkedIn outreach assistant (#86, docs/outreach-assistant.md). Pure helpers: daily goal + streak,
 * follow-up timing, and which audience to suggest for a "low-energy day" draft.
 * Nothing here sends anything — the user copies a draft and sends it in their own LinkedIn.
 */

export const OUTREACH_TZ = "Asia/Jerusalem";
const DAY = 86_400_000;

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: OUTREACH_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day in Israel, "YYYY-MM-DD". */
export const israelDay = (d: Date) => dayFmt.format(d);

/** "2026-11-03" → "2026-11-02". Works on the calendar string, so DST never skips a day. */
export function prevDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - DAY);
  return t.toISOString().slice(0, 10);
}

export const prefsSchema = z.object({
  dailyGoal: z.coerce.number().int().min(1).max(20),
  followUpDays: z.coerce.number().int().min(2).max(14),
  queueSize: z.coerce.number().int().min(3).max(10),
});
export type OutreachPrefsInput = z.infer<typeof prefsSchema>;
export const DEFAULT_PREFS: OutreachPrefsInput = { dailyGoal: 3, followUpDays: 5, queueSize: 5 };

export interface GoalProgress {
  today: number;
  goal: number;
  met: boolean;
  /** Consecutive days (Israel time) that met the goal, ending today — or yesterday while today is still open. */
  streak: number;
  /** Oldest first, today last. */
  week: { day: string; count: number; met: boolean }[];
}

/** Daily goal + streak from the moments requests were sent. */
export function goalProgress(sent: Date[], goal: number, now = new Date()): GoalProgress {
  const counts = new Map<string, number>();
  for (const d of sent) counts.set(israelDay(d), (counts.get(israelDay(d)) ?? 0) + 1);
  const today = israelDay(now);
  const n = (day: string) => counts.get(day) ?? 0;
  let streak = 0;
  let day = n(today) >= goal ? today : prevDay(today);
  while (n(day) >= goal && streak < 366) {
    streak++;
    day = prevDay(day);
  }
  const week: GoalProgress["week"] = [];
  let w = today;
  for (let i = 0; i < 7; i++) {
    week.unshift({ day: w, count: n(w), met: n(w) >= goal });
    w = prevDay(w);
  }
  return { today: n(today), goal, met: n(today) >= goal, streak, week };
}

export type FollowUpKind = "accepted" | "nudge";

export interface FollowUpContact {
  status: ContactStatus;
  sentAt: Date | null;
  statusAt: Date | null;
  createdAt: Date;
  followedUpAt: Date | null;
}

export interface FollowUpDue {
  kind: FollowUpKind;
  /** Whole days since the anchor (request sent / accepted). */
  days: number;
  anchor: Date;
}

/**
 * When to follow up:
 * - "accepted": they accepted the request → a short thank-you + the actual ask, from the next day.
 * - "nudge": request (or message) still unanswered after `followUpDays`.
 * One follow-up per contact; replied / referred contacts never get one.
 */
export function followUpDue(c: FollowUpContact, followUpDays: number, now = new Date()): FollowUpDue | null {
  if (c.followedUpAt) return null;
  if (c.status === "ACCEPTED") {
    const anchor = c.statusAt ?? c.sentAt ?? c.createdAt;
    const days = Math.floor((now.getTime() - anchor.getTime()) / DAY);
    return days >= 1 ? { kind: "accepted", days, anchor } : null;
  }
  if (c.status === "SENT") {
    const anchor = c.sentAt ?? c.statusAt ?? c.createdAt;
    const days = Math.floor((now.getTime() - anchor.getTime()) / DAY);
    return days >= followUpDays ? { kind: "nudge", days, anchor } : null;
  }
  return null;
}

/**
 * "Did they accept?" check (#95): halfway to the nudge, ask the user to look at LinkedIn and tap
 * the status. We can't (and won't) read LinkedIn, so this is the least-friction legal option.
 * Only for requests still marked SENT; never at or after the nudge day (the nudge covers it).
 */
export function statusCheckDays(followUpDays: number): number {
  return Math.max(1, Math.floor(followUpDays / 2));
}

export function statusCheckDue(
  c: FollowUpContact,
  followUpDays: number,
  now = new Date(),
): { days: number; anchor: Date } | null {
  if (c.followedUpAt || c.status !== "SENT") return null;
  const anchor = c.sentAt ?? c.statusAt ?? c.createdAt;
  const days = Math.floor((now.getTime() - anchor.getTime()) / DAY);
  const at = statusCheckDays(followUpDays);
  return days >= at && days < followUpDays ? { days, anchor } : null;
}

export const statusCheckDedupeKey = (contactId: string, anchor: Date) =>
  `outreach:${contactId}:check:${israelDay(anchor)}`;

/** One-tap next steps for a tracker row, most likely first. The select stays for everything else. */
export function quickNextStatuses(status: ContactStatus): ContactStatus[] {
  switch (status) {
    case "NOT_CONTACTED":
      return ["SENT"];
    case "SENT":
      return ["ACCEPTED", "REPLIED"];
    case "ACCEPTED":
      return ["REPLIED"];
    case "REPLIED":
      return ["REFERRED"];
    default:
      return [];
  }
}

/** Max contacts one bulk update may touch (one request, one transaction). */
export const BULK_MAX = 100;

/** Stable per contact + kind + anchor, so the cron never reminds twice for the same step. */
export const followUpDedupeKey = (contactId: string, due: FollowUpDue) =>
  `outreach:${contactId}:${due.kind}:${israelDay(due.anchor)}`;

/** New status → timestamps to set. `sentAt` is kept once set, so the daily count never moves. */
export function statusPatch(
  prev: { sentAt: Date | null },
  status: ContactStatus,
  now = new Date(),
): { status: ContactStatus; statusAt: Date; sentAt?: Date } {
  const patch: { status: ContactStatus; statusAt: Date; sentAt?: Date } = { status, statusAt: now };
  if (status !== "NOT_CONTACTED" && !prev.sentAt) patch.sentAt = now;
  return patch;
}

export type QueueSource = "saved" | "applied" | "fresh";

/**
 * Who to write to, by where the job stands:
 * saved → a peer on the team (a referral before applying is the strongest path),
 * applied → the team lead (put a face to the application), fresh match → the recruiter.
 */
export const QUEUE_AUDIENCE: Record<QueueSource, ContactCategory> = {
  saved: "PEER",
  applied: "TEAM_LEAD",
  fresh: "RECRUITER",
};

export interface QueueCandidate {
  source: QueueSource;
  companyId: string;
  jobId: string | null;
  at: number;
}

/**
 * Pick up to `size` drafts: one per company, applications before fresh matches, newest first,
 * skipping companies the user already wrote to recently.
 */
export function pickQueue<T extends QueueCandidate>(cands: T[], skipCompanies: Set<string>, size: number): T[] {
  const rank: Record<QueueSource, number> = { saved: 0, applied: 1, fresh: 2 };
  const sorted = [...cands].sort((a, b) => rank[a.source] - rank[b.source] || b.at - a.at);
  const seen = new Set(skipCompanies);
  const out: T[] = [];
  for (const c of sorted) {
    if (seen.has(c.companyId)) continue;
    seen.add(c.companyId);
    out.push(c);
    if (out.length >= size) break;
  }
  return out;
}
