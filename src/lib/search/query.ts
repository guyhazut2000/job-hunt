/**
 * Free-text search parsing shared by /jobs and /companies.
 *
 * - Normalizes case, Latin diacritics (é → e), Hebrew niqqud/cantillation and geresh variants.
 * - Splits into terms (AND); each term carries variants (OR): Hebrew→English synonyms such as
 *   "דבאופס" → devops, "תל אביב" → tel aviv, and the ' / ׳ geresh spellings.
 * - "Quoted phrases" stay one term.
 */

export interface SearchTerm {
  /** The normalized term as typed (used for highlighting and the "no results for" message). */
  raw: string;
  /** Lower-cased alternatives; a record matches the term when any variant matches. */
  variants: string[];
}

export const MAX_QUERY_LENGTH = 100;
export const MAX_TERMS = 6;

/** Hebrew (and a few transliterated) search words → the English forms used in most job posts. */
const SYNONYMS: Record<string, string[]> = {
  // roles
  מפתח: ["developer", "engineer"],
  מפתחת: ["developer", "engineer"],
  מתכנת: ["developer", "programmer", "engineer"],
  מתכנתת: ["developer", "programmer", "engineer"],
  פיתוח: ["developer", "development", "engineer"],
  מהנדס: ["engineer"],
  מהנדסת: ["engineer"],
  הנדסה: ["engineering"],
  תוכנה: ["software"],
  דבאופס: ["devops"],
  "דב אופס": ["devops"],
  דאטה: ["data"],
  נתונים: ["data"],
  אנליסט: ["analyst"],
  אנליסטית: ["analyst"],
  "מדען נתונים": ["data scientist"],
  "בינה מלאכותית": ["ai", "artificial intelligence", "machine learning"],
  "למידת מכונה": ["machine learning", "ml"],
  בדיקות: ["qa", "test", "automation"],
  בודק: ["qa", "tester"],
  בודקת: ["qa", "tester"],
  אוטומציה: ["automation"],
  אבטחה: ["security"],
  סייבר: ["cyber", "security"],
  ענן: ["cloud"],
  תשתיות: ["infrastructure", "platform"],
  פרונטאנד: ["frontend", "front-end", "front end"],
  פרונט: ["frontend", "front-end", "front end"],
  בקאנד: ["backend", "back-end", "back end"],
  בקנד: ["backend", "back-end", "back end"],
  פולסטאק: ["full stack", "fullstack", "full-stack"],
  "פול סטאק": ["full stack", "fullstack", "full-stack"],
  פולסטק: ["full stack", "fullstack", "full-stack"],
  מובייל: ["mobile", "ios", "android"],
  מוצר: ["product"],
  "מנהל מוצר": ["product manager"],
  "מנהלת מוצר": ["product manager"],
  "ניהול מוצר": ["product manager", "product management"],
  מעצב: ["designer"],
  מעצבת: ["designer"],
  עיצוב: ["design"],
  מכירות: ["sales", "account executive"],
  שיווק: ["marketing"],
  תמיכה: ["support"],
  חומרה: ["hardware"],
  שבבים: ["chip", "asic", "vlsi", "silicon"],
  אלגוריתמים: ["algorithm"],
  מנהל: ["manager"],
  "ראש צוות": ["team lead", "team leader", "tech lead"],
  סטודנט: ["student", "intern"],
  סטודנטית: ["student", "intern"],
  סטודנטים: ["student", "intern"],
  התמחות: ["intern", "internship"],
  "ג'וניור": ["junior", "entry"],
  גוניור: ["junior", "entry"],
  סניור: ["senior"],
  בכיר: ["senior"],
  בכירה: ["senior"],
  "משרה חלקית": ["part time", "part-time"],
  // work mode
  היברידי: ["hybrid"],
  היברידית: ["hybrid"],
  מרחוק: ["remote"],
  מהבית: ["remote"],
  // places
  "תל אביב": ["tel aviv", "tel-aviv", "tlv"],
  ירושלים: ["jerusalem"],
  חיפה: ["haifa"],
  הרצליה: ["herzliya", "herzlia"],
  רעננה: ["ra'anana", "raanana"],
  "פתח תקווה": ["petah tikva", "petach tikva", "petah tiqva"],
  "פתח תקוה": ["petah tikva", "petach tikva", "petah tiqva"],
  "רמת גן": ["ramat gan"],
  נתניה: ["netanya"],
  "באר שבע": ["beer sheva", "be'er sheva", "beersheba"],
  רחובות: ["rehovot"],
  יקנעם: ["yokneam", "yoqneam"],
  "הוד השרון": ["hod hasharon"],
  "כפר סבא": ["kfar saba"],
  "ראש העין": ["rosh haayin", "rosh ha'ayin"],
  מודיעין: ["modiin", "modi'in"],
  קיסריה: ["caesarea"],
  "אור יהודה": ["or yehuda"],
  "בני ברק": ["bnei brak"],
  חולון: ["holon"],
  ישראל: ["israel"],
};

