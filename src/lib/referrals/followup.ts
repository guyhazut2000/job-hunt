import type { ReferralStatus } from "@prisma/client";

const DAY = 86_400_000;

/** Days without a change before a reminder, per status (#92). */
export const REFERRAL_WAIT_DAYS: Partial<Record<ReferralStatus, number>> = { ASKED: 4, AGREED: 3, SUBMITTED: 10 };

export type ReferralNudge = "ask_again" | "send_cv" | "ask_answer";
const NUDGE: Partial<Record<ReferralStatus, ReferralNudge>> = {
  ASKED: "ask_again",
  AGREED: "send_cv",
  SUBMITTED: "ask_answer",
};

export interface ReferralLike {
  id: string;
  status: ReferralStatus;
  statusAt: Date;
  followedUpAt: Date | null;
}

/** Is a follow-up reminder due now? One per referral + status (followedUpAt after statusAt = handled). */
export function referralFollowUpDue(r: ReferralLike, now = new Date()): { kind: ReferralNudge; days: number } | null {
  const wait = REFERRAL_WAIT_DAYS[r.status];
  const kind = NUDGE[r.status];
  if (!wait || !kind) return null;
  if (r.followedUpAt && r.followedUpAt >= r.statusAt) return null;
  const days = Math.floor((now.getTime() - r.statusAt.getTime()) / DAY);
  return days >= wait ? { kind, days } : null;
}

export const referralDedupeKey = (r: ReferralLike) => `referral:${r.id}:${r.status}:${r.statusAt.toISOString().slice(0, 10)}`;
