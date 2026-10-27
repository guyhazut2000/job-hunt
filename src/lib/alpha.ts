/** Alphabetical index for directory pages: Latin A–Z, then Hebrew א–ת, then "#" for digits/other. */

export const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const HEBREW = "אבגדהוזחטיכלמנסעפצקרשת".split("");
export const OTHER = "#";

const FINAL_FORMS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Group key for a name: first letter, ignoring leading quotes/punctuation/whitespace. */
export function letterOf(name: string): string {
  const ch = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "") // Latin diacritics, Hebrew niqqud
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .charAt(0);
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
  const he = FINAL_FORMS[ch] ?? ch;
  if (HEBREW.includes(he)) return he;
  return OTHER;
}

const ORDER = [...LATIN, ...HEBREW, OTHER];
const collator = new Intl.Collator(["en", "he"], { sensitivity: "base", numeric: true });

export interface LetterGroup<T> {
  letter: string;
  items: T[];
}

export function groupByLetter<T>(items: T[], nameOf: (item: T) => string): LetterGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const l = letterOf(nameOf(item));
    map.set(l, [...(map.get(l) ?? []), item]);
  }
  return ORDER.filter((l) => map.has(l)).map((letter) => ({
    letter,
    items: map.get(letter)!.sort((a, b) => collator.compare(nameOf(a), nameOf(b))),
  }));
}

/** Stable, URL-safe anchor id for a letter section. */
export const letterAnchor = (letter: string) =>
  letter === OTHER
    ? "letter-other"
    : HEBREW.includes(letter)
      ? `letter-he-${HEBREW.indexOf(letter) + 1}`
      : `letter-${letter}`;