const PHRASES = Object.keys(SYNONYMS)
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length);

/** One-letter Hebrew prefixes (and, the, in, to, from, that) tried when a word is not a known synonym. */
const HEBREW_PREFIXES = new Set(["ו", "ה", "ב", "ל", "מ", "ש"]);

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
    .replace(/\u05be/g, "-") // maqaf
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip punctuation around a token but keep the characters tech names rely on (c++, c#, node.js, .net). */
function cleanToken(t: string): string {
  return t.replace(/^[^\p{L}\p{N}.#+]+/u, "").replace(/[^\p{L}\p{N}#+]+$/u, "");
}

const isHebrew = (s: string) => /[\u05d0-\u05ea]/.test(s);

function variantsFor(token: string): string[] {
  const out = new Set<string>([token]);
  const add = (k: string) => (SYNONYMS[k] ?? []).forEach((v) => out.add(v));
  add(token);
  // "בתל אביב" / "והייטק": try without a one-letter prefix, only via the synonym table (no blind stripping).
  if (out.size === 1 && isHebrew(token) && token.length >= 4 && HEBREW_PREFIXES.has(token[0])) {
    const bare = token.slice(1);
    if (SYNONYMS[bare]) {
      out.add(bare);
      add(bare);
    }
  }
  // Apostrophe spellings: ג'וניור ↔ ג׳וניור (stored text may use either).
  for (const v of [...out]) if (v.includes("'")) out.add(v.replace(/'/g, "\u05f3"));
  return [...out];
}

/** Parse a free-text query into AND-ed terms with OR-ed variants. Returns [] for an empty/blank query. */
export function parseSearchQuery(q: string | undefined | null): SearchTerm[] {
  if (!q) return [];
  let text = normalizeSearchText(q.slice(0, MAX_QUERY_LENGTH));
  const terms: SearchTerm[] = [];
  const push = (raw: string) => {
    if (!raw || terms.some((t) => t.raw === raw)) return;
    terms.push({ raw, variants: variantsFor(raw) });
  };
  // "exact phrases"
  text = text.replace(/"([^"]+)"/g, (_, p: string) => {
    push(p.trim().split(" ").map(cleanToken).filter(Boolean).join(" "));
    return " ";
  });
  // Known multi-word phrases (Hebrew city names, "מנהל מוצר"…) stay together.
  for (const p of PHRASES) {
    const source = `(^|\\s)[והבלמש]?${p}(?=\\s|$)`;
    if (new RegExp(source).test(text)) {
      push(p);
      text = text.replace(new RegExp(source, "g"), " ");
    }
  }
  for (const tok of text.split(" ")) {
    const t = cleanToken(tok);
    // Single letters are noise ("a", "ו"), except tech names like "c", "r" written with + or #.
    if (t.length < 2 && !/[#+]/.test(t)) continue;
    push(t);
  }
  return terms.slice(0, MAX_TERMS);
}

/** All strings worth highlighting in results, longest first (so "devops" wins over "dev"). */
export function highlightTerms(terms: SearchTerm[]): string[] {
  return [...new Set(terms.flatMap((t) => t.variants))]
    .filter((v) => v.length >= 2)
    .sort((a, b) => b.length - a.length);
}

/** Whether `haystack` contains the term (any variant), comparing normalized text. */
export function termMatches(term: SearchTerm, haystack: string | null | undefined): boolean {
  if (!haystack) return false;
  const h = normalizeSearchText(haystack);
  return term.variants.some((v) => h.includes(v));
}

/** Split text into plain / highlighted segments for the given terms (case/diacritics-insensitive). */
export function highlightSegments(text: string, terms: string[]): { text: string; hit: boolean }[] {
  if (!terms.length || !text) return [{ text, hit: false }];
  // Per-character normalization keeps indexes aligned with the original string.
  const chars = [...text];
  // Niqqud / combining marks normalize to "" and simply ride along with the letter before them.
  const norm = chars.map((c) => normalizeSearchText(c) || (/\s/.test(c) ? " " : ""));
  const flat = norm.join("");
  // Map each position in `flat` back to its source char.
  const owner: number[] = [];
  norm.forEach((n, i) => {
    for (let k = 0; k < n.length; k++) owner.push(i);
  });
  const hit = new Array<boolean>(chars.length).fill(false);
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = flat.indexOf(term, from);
      if (at < 0) break;
      for (let k = at; k < at + term.length; k++) hit[owner[k]] = true;
      from = at + term.length;
    }
  }
  norm.forEach((n, i) => {
    if (!n && i > 0) hit[i] = hit[i - 1];
  });
  const out: { text: string; hit: boolean }[] = [];
  chars.forEach((c, i) => {
    const last = out[out.length - 1];
    if (last && last.hit === hit[i]) last.text += c;
    else out.push({ text: c, hit: hit[i] });
  });
  return out;
}
