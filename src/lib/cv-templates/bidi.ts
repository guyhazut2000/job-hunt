/** Direction helpers for mixed Hebrew/English CV text (PDF, DOCX and HTML renderers). */

const HEB = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const STRONG = /[A-Za-z\u00C0-\u024F\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF]/;

export const hasHebrew = (s: string) => HEB.test(s);

/** Direction of a paragraph from its first strong character (Unicode P2/P3); `fallback` if none. */
export function dirOf(text: string, fallback: "rtl" | "ltr" = "ltr"): "rtl" | "ltr" {
  const m = text.match(STRONG);
  if (!m) return fallback;
  return HEB.test(m[0]) || /[\u0600-\u06FF]/.test(m[0]) ? "rtl" : "ltr";
}

/** Share of Hebrew letters among all letters (0..1). */
export function hebrewRatio(strings: string[]): number {
  let he = 0;
  let all = 0;
  for (const s of strings)
    for (const ch of s) {
      if (HEB.test(ch)) {
        he++;
        all++;
      } else if (/[A-Za-z]/.test(ch)) all++;
    }
  return all ? he / all : 0;
}

/** Language of the content as written. Israeli Hebrew CVs are full of English tech terms, so a
 * modest Hebrew share is enough. */
export function detectLanguage(strings: string[]): "he" | "en" {
  return hebrewRatio(strings) >= 0.25 ? "he" : "en";
}

const LATIN = /[A-Za-z\u00C0-\u024F]/;

/**
 * Paragraph direction inside a CV of a given language. In a Hebrew CV any line containing Hebrew
 * is RTL (so "B.Sc. במדעי המחשב" reads correctly) and only pure-Latin lines are LTR; in an
 * English CV any line containing Latin is LTR.
 */
export function paraDir(text: string, cvDir: "rtl" | "ltr"): "rtl" | "ltr" {
  if (cvDir === "rtl") return HEB.test(text) || !LATIN.test(text) ? "rtl" : "ltr";
  return LATIN.test(text) || !HEB.test(text) ? "ltr" : "rtl";
}

export interface Segment {
  text: string;
  rtl: boolean;
}

/**
 * Split text into script runs for DOCX: Hebrew runs (with the neutrals between Hebrew letters)
 * are RTL, Latin/number runs (emails, URLs, tech names, dates) are LTR. Neutrals at a boundary
 * follow the paragraph direction, so punctuation lands on the correct side in Word.
 */
export function segments(text: string, paragraphRtl: boolean): Segment[] {
  const out: Segment[] = [];
  type K = "he" | "lat" | "n";
  const kind = (ch: string): K => (HEB.test(ch) ? "he" : /[A-Za-z0-9@\u00C0-\u024F]/.test(ch) ? "lat" : "n");
  const chars = [...text];
  // Resolve neutrals: between two runs of the same kind → that kind; otherwise paragraph direction.
  const kinds = chars.map(kind);
  const resolved: ("he" | "lat")[] = kinds.map((k) => (k === "n" ? "he" : k));
  for (let i = 0; i < chars.length; i++) {
    if (kinds[i] !== "n") continue;
    let a = i - 1;
    while (a >= 0 && kinds[a] === "n") a--;
    let b = i + 1;
    while (b < chars.length && kinds[b] === "n") b++;
    const before = a >= 0 ? kinds[a] : null;
    const after = b < chars.length ? kinds[b] : null;
    // Keep URL/email punctuation (.:/-_ etc) glued to Latin runs.
    const glue = /[./:_\-+#%&=?~]/.test(chars[i]) && before === "lat" && after === "lat";
    if (glue || (before && before === after)) resolved[i] = before as "he" | "lat";
    else resolved[i] = paragraphRtl ? "he" : "lat";
  }
  for (let i = 0; i < chars.length; i++) {
    const rtl = resolved[i] === "he";
    const last = out.at(-1);
    if (last && last.rtl === rtl) last.text += chars[i];
    else out.push({ text: chars[i], rtl });
  }
  return out;
}

const PAD = (n: string) => n.padStart(2, "0");
/** "2022-03" → "03/2022", "2020" → "2020". */
export function fmtMonth(ym: string): string {
  const m = ym.match(/^(\d{4})(?:-(\d{1,2}))?$/);
  if (!m) return ym;
  return m[2] ? `${PAD(m[2])}/${m[1]}` : m[1];
}

/** Date range for an entry; empty end = present. Uses an en dash with spaces. */
export function period(start: string, end: string, present: string): string {
  if (!start && !end) return "";
  if (!start) return fmtMonth(end);
  return `${fmtMonth(start)} – ${end ? fmtMonth(end) : present}`;
}

/** "https://www.linkedin.com/in/x/" → "linkedin.com/in/x". */
export function shortUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}
