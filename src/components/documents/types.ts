import type { DocumentTypeKey } from "@/lib/documents/constants";
import type { ExpiryStatus } from "@/lib/documents/validate";

/** A document as sent to the client (no storage key, no hash). */
export interface DocumentRow {
  id: string;
  type: DocumentTypeKey;
  title: string;
  issuer: string | null;
  issueDate: string | null; // YYYY-MM-DD
  expiryDate: string | null; // YYYY-MM-DD
  language: string | null;
  tags: string[];
  notes: string | null;
  skills: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isDefault: boolean;
  createdAt: string; // ISO
  expiry: ExpiryStatus;
  daysToExpiry: number | null;
}

export interface CvSummary {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface SkillOption {
  id: string;
  label: string;
}
