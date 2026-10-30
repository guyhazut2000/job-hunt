import { createHash } from "node:crypto";

/**
 * Change detection for saved-job updates (#41). A job's "content hash" is a short per-field digest
 * string — "title:ab12cd34|location:…|workMode:…|pay:…|description:…" — so a later scan can tell
 * which fields the employer changed without storing the old text. Whitespace-only edits don't count.
 */
export const CONTENT_FIELDS = ["title", "location", "workMode", "pay", "description"] as const;
export type ContentField = (typeof CONTENT_FIELDS)[number];

export interface HashableJob {
  title: string;
  location: string;
  workMode: string;
  description: string;
  payMin?: number | null;
  payMax?: number | null;
  payCurrency?: string | null;
  payPeriod?: string | null;
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
const short = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 10);

export function contentHash(j: HashableJob): string {
  const values: Record<ContentField, string> = {
    title: norm(j.title),
    location: norm(j.location),
    workMode: j.workMode,
    pay: [j.payMin ?? "", j.payMax ?? "", j.payCurrency ?? "", j.payPeriod ?? ""].join("/"),
    description: norm(j.description),
  };
  return CONTENT_FIELDS.map((f) => `${f}:${short(values[f])}`).join("|");
}

function parse(hash: string): Map<string, string> {
  return new Map(
    hash
      .split("|")
      .map((p) => p.split(":") as [string, string])
      .filter((p) => p.length === 2),
  );
}

/** Fields whose digest differs. Empty when either side is missing (first scan = no "update"). */
export function changedFields(prev: string | null | undefined, next: string): ContentField[] {
  if (!prev) return [];
  const a = parse(prev);
  const b = parse(next);
  return CONTENT_FIELDS.filter((f) => a.has(f) && b.has(f) && a.get(f) !== b.get(f));
}
