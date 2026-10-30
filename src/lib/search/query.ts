/**
 * Free-text search parsing shared by /jobs, the map, /companies, the assistant and saved searches.
 *
 * Bilingual (Hebrew ↔ English) by design:
 * - Normalizes case, Latin diacritics (é → e), Hebrew niqqud, final letters (ךםןףץ), geresh/quotes,
 *   hyphens and spaces ("צ'ק פוינט" = "צק-פוינט" = "צקפוינט").
 * - Splits into terms (AND); each term carries variants (OR). A recognized word or phrase brings its
 *   whole cross-language group: a company's names and aliases ("אינטל" ↔ "Intel"), or a glossary
 *   entry ("חיפה" ↔ "Haifa", "ריאקט" ↔ "React", "מפתח" → developer).
 * - Fallbacks: a wrong keyboard layout ("thbyk" → "אינטל"), and a phonetic transliteration match
 *   for Hebrew spellings of company names that are not in the alias lists ("אינטעל" → Intel).
 * - "Quoted phrases" stay one term.
 */
import { TECH_KEYWORDS } from "../taxonomy";
import { GLOSSARY, type GlossaryGroup } from "./glossary";
import { swapLayout } from "./layout";
import type { CompanyLexicon, LexiconEntry } from "./lexicon";
import { phoneticKey } from "./phonetic";
import { foldKey, hasHebrew, hasLatin, hebrewSkeleton, normalizeSearchText, spellingVariants } from "./text";

export { normalizeSearchText } from "./text";

export type ExpansionReason = "company" | "glossary" | "layout" | "phonetic";

export interface TermExpansion {
  /** What the query was also searched as, in the other language/layout ("Intel", "אינטל", "Haifa"). */
  label: string;
  reason: ExpansionReason;
}

export interface SearchTerm {
  /** The normalized term as typed (used for highlighting and the "no results for" message). */
  raw: string;
  /** Lower-cased alternatives; a record matches the term when any variant matches. */
  variants: string[];
  /** Companies the term names (recognized through the company lexicon). */
  companyIds?: string[];
  /** Cross-language expansions, for the "also showing results for …" hint. */
  also?: TermExpansion[];
}

export interface ParseOptions {
  /** Company names/aliases; without it only the glossary is used (e.g. client-side). */
  companies?: CompanyLexicon;
}

export const MAX_QUERY_LENGTH = 100;
export const MAX_TERMS = 6;

interface GlossaryHit {
  group: GlossaryGroup;
  side: "he" | "en";
}

const GLOSSARY_INDEX = new Map<string, GlossaryHit[]>();
let GLOSSARY_MAX_WORDS = 1;
for (const group of GLOSSARY) {
  for (const side of ["he", "en"] as const) {
    for (const m of group[side]) {
      const k = foldKey(m);
      const list = GLOSSARY_INDEX.get(k) ?? [];
      if (!list.some((h) => h.group === group)) list.push({ group, side });
      GLOSSARY_INDEX.set(k, list);
      GLOSSARY_MAX_WORDS = Math.max(GLOSSARY_MAX_WORDS, m.split(" ").length);
    }
  }
}

const TECH_KEYS = new Set(Object.keys(TECH_KEYWORDS).map(foldKey));

/** One-letter Hebrew prefixes (and, the, in, to, from, that) tried when a word is not known as-is. */
const HEBREW_PREFIXES = new Set(["ו", "ה", "ב", "ל", "מ", "ש", "כ"]);

