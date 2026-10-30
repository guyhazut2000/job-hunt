/**
 * Company name lexicon for bilingual search: every company's English name, Hebrew name(s) and
 * aliases form one alias group. Recognizing any member (exactly, after normalization, or by the
 * phonetic transliteration fallback) adds the whole group, so "אינטל" and "Intel" search the same.
 * Pure: the server loads companies (see `lexicon-server.ts`) and passes the lexicon to `parseSearchQuery`.
 */
import { COMMON_HEBREW_WORDS } from "./common-hebrew-words";
import { CURATED_COMPANY_NAMES } from "./company-names";
import { GENERATED_COMPANY_NAMES_HE } from "./company-names.generated";
import { phoneticKey } from "./phonetic";
import { foldKey, hasHebrew, hebrewSkeleton, normalizeSearchText, spellingVariants } from "./text";

export { hebrewSkeleton };

export interface LexiconCompanyInput {
  id: string;
  name: string;
  /** Stored Hebrew display name (DB), if any. */
  nameHe?: string | null;
  /** Stored aliases (DB), if any. */
  aliases?: string[] | null;
}

export interface LexiconEntry {
  id: string;
  name: string;
  /** Hebrew display name, when known. */
  nameHe: string | null;
  /** Every spelling (normalized) the company can be recognized by. */
  names: string[];
  /** Spellings used as free-text search variants (ambiguous everyday words left out). */
  variants: string[];
}

export interface CompanyLexicon {
  byKey: Map<string, LexiconEntry[]>;
  /** Latin-name sound keys, for companies with no Hebrew name yet (transliteration fallback). */
  byPhonetic: Map<string, LexiconEntry[]>;
  /** Hebrew names (folded) for near-spelling matches ("אינטעל", "מייקרוסופט"). */
  hebrewNames: { folded: string; skeleton: string; entry: LexiconEntry }[];
  /** Longest alias in words, to bound n-gram lookups. */
  maxWords: number;
  entries: LexiconEntry[];
  /** Fold keys of everyday Hebrew words: never read as a company by prefix-stripping or sound. */
  common: Set<string>;
}

const COMMON = new Set(COMMON_HEBREW_WORDS.split(" ").map(foldKey));

/** Trailing words that do not identify a company ("Elbit Systems" is found as "Elbit"). */
const GENERIC_SUFFIXES = new Set([
  "systems",
  "system",
  "technologies",
  "technology",
  "tech",
  "networks",
  "network",
  "security",
  "labs",
  "lab",
  "software",
  "medical",
  "israel",
  "il",
  "group",
  "inc",
  "ltd",
  "corp",
  "corporation",
  "solutions",
  "industries",
  "international",
  "global",
  "ai",
  "io",
  "com",
  "co",
  "company",
  "hq",
  "r&d",
  "rd",
  'בע"מ',
  "ישראל",
  "בעמ",
]);

/**
 * Hebrew aliases that are also everyday words ("כלל" = rule, "לאומי" = national). They still
 * identify the company, but are not used to search job descriptions.
 */
const AMBIGUOUS_HE = new Set(
  [
    "כלל",
    "טבע",
    "לאומי",
    "הפועלים",
    "מכבי",
    "הבורסה",
    "כתר",
    "ארד",
    "נגה",
    "ויה",
    "גט",
    "מקס",
    "מר",
    "אמן",
    "סיטי",
    "מיין",
    "יוניט",
    "פורט",
    "שילד",
    "רייז",
    "פיינל",
    "פיי",
    "קלע",
    "אור",
    "נובה",
    "אלה",
    "מטא",
    "אפל",
    "ארם",
    "תמה",
    "הראל",
    "מגדל",
    "פניקס",
    "הפניקס",
    "דלק",
    "שטראוס",
    "אלקטרה",
    "אוסם",
    "ביטוח",
    "בנק",
    "אמזון",
    "קשת",
    "רשת",
    "פרטנר",
    "סלקום",
  ].map(foldKey),
);

/** Core name without generic trailing words, or null when nothing distinctive is left. */
export function coreName(name: string): string | null {
  const words = normalizeSearchText(name).split(" ");
  while (words.length > 1 && GENERIC_SUFFIXES.has(words[words.length - 1].replace(/[.,]/g, ""))) words.pop();
  const core = words.join(" ");
  return core !== normalizeSearchText(name) && foldKey(core).length >= 3 ? core : null;
}

/** Hebrew names and aliases for a company: DB columns first, then the curated and generated maps. */
export function companyNameForms(c: LexiconCompanyInput): { nameHe: string | null; aliases: string[] } {
  const curated = CURATED_COMPANY_NAMES[c.name];
  const generated = GENERATED_COMPANY_NAMES_HE[c.name];
  const he = [c.nameHe, ...(curated?.he ?? []), generated].filter((v): v is string => !!v && !!v.trim());
  const aliases = [...he, ...(c.aliases ?? []), ...(curated?.aka ?? [])];
  return { nameHe: he[0] ?? null, aliases: [...new Set(aliases.map((a) => a.trim()).filter(Boolean))] };
}

export function buildCompanyLexicon(companies: LexiconCompanyInput[]): CompanyLexicon {
  const byKey = new Map<string, LexiconEntry[]>();
  const byPhonetic = new Map<string, LexiconEntry[]>();
  const entries: LexiconEntry[] = [];
  const hebrewNames: CompanyLexicon["hebrewNames"] = [];
  let maxWords = 1;
  const put = (map: Map<string, LexiconEntry[]>, key: string, e: LexiconEntry) => {
    if (!key) return;
    const list = map.get(key);
    if (!list) map.set(key, [e]);
    else if (!list.includes(e)) list.push(e);
  };
  for (const c of companies) {
    const { nameHe, aliases } = companyNameForms(c);
    const core = coreName(c.name);
    const names = [...new Set([c.name, ...(core ? [core] : []), ...aliases].map(normalizeSearchText).filter(Boolean))];
    const variants = new Set<string>();
    for (const n of names) {
      const k = foldKey(n);
      if (k.length < 2) continue;
      if (hasHebrew(n) && (k.length < 3 || AMBIGUOUS_HE.has(k))) continue;
      spellingVariants(n).forEach((v) => variants.add(v));
    }
    const e: LexiconEntry = { id: c.id, name: c.name, nameHe, names, variants: [...variants] };
    entries.push(e);
    for (const n of names) {
      const k = foldKey(n);
      if (k.length < 2) continue;
      put(byKey, k, e);
      maxWords = Math.max(maxWords, n.split(" ").length);
      if (hasHebrew(n)) {
        if (k.length >= 4) hebrewNames.push({ folded: k, skeleton: hebrewSkeleton(k), entry: e });
      } else if (!nameHe) {
        const p = phoneticKey(n);
        if (p.length >= 5) put(byPhonetic, p, e);
      }
    }
  }
  return { byKey, byPhonetic, hebrewNames, maxWords: Math.min(maxWords, 5), entries, common: COMMON };
}
