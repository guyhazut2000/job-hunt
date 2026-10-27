import type { PeopleGroup } from "@prisma/client";
import { scoreMatch } from "./match";

/** A raw Brave web result — the only input we ever parse. */
export interface SearchResult {
  title?: string;
  url?: string;
  description?: string;
}

/** What we keep: derived only from the result's title, description and URL. */
export interface PersonCard {
  /** Normalised profile slug, used for dedupe and hide/report. */
  key: string;
  name: string;
  headline: string | null;
  location: string | null;
  url: string;
  group: PeopleGroup;
  /** 0–100: how plausible it is that this person currently works at the company. */
  confidence: number;
  /** Company name appears in the current-role parts of the result. */
  companyMatch: boolean;
}

const SLUG = /^[\p{L}\p{N}\-_.%]{2,100}$/u;

/**
 * Canonical `https://www.linkedin.com/in/<slug>` for a profile URL found in search results, or null.
 * Accepts country subdomains (il.linkedin.com) and trailing locale/extra segments; rejects everything else.
 */
export function normalizeProfileUrl(raw: string | undefined | null): { url: string; key: string } | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (host !== "linkedin.com" && !/^[a-z]{2,3}\.linkedin\.com$/.test(host)) return null;
  const m = /^\/in\/([^/?#]+)\/?(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/i.exec(u.pathname);
  if (!m) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  slug = slug.normalize("NFC").toLowerCase();
  if (!SLUG.test(slug) || /^(?:[-_.]+)$/.test(slug)) return null;
  return { url: `https://www.linkedin.com/in/${encodeURIComponent(slug)}`, key: slug };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Brave snippets carry <strong> highlights and HTML entities. */
export function cleanText(s: string | undefined | null): string {
  return (s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (all, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : all;
      }
      return ENTITIES[e.toLowerCase()] ?? all;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const SEP = /\s+[-–—|]\s+/;
const LINKEDIN_SUFFIX = /\s*[|\-–—]\s*LinkedIn\s*$/i;

/** A plausible human name: 1–5 words, letters only (Latin/Hebrew/etc.), no "LinkedIn"/"Jobs" noise. */
export function plausibleName(s: string): boolean {
  if (s.length < 2 || s.length > 60) return false;
  if (/linkedin|jobs?\b|hiring|profiles?\b|\d/i.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length > 5) return false;
  return words.every((w) => /^[\p{L}][\p{L}\p{M}.'’\-]*$/u.test(w));
}

const LOCATION = /(?:Location|מיקום)\s*:\s*([^·|]+?)(?:\s*·|\s*\||$)/i;
const EXPERIENCE = /(?:Experience|ניסיון)\s*:\s*([^·|]+?)(?:\s*·|\s*\||$)/i;
const LOCATION_TAIL = /(?:^|·\s*)([\p{L} .,'\-]+,\s*(?:Israel|ישראל))\b/u;

export interface ParsedFields {
  name: string;
  /** Title parts after the name, e.g. ["Senior Recruiter", "Wiz"]. */
  titleParts: string[];
  headline: string | null;
  experience: string | null;
  location: string | null;
  description: string;
}

/** Split a result into name / headline / experience / location using only title + description. */
export function parseFields(r: SearchResult): ParsedFields | null {
  const title = cleanText(r.title).replace(LINKEDIN_SUFFIX, "").trim();
  if (!title) return null;
  const [rawName, ...titleParts] = title.split(SEP).map((p) => p.trim());
  const name = rawName
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plausibleName(name)) return null;
  const description = cleanText(r.description);
  const experience = EXPERIENCE.exec(description)?.[1]?.trim() ?? null;
  const location = (LOCATION.exec(description)?.[1] ?? LOCATION_TAIL.exec(description)?.[1])?.trim() ?? null;
  // Headline: title parts (minus a trailing company part) or the first snippet segment.
  let headline = titleParts.join(" · ") || null;
  if (!headline) {
    const first = description.split(/\s*·\s*/)[0];
    if (first && !EXPERIENCE.test(first) && !LOCATION.test(first) && first.length <= 160) headline = first;
  }
  return { name, titleParts, headline, experience, location, description };
}

/** Parse, score, validate and dedupe a page of Brave results into person cards. */
export function parseResults(results: SearchResult[], company: string, group: PeopleGroup): PersonCard[] {
  const seen = new Set<string>();
  const out: PersonCard[] = [];
  for (const r of results) {
    const profile = normalizeProfileUrl(r.url);
    if (!profile || seen.has(profile.key)) continue;
    const f = parseFields(r);
    if (!f) continue;
    seen.add(profile.key);
    const m = scoreMatch(f, company, group);
    out.push({
      key: profile.key,
      name: f.name,
      headline: f.headline?.slice(0, 200) ?? null,
      location: f.location?.slice(0, 80) ?? null,
      url: profile.url,
      group,
      confidence: m.confidence,
      companyMatch: m.companyMatch,
    });
  }
  return out;
}

/** First name for personalising the connection note ("Dana Example" → "Dana"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** "Dana Example" → "DE"; single word → first two letters. */
export function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  if (w.length === 1) return [...w[0]].slice(0, 2).join("").toUpperCase();
  return ([...w[0]][0] + [...w[w.length - 1]][0]).toUpperCase();
}
