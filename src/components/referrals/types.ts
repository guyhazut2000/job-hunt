import type { ReferralStatus } from "@prisma/client";
import type { ReferralNudge } from "@/lib/referrals/followup";

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  companyId: string | null;
  companyName: string;
  companySlug: string | null;
  email: string | null;
  linkedinUrl: string | null;
  relationship: string | null;
  notes: string | null;
}

export interface TargetOption {
  /** "a:<applicationId>" or "j:<jobId>" */
  value: string;
  label: string;
  companyId: string | null;
  companyName: string;
}

export interface ReferralRow {
  id: string;
  contactId: string;
  contactName: string;
  company: string;
  status: ReferralStatus;
  statusAt: string;
  outcome: string | null;
  note: string | null;
  applicationId: string | null;
  jobTitle: string | null;
  due: { kind: ReferralNudge; days: number } | null;
}
