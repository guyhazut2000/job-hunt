/**
 * Wrong-keyboard-layout recovery: text typed on the English (QWERTY) layout while meaning Hebrew
 * (standard Israeli SI-1452 layout), or the other way round. "thbyk" → "אינטל", "ןמאקך" → "intel".
 */

const EN_TO_HE: Record<string, string> = {
  q: "/",
  w: "'",
  e: "ק",
  r: "ר",
  t: "א",
  y: "ט",
  u: "ו",
  i: "ן",
  o: "ם",
  p: "פ",
  a: "ש",
  s: "ד",
  d: "ג",
  f: "כ",
  g: "ע",
  h: "י",
  j: "ח",
  k: "ל",
  l: "ך",
  ";": "ף",
  z: "ז",
  x: "ס",
  c: "ב",
  v: "ה",
  b: "נ",
  n: "מ",
  m: "צ",
  ",": "ת",
  ".": "ץ",
};

const HE_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_HE)
    .filter(([, he]) => /[\u05d0-\u05ea]/.test(he))
    .map(([en, he]) => [he, en]),
);

/** Latin keystrokes → the Hebrew letters the same keys produce. Returns null if nothing maps. */
export function latinToHebrewLayout(s: string): string | null {
  const lower = s.toLowerCase();
  if (!/^[a-z,.;' ]+$/.test(lower) || !/[a-z]/.test(lower)) return null;
  return [...lower].map((c) => (c === " " ? " " : (EN_TO_HE[c] ?? c))).join("");
}

/** Hebrew keystrokes → the Latin letters the same keys produce. Returns null if nothing maps. */
export function hebrewToLatinLayout(s: string): string | null {
  if (!/^[\u05d0-\u05ea ]+$/.test(s)) return null;
  return [...s].map((c) => (c === " " ? " " : (HE_TO_EN[c] ?? c))).join("");
}

/** The same keystrokes on the other layout (Hebrew ↔ Latin), or null when the string mixes scripts. */
export function swapLayout(s: string): string | null {
  return /[\u05d0-\u05ea]/.test(s) ? hebrewToLatinLayout(s) : latinToHebrewLayout(s);
}
