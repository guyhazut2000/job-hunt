import type { DocumentTypeKey } from "./constants";
import type { ExpiryStatus } from "./validate";

export type ExpiryFilter = "all" | "soon" | "expired";

interface Filterable {
  type: DocumentTypeKey;
  title: string;
  issuer: string | null;
  fileName: string;
  notes: string | null;
  tags: string[];
  expiry: ExpiryStatus;
}

/** Search + type + expiry filter for the documents list. */
export function filterDocuments<T extends Filterable>(
  docs: T[],
  q: string,
  type: DocumentTypeKey | "all",
  expiry: ExpiryFilter,
): T[] {
  const n = q.trim().toLowerCase();
  return docs.filter(
    (d) =>
      (type === "all" || d.type === type) &&
      (expiry === "all" || d.expiry === expiry) &&
      (!n || [d.title, d.issuer ?? "", d.fileName, d.notes ?? "", ...d.tags].some((s) => s.toLowerCase().includes(n))),
  );
}
