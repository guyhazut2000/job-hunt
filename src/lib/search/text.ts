/**
 * Low-level text helpers for bilingual (Hebrew / English) search. Pure and client-safe.
 */

/**
 * Canonical text for matching: lower case, no Latin diacritics, no Hebrew niqqud/cantillation,
 * unified quotes/geresh, collapsed whitespace.
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Latin combining diacritics
    .replace(/[\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g, "") // Hebrew niqqud & cantillation
    .replace(/[\u05f3\u2018\u2019\u00b4`]/g, "'") // geresh / curly apostrophes
    .replace(/[\u05f4\u201c\u201d]/g, '"') // gershayim / curly quotes
    .replace(/[\u05be\u2010-\u2015]/g, "-") // maqaf / dashes
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const hasHebrew = (s: string) => /[\u05d0-\u05ea]/.test(s);
export const hasLatin = (s: string) => /[a-z]/i.test(s);

const FINAL_TO_REGULAR: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const REGULAR_TO_FINAL: Record<string, string> = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };

/** Replace Hebrew final letters (ךםןףץ) with their regular forms. */
export const foldFinals = (s: string) => s.replace(/[ךםןףץ]/g, (c) => FINAL_TO_REGULAR[c]);

/** Spell every Hebrew word with correct final letters: "שלומ" → "שלום", "מםחשב" → "ממחשב". */
export function fixFinals(s: string): string {
  return s.replace(/[\u05d0-\u05ea]+/g, (w) => {
    const body = foldFinals(w);
    const last = body[body.length - 1];
    return body.length > 1 && REGULAR_TO_FINAL[last] ? body.slice(0, -1) + REGULAR_TO_FINAL[last] : body;
  });
}

/**
 * Lookup key: normalized, final letters folded, and geresh/quotes/dots/hyphens/spaces removed, so
 * "צ'ק פוינט", "צק-פוינט" and "צקפוינט" (or "Tel-Aviv" / "tel aviv") share one key.
 */
export function foldKey(s: string): string {
  return foldFinals(normalizeSearchText(s)).replace(/[\s'"`.\-_/]+/g, "");
}

/** Spellings a Hebrew/Latin string may be stored with: as written, ' ↔ ׳, correct finals. */
export function spellingVariants(s: string): string[] {
  const base = normalizeSearchText(s);
  const out = new Set<string>([base]);
  if (hasHebrew(base)) out.add(fixFinals(base));
  for (const v of [...out]) {
    if (v.includes("'")) out.add(v.replace(/'/g, "\u05f3"));
    if (v.includes('"')) out.add(v.replace(/"/g, "\u05f4"));
  }
  return [...out];
}

/** Hebrew consonant skeleton of a folded key (drops the vowel letters א ע ו י). */
export const hebrewSkeleton = (folded: string) => folded.replace(/[אעוי]/g, "");