/** Strip punctuation around a token but keep the characters tech names rely on (c++, c#, node.js, .net). */
function cleanToken(t: string): string {
  return t.replace(/^[^\p{L}\p{N}.#+]+/u, "").replace(/[^\p{L}\p{N}#+]+$/u, "");
}

interface Lookup {
  /** The phrase as found in the vocabulary (prefix-stripped when needed). */
  matched: string;
  glossary: GlossaryHit[];
  companies: LexiconEntry[];
}

function exactLookup(phrase: string, lex?: CompanyLexicon): Lookup | null {
  const tryKey = (p: string, stripped: boolean): Lookup | null => {
    const k = foldKey(p);
    if (k.length < 2) return null;
    const glossary = GLOSSARY_INDEX.get(k) ?? [];
    // A stripped prefix only reveals a company when what is left is distinctive ("באינטל", not "שנים").
    const companies = stripped && k.length < 5 ? [] : (lex?.byKey.get(k) ?? []);
    return glossary.length || companies.length ? { matched: p, glossary, companies } : null;
  };
  const direct = tryKey(phrase, false);
  if (direct) return direct;
  if (lex?.common.has(foldKey(phrase))) return null;
  // "בתל אביב", "והייטק", "באינטל", "ובחיפה": up to two one-letter prefixes.
  let p = phrase;
  for (let i = 0; i < 2 && hasHebrew(p[0] ?? "") && foldKey(p).length >= 4 && HEBREW_PREFIXES.has(p[0]); i++) {
    p = p.slice(1);
    const hit = tryKey(p, true);
    if (hit) return hit;
  }
  return null;
}

/** "אינטעל" vs "אינטל", "מייקרוסופט" vs "מיקרוסופט": equal except one extra א/ע/ו/י. */
function oneVowelLetterApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) {
    if (long[i] !== short[i]) return "אעוי".includes(long[i]) && long.slice(i + 1) === short.slice(i);
  }
  return false;
}

/**
 * Spelling/transliteration fallback for Hebrew input: a near spelling of a stored Hebrew name
 * ("אינטעל" ≈ "אינטל", "סלספורס" ≈ "סיילספורס"), or — for companies with no Hebrew name yet — the
 * sound of the Latin name. Everyday words are never read as companies.
 */
function phoneticLookup(phrase: string, lex?: CompanyLexicon): Lookup | null {
  if (!lex || !hasHebrew(phrase) || hasLatin(phrase)) return null;
  if (phrase.split(" ").some((w) => lex.common.has(foldKey(w)))) return null;
  const k = foldKey(phrase);
  if (k.length < 5) return null;
  const skeleton = hebrewSkeleton(k);
  const found = new Set<LexiconEntry>();
  for (const h of lex.hebrewNames) {
    if ((skeleton.length >= 5 && h.skeleton === skeleton) || oneVowelLetterApart(k, h.folded)) found.add(h.entry);
  }
  for (const e of lex.byPhonetic.get(phoneticKey(phrase)) ?? []) found.add(e);
  // Only an unambiguous match counts as a recognized name.
  return found.size >= 1 && found.size <= 2 ? { matched: phrase, glossary: [], companies: [...found] } : null;
}

function layoutLookup(rawPhrase: string, lex?: CompanyLexicon): Lookup | null {
  if (foldKey(rawPhrase).length < 3) return null;
  const swapped = swapLayout(rawPhrase);
  if (!swapped) return null;
  const phrase = swapped.split(" ").map(cleanToken).filter(Boolean).join(" ");
  if (!phrase) return null;
  const hit = exactLookup(phrase, lex);
  if (hit) return hit;
  // Hebrew keys for an English tech word: "רקשבא" → "react".
  if (!hasHebrew(phrase) && TECH_KEYS.has(foldKey(phrase))) return { matched: phrase, glossary: [], companies: [] };
  return null;
}

