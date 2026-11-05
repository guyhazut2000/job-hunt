/**
 * Prepared job applications (#30). A field list is either the ATS form (Greenhouse public
 * questions, or Ashby when that employer's key is configured) or a profile packet the user
 * copies onto the company form. File bytes never live on a field — only a document ref.
 */
import type { DocumentTypeKey } from "@/lib/documents/constants";

export const FIELD_KINDS = ["text", "long", "select", "multi", "file", "boolean", "number"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const FIELD_SOURCES = ["profile", "ai", "user", "blank"] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

export type FlagReason = "manual" | "sensitive" | "low_confidence" | "unmatched_option" | "location";

export interface FieldOption {
  value: string;
  label: string;
}

export interface ApplyField {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options: FieldOption[];
  value: string;
  source: FieldSource;
  confidence: "high" | "low";
  flagged: boolean;
  flagReason?: FlagReason;
  /** Visa / EEO / demographic: never guessed from the profile or sent to the model. */
  sensitive: boolean;
  /**
   * False when the documented submit body cannot carry this field (Greenhouse location without
   * lat/long, EEO/demographic answers with a different shape). The value stays in the packet.
   */
  transmit: boolean;
}

export interface ApplyProfile {
  name: string | null;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  headline: string;
  summary: string;
  skills: { name: string; years: number | null }[];
  salaryMin: number | null;
  salaryMax: number | null;
  availability: string | null;
  currentCompany: string;
  currentTitle: string;
  yearsExperience: number | null;
}

export interface PacketDocument {
  ref: string;
  title: string;
  fileName: string;
  type: DocumentTypeKey;
}

export interface SentSnapshot {
  delivery: "api" | "handoff" | "manual";
  platform: string;
  reason: string;
  recordedAt: string;
  fields: { id: string; label: string; value: string }[];
  documents: PacketDocument[];
}

export function blankField(partial: {
  id: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  options?: FieldOption[];
  sensitive?: boolean;
  transmit?: boolean;
}): ApplyField {
  return {
    kind: "text",
    required: false,
    options: [],
    value: "",
    source: "blank",
    confidence: "low",
    flagged: false,
    sensitive: false,
    transmit: true,
    ...partial,
  };
}

export function parseMulti(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    // a single token from an older row
  }
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function hasValue(field: ApplyField): boolean {
  if (field.kind === "multi") return parseMulti(field.value).length > 0;
  if (field.kind === "boolean") return field.value === "true" || field.value === "false";
  return field.value.trim().length > 0;
}
