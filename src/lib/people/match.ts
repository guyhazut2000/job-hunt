import type { PeopleGroup } from "@prisma/client";
import { cleanCompanyName } from "@/lib/outreach/links";
import { GROUP_TERMS } from "./groups";
import type { ParsedFields } from "./parse";

/** Show cards at or above this; between LOW and SHOW they're labelled "uncertain"; below LOW they're dropped. */
export const CONFIDENCE_SHOW = 50;
export const CONFIDENCE_LOW = 30;

export function normalizeCompany(name: string): string {
  return cleanCompanyName(name)
    .toLowerCase()
    .replace(/\.(com|io|ai|co|co\.il|net|org)$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word (Unicode-aware) occurrence of the company name in text. "Wix" ≠ "Wixel". */
export function mentionsCompany(text: string | null | undefined, company: string): boolean {
  if (!text) return false;
  const c = normalizeCompany(company);
  if (!c) return false;
  const hay = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return new RegExp(`(?:^|\\s)${escape(c).replace(/ /g, "\\s+")}(?:\\s|$)`, "u").test(hay);
}

/** Bigram Dice similarity, 0–1 (for "Experience: Wiz Inc" vs "Wiz"). */
export function dice(a: string, b: string): number {
  const x = normalizeCompany(a).replace(/\s/g, "");
  const y = normalizeCompany(b).replace(/\s/g, "");
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const gx = grams(x);
  const gy = grams(y);
  let hit = 0;
  for (const [g, n] of gx) hit += Math.min(n, gy.get(g) ?? 0);
  return (2 * hit) / (x.length - 1 + (y.length - 1));
}

/** "ex-Wiz", "former Wiz", "previously at Wiz", "לשעבר ב-Wiz". */
function formerMention(text: string, company: string): boolean {
  const c = escape(normalizeCompany(company)).replace(/ /g, "[\\s\\W]+");
  return new RegExp(
    `(?:\\bex[-\\s]?|\\bformer(?:ly)?\\s+(?:at\\s+)?|\\bpreviously\\s+(?:at\\s+)?|\\bprev\\.?\\s+|לשעבר\\s+ב-?)${c}`,
    "iu",
  ).test(text.toLowerCase());
}

/**
 * Heuristic confidence that a search result is someone who currently works at `company` in `group`.
 * Uses only the parsed search-result fields.
 */
export function scoreMatch(f: ParsedFields, company: string, group: PeopleGroup) {
  const headline = f.headline ?? "";
  const lastTitlePart = f.titleParts.at(-1) ?? "";
  const expMatch = !!f.experience && (mentionsCompany(f.experience, company) || dice(f.experience, company) >= 0.85);
  const titleMatch = f.titleParts.some((p) => mentionsCompany(p, company)) || dice(lastTitlePart, company) >= 0.85;
  const headlineMatch = mentionsCompany(headline, company);
  const descMatch = mentionsCompany(f.description, company);
  const all = `${headline} ${f.titleParts.join(" ")} ${f.description}`;
  const former = formerMention(all, company) && !expMatch;

  let score = 0;
  if (expMatch) score += 50;
  if (titleMatch) score += 35;
  else if (headlineMatch) score += 30;
  if (descMatch && !expMatch && !titleMatch && !headlineMatch) score += 20;
  const roleText = `${headline} ${f.description}`.toLowerCase();
  if (GROUP_TERMS[group].some((t) => roleText.includes(t.toLowerCase()))) score += 15;
  if (/israel|ישראל|tel aviv|תל אביב|herzliya|הרצליה|haifa|חיפה|jerusalem|ירושלים/i.test(f.location ?? all))
    score += 10;
  if (former) score -= 45;

  const confidence = Math.max(0, Math.min(100, score));
  return { confidence, companyMatch: (expMatch || titleMatch || headlineMatch) && !former };
}