function buildTerm(typed: string, hit: Lookup | null, reason: ExpansionReason | null): SearchTerm {
  const variants = new Set<string>(spellingVariants(typed));
  const also: TermExpansion[] = [];
  const addLabel = (label: string | null | undefined, r: ExpansionReason) => {
    if (!label) return;
    if (foldKey(label) === foldKey(typed)) return;
    if (!also.some((a) => foldKey(a.label) === foldKey(label))) also.push({ label, reason: r });
  };
  if (hit) {
    spellingVariants(hit.matched).forEach((v) => variants.add(v));
    const typedHebrew = hasHebrew(hit.matched);
    for (const { group, side } of hit.glossary) {
      const members = side === "he" ? [...group.he, ...group.en, ...(group.heOnly ?? [])] : [...group.en, ...group.he];
      members.forEach((m) => spellingVariants(m).forEach((v) => variants.add(v)));
      const other = side === "he" ? (group.en[0] ?? group.heOnly?.[0]) : group.he[0];
      addLabel(reason === "layout" ? hit.matched : other, reason ?? "glossary");
    }
    for (const e of hit.companies) {
      e.variants.forEach((v) => variants.add(v));
      variants.add(normalizeSearchText(e.name));
      const label =
        reason === "layout" ? (typedHebrew ? (e.nameHe ?? e.name) : e.name) : typedHebrew ? e.name : e.nameHe;
      addLabel(label, reason ?? "company");
    }
    if (!hit.glossary.length && !hit.companies.length) addLabel(hit.matched, reason ?? "layout");
  }
  const term: SearchTerm = { raw: typed, variants: [...variants] };
  if (hit?.companies.length) term.companyIds = [...new Set(hit.companies.map((e) => e.id))];
  if (also.length) term.also = also;
  return term;
}

/** Parse a free-text query into AND-ed terms with OR-ed variants. Returns [] for an empty/blank query. */
export function parseSearchQuery(q: string | undefined | null, opts: ParseOptions = {}): SearchTerm[] {
  if (!q) return [];
  const lex = opts.companies;
  let text = normalizeSearchText(q.slice(0, MAX_QUERY_LENGTH));
  const terms: SearchTerm[] = [];
  const push = (term: SearchTerm) => {
    if (!term.raw || terms.some((t) => t.raw === term.raw)) return;
    terms.push(term);
  };
  // "exact phrases"
  text = text.replace(/"([^"]+)"/g, (_, p: string) => {
    const phrase = p.trim().split(" ").map(cleanToken).filter(Boolean).join(" ");
    if (phrase) push(buildTerm(phrase, exactLookup(phrase, lex), null));
    return " ";
  });
  const tokens = text.split(" ").filter(Boolean);
  const maxWords = Math.max(GLOSSARY_MAX_WORDS, lex?.maxWords ?? 1);
  let i = 0;
  while (i < tokens.length) {
    let done = false;
    const span = Math.min(maxWords, tokens.length - i);
    const passes: [ExpansionReason | null, (raw: string[], clean: string) => Lookup | null][] = [
      [null, (_raw, clean) => exactLookup(clean, lex)],
      ["layout", (raw) => layoutLookup(raw.join(" "), lex)],
      ["phonetic", (_raw, clean) => phoneticLookup(clean, lex)],
    ];
    for (const [reason, lookup] of passes) {
      for (let n = span; n >= 1 && !done; n--) {
        const raw = tokens.slice(i, i + n);
        const cleaned = raw.map(cleanToken);
        if (cleaned.some((c) => !c)) continue;
        const clean = cleaned.join(" ");
        const hit = lookup(raw, clean);
        if (!hit) continue;
        push(buildTerm(clean, hit, reason));
        i += n;
        done = true;
      }
      if (done) break;
    }
    if (done) continue;
    const t = cleanToken(tokens[i]);
    i++;
    // Single letters are noise ("a", "ו"), except tech names like "c", "r" written with + or #.
    if (t.length < 2 && !/[#+]/.test(t)) continue;
    push(buildTerm(t, null, null));
  }
  return terms.slice(0, MAX_TERMS);
}

/** Labels the query was also searched as (other language / keyboard layout), for the results hint. */
export function expansionLabels(terms: SearchTerm[], max = 3): string[] {
  const out: string[] = [];
  for (const t of terms) for (const a of t.also ?? []) if (!out.includes(a.label)) out.push(a.label);
  return out.slice(0, max);
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
