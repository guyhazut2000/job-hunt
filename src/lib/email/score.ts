import type { ApplicationStatus, EmailConfidence } from "@prisma/client";

export const AUTO_THRESHOLD: Record<EmailConfidence, number> = { STRICT: 85, BALANCED: 70, AGGRESSIVE: 50 };
/** Below this we don't even show the email in the review queue. */
export const REVIEW_FLOOR = 40;

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

export function shouldAutoApply(score: number, level: EmailConfidence): boolean {
  return score >= AUTO_THRESHOLD[level];
}

const RANK: Record<ApplicationStatus, number> = {
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
