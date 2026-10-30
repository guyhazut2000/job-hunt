/**
 * Follow-up reminder timing — pure, shared by the cron, the daily digest, the dashboard and the
 * application cards. See docs/notifications.md#follow-up-reminders.
 *
 * Rules:
 * - Only applications still in APPLIED (no reply yet) are candidates.
 * - Timer anchor = latest of: applied date, last status change, last follow-up marked as sent.
 * - Round 1 is due N days after applying; after the user marks it sent, round 2 is due N days later.
 *   After 2 follow-ups and another N days of silence we suggest marking it "no response".
 * - Stops for good on: any other status (screening/interview/offer/rejected), "don't remind",
 *   "no response" marked, follow-ups disabled in settings, or an email reply about the application
 *   (a status-update email from the Gmail scan, auto-applied or waiting in the review queue).
 * - "Remind me later" holds the reminder until the snooze ends.
 */

export const DAY_MS = 86_400_000;
/** Max follow-ups we suggest before offering "mark as no response". */
export const FOLLOW_UP_MAX = 2;
export const DEFAULT_FOLLOW_UP_DAYS = 10;
export const SNOOZE_OPTIONS = [3, 7] as const;

export interface FollowUpApp {
  id: string;
  status: string;
  appliedAt: Date | null;
  createdAt: Date;
  statusChangedAt?: Date | null;
  followUpCount?: number | null;
  lastFollowUpAt?: Date | null;
  followUpSnoozedUntil?: Date | null;
  followUpOff?: boolean | null;
  noResponseAt?: Date | null;
}

export interface FollowUpSignals {
  /** A reply/status-update email about this application arrived after the anchor. */
  emailResponse?: boolean;
}

export type StopReason = "status" | "off" | "no_response" | "email_response" | "disabled";

export type FollowUpState =
  | { kind: "stopped"; reason: StopReason }
  /** Not yet — `round` is what comes next ("ghost" = the no-response suggestion). */
  | { kind: "waiting"; round: 1 | 2 | "ghost"; dueAt: Date; anchor: Date }
  | { kind: "snoozed"; round: 1 | 2 | "ghost"; until: Date; anchor: Date }
  | { kind: "due"; round: 1 | 2; days: number; anchor: Date; snoozedUntil: Date | null }
  | { kind: "ghost"; days: number; anchor: Date; snoozedUntil: Date | null };

/** Whole days between two instants (floor). */
export const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY_MS);

const latest = (...ds: Array<Date | null | undefined>): Date =>
  new Date(Math.max(...ds.filter((d): d is Date => d instanceof Date).map((d) => d.getTime())));

export function followUpAnchor(app: FollowUpApp): Date {
  return latest(app.appliedAt ?? app.createdAt, app.statusChangedAt, app.lastFollowUpAt);
}

export function followUpState(
  app: FollowUpApp,
  prefs: { followUpEnabled: boolean; followUpDays: number },
  now: Date,
  signals: FollowUpSignals = {},
): FollowUpState {
  if (app.status !== "APPLIED") return { kind: "stopped", reason: "status" };
  if (app.noResponseAt) return { kind: "stopped", reason: "no_response" };
  if (app.followUpOff) return { kind: "stopped", reason: "off" };
  if (signals.emailResponse) return { kind: "stopped", reason: "email_response" };
  if (!prefs.followUpEnabled) return { kind: "stopped", reason: "disabled" };
  const n = Math.max(1, Math.min(60, Math.round(prefs.followUpDays || DEFAULT_FOLLOW_UP_DAYS)));
  const count = Math.max(0, app.followUpCount ?? 0);
  const round: 1 | 2 | "ghost" = count >= FOLLOW_UP_MAX ? "ghost" : count === 1 ? 2 : 1;
  const anchor = followUpAnchor(app);
  const dueAt = new Date(anchor.getTime() + n * DAY_MS);
  if (now < dueAt) return { kind: "waiting", round, dueAt, anchor };
  const snooze = app.followUpSnoozedUntil ?? null;
  if (snooze && now < snooze) return { kind: "snoozed", round, until: snooze, anchor };
  const days = daysBetween(anchor, now);
  // Only remember a snooze that ended after the reminder came due (it re-arms the reminder).
  const snoozedUntil = snooze && snooze > dueAt ? snooze : null;
  return round === "ghost"
    ? { kind: "ghost", days, anchor, snoozedUntil }
    : { kind: "due", round, days, anchor, snoozedUntil };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Idempotency key for the reminder notification (Notification.dedupeKey is unique per user).
 * Round 1 with the anchor on the applied date keeps the pre-existing key so applications that
 * were already reminded before this feature aren't reminded again.
 */
export function followUpDedupeKey(app: FollowUpApp, state: FollowUpState): string | null {
  if (state.kind !== "due" && state.kind !== "ghost") return null;
  const applied = app.appliedAt ?? app.createdAt;
  const snooze = state.snoozedUntil ? `:s${day(state.snoozedUntil)}` : "";
  if (state.kind === "ghost") return `followup:${app.id}:ghost:${day(state.anchor)}${snooze}`;
  if (state.round === 1 && !snooze && day(state.anchor) === day(applied)) return `followup:${app.id}:${day(applied)}`;
  return `followup:${app.id}:r${state.round}:${day(state.anchor)}${snooze}`;
}

/** Back-compat helper (digest): is a follow-up (or the no-response suggestion) due right now? */
export function followUpDue(
  app: FollowUpApp,
  days: number,
  now: Date,
  signals: FollowUpSignals = {},
  enabled = true,
): boolean {
  const s = followUpState(app, { followUpEnabled: enabled, followUpDays: days }, now, signals);
  return s.kind === "due" || s.kind === "ghost";
}

/** Gmail-scan candidate statuses that count as "the company replied". DISMISSED = user said no. */
export const RESPONSE_CANDIDATE_STATUSES = ["PENDING", "AUTO_ADDED", "APPROVED"] as const;
