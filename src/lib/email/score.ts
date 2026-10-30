import type { ApplicationStatus } from "@prisma/client";

/** Below this we don't even show the email in the review queue. */
export const REVIEW_FLOOR = 40;
/** Default per-user auto-apply threshold (EmailSyncSettings.autoApplyThreshold). */
export const DEFAULT_AUTO_THRESHOLD = 60;
export const MIN_AUTO_THRESHOLD = REVIEW_FLOOR;
export const MAX_AUTO_THRESHOLD = 100;

/** Per-user automation settings, as used by the analyzer. */
export type AutoApply = { enabled: boolean; threshold: number };

export function clampThreshold(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_AUTO_THRESHOLD;
  return Math.min(MAX_AUTO_THRESHOLD, Math.max(MIN_AUTO_THRESHOLD, Math.round(n)));
}

export const COMPANY_MATCH = 0.85;
export const JOB_MATCH = 0.6;

export type ScoreInput = {
  strongPhrase: boolean;
  atsSender: boolean;
  companySource: "text" | "sender" | "domain" | null;
  companyMatch: number; // 0..1, 0 = no DB match
  hasTitle: boolean;
  jobMatch: number; // 0..1
};

export function scoreCandidate(i: ScoreInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  const add = (n: number, r: string) => {
    s += n;
    reasons.push(r);
  };
  add(i.strongPhrase ? 35 : 20, i.strongPhrase ? "phrase_subject" : "phrase_body");
  if (i.atsSender) add(15, "ats_sender");
  if (i.companySource === "text") add(15, "company_text");
  else if (i.companySource === "sender") add(10, "company_sender");
  else if (i.companySource === "domain") add(5, "company_domain");
  if (i.companyMatch >= COMPANY_MATCH) add(15, "company_match");
  else if (i.companyMatch >= 0.7) add(7, "company_partial");
  if (i.hasTitle) add(10, "title");
  if (i.jobMatch >= 0.75) add(20, "job_match");
  else if (i.jobMatch >= JOB_MATCH) add(10, "job_partial");
  return { score: Math.min(100, s), reasons };
}

/** Apply without review when automation is on and the score reaches the user's threshold. */
export function shouldAutoApply(score: number, auto: AutoApply): boolean {
  return auto.enabled && score >= clampThreshold(auto.threshold);
}

export const RANK: Record<ApplicationStatus, number> = {
  SAVED: 0,
  APPLIED: 1,
  SCREENING: 2,
  INTERVIEW: 3,
  OFFER: 4,
  REJECTED: 5,
};

/** Email-driven status changes only move forward and never leave REJECTED/OFFER automatically. */
export function nextStatus(current: ApplicationStatus, detected: ApplicationStatus): ApplicationStatus | null {
  if (current === detected) return null;
  if (current === "REJECTED") return null;
  if (detected === "REJECTED") return current === "OFFER" ? null : "REJECTED";
  return RANK[detected] > RANK[current] ? detected : null;
}

/**
 * Email ordering guard. `statusAt` is when the application's current status took effect (email date
 * for email-driven changes). An email older than that may not move an application that has already
 * progressed (screening / interview / offer): e.g. an old rejection must not overwrite a later
 * interview. Those go to review instead.
 */
export function isStaleEmail(current: ApplicationStatus, statusAt: Date | null | undefined, emailDate: Date): boolean {
  if (!statusAt) return false;
  return RANK[current] >= RANK.SCREENING && current !== "REJECTED" && emailDate.getTime() < statusAt.getTime();
}
