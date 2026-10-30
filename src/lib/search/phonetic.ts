/**
 * Script-neutral consonant skeleton used as the deterministic transliteration fallback: a Hebrew
 * spelling and a Latin spelling of the same name usually reduce to the same key.
 *   "Intel" → "ntl", "אינטל" / "אינטעל" → "ntl"; "Check Point" / "צ'ק פוינט" → "chkpnt".
 * Vowels (a e i o u y / א ע single ו י) are dropped, similar-sounding consonants merged.
 */
import { foldFinals, normalizeSearchText } from "./text";

function hebrewKey(word: string): string {
  const w = foldFinals(word);
  let out = "";
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const next = w[i + 1];
    const geresh = next === "'";
    if (geresh) i++;
    switch (c) {
      case "א":
      case "ע":
      case "י":
        break;
      case "ה":
        if (i === 0) out += "h";
        break;
      case "ו":
        if (next === "ו") {
          out += "b";
          i++;
        } else if (i === 0) out += "b";
        break;
      case "ב":
        out += "b";
        break;
      case "ג":
        out += geresh ? "g" : "g";
        break;
      case "ד":
        out += "d";
        break;
      case "ז":
        out += "z";
        break;
      case "ח":
        out += "h";
        break;
      case "ט":
      case "ת":
        out += "t";
        break;
      case "כ":
      case "ק":
        out += "k";
        break;
      case "ל":
        out += "l";
        break;
      case "מ":
        out += "m";
        break;
      case "נ":
        out += "n";
        break;
      case "ס":
        out += "s";
        break;
      case "פ":
        out += "p";
        break;
      case "צ":
        out += geresh ? "ch" : "ts";
        break;
      case "ר":
        out += "r";
        break;
      case "ש":
        out += "sh";
        break;
      default:
        if (/[0-9]/.test(c)) out += c;
    }
  }
  return out;
}

function latinKey(word: string): string {
  const w = word
    .replace(/[^a-z0-9]/g, "")
    .replace(/ph/g, "p")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/(kh|gh)/g, "h")
    .replace(/th/g, "t")
    .replace(/(tz|ts)/g, "\u0001") // ts placeholder
    .replace(/sh/g, "\u0002") // sh placeholder
    .replace(/ch/g, "\u0003") // ch placeholder
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cqk]/g, "k")
    .replace(/x/g, "ks")
    .replace(/j/g, "g")
    .replace(/[vw]/g, "b")
    .replace(/f/g, "p");
  let out = "";
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if ("aeiouy".includes(c)) continue;
    if (c === "h") {
      if (i === 0) out += "h";
      continue;
    }
    out += c === "\u0001" ? "ts" : c === "\u0002" ? "sh" : c === "\u0003" ? "ch" : c;
  }
  return out;
}

/** Consonant skeleton of a name in either script; adjacent repeats collapse ("Wixx" = "Wix"). */
export function phoneticKey(input: string): string {
  const words = normalizeSearchText(input)
    .split(/[\s\-_.]+/)
    .filter(Boolean);
  const key = words.map((w) => (/[\u05d0-\u05ea]/.test(w) ? hebrewKey(w) : latinKey(w))).join("");
  return key.replace(/(.)\1+/g, "$1");
}
