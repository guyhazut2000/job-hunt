/**
 * Pure selection logic for <DocumentPicker> (client-safe). The apply flow can reuse it server-side
 * to validate a submitted selection.
 */
import type { DocumentTypeKey } from "./constants";

export interface AttachableDocument {
  /** "doc:<id>" for Document rows, "cv:<id>" for profile CVs (Resume rows). */
  ref: string;
  id: string;
  source: "document" | "resume";
  type: DocumentTypeKey;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isDefault: boolean;
  expired: boolean;
  createdAt: string;
}

export interface PickerRules {
  /** Types offered (others are filtered out). Empty = all. */
  types?: DocumentTypeKey[];
  /** Max documents per type (e.g. CV: 1). Unlisted types are unlimited. */
  maxPerType?: Partial<Record<DocumentTypeKey, number>>;
  /** Hard cap on total selected documents. */
  maxTotal?: number;
  /** Total attachment size cap in bytes. */
  maxTotalBytes?: number;
}

export function filterAttachable(docs: AttachableDocument[], rules: PickerRules = {}) {
  const types = rules.types?.length ? new Set(rules.types) : null;
  return docs.filter((d) => !types || types.has(d.type));
}

/** Initial selection: the default (else newest) non-expired document for each type with a limit of 1. */
export function defaultSelection(docs: AttachableDocument[], rules: PickerRules = {}): string[] {
  const out: string[] = [];
  const byType = new Map<DocumentTypeKey, AttachableDocument[]>();
  for (const d of filterAttachable(docs, rules)) {
    if (d.expired) continue;
    byType.set(d.type, [...(byType.get(d.type) ?? []), d]);
  }
  for (const [type, list] of byType) {
    const def = list.find((d) => d.isDefault);
    if (def) out.push(def.ref);
    else if (rules.maxPerType?.[type] === 1) {
      const newest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (newest) out.push(newest.ref);
    }
  }
  return out;
}

export type ToggleResult = { selected: string[]; error?: "maxTotal" | "maxBytes" };

/**
 * Toggle one document. For a type limited to 1, picking another swaps it (radio-like). Other
 * limits reject the toggle with an error and leave the selection unchanged.
 */
export function toggleSelection(
  selected: string[],
  ref: string,
  docs: AttachableDocument[],
  rules: PickerRules = {},
): ToggleResult {
  if (selected.includes(ref)) return { selected: selected.filter((r) => r !== ref) };
  const doc = docs.find((d) => d.ref === ref);
  if (!doc) return { selected };
  const byRef = new Map(docs.map((d) => [d.ref, d]));
  let next = [...selected];
  const limit = rules.maxPerType?.[doc.type];
  if (limit != null) {
    const sameType = next.filter((r) => byRef.get(r)?.type === doc.type);
    if (sameType.length >= limit) {
      if (limit === 1) next = next.filter((r) => byRef.get(r)?.type !== doc.type);
      else return { selected, error: "maxTotal" };
    }
  }
  if (rules.maxTotal != null && next.length >= rules.maxTotal) return { selected, error: "maxTotal" };
  const bytes = next.reduce((s, r) => s + (byRef.get(r)?.sizeBytes ?? 0), 0) + doc.sizeBytes;
  if (rules.maxTotalBytes != null && bytes > rules.maxTotalBytes) return { selected, error: "maxBytes" };
  return { selected: [...next, ref] };
}

/** Server-side guard: keep only refs that exist in the user's attachable list and obey the rules. */
export function sanitizeSelection(refs: string[], docs: AttachableDocument[], rules: PickerRules = {}): string[] {
  const allowed = filterAttachable(docs, rules);
  let sel: string[] = [];
  for (const r of [...new Set(refs)]) {
    if (!allowed.some((d) => d.ref === r)) continue;
    const res = toggleSelection(sel, r, allowed, rules);
    if (!res.error) sel = res.selected;
  }
  return sel;
}
