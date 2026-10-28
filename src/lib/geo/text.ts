/** Normalizes a place string for matching: lowercase, no diacritics/niqqud, unified quotes, single spaces. */
export function normText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05C7]/g, "")
    .replace(/[\u05BE\-–]/g, " ")
    .replace(/[`’‘׳']/g, "'")
    .replace(/[״"]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
