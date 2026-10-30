import type { Prisma } from "@prisma/client";
import { TECH_KEYWORDS } from "../taxonomy";
import { normalizeSearchText, type SearchTerm, termMatches } from "../search/query";

/** Company ids whose name/website match each term (keyed by `SearchTerm.raw`). */
export type CompanyMatches = Record<string, string[]>;

const CANONICAL_TECH = new Map<string, string>(
  Object.entries(TECH_KEYWORDS).flatMap(([k, v]) => [
    [k, v],
    [v.toLowerCase(), v],
  ]),
);

/** Canonical tech-stack tags (as stored in Job.techStack) a term refers to, e.g. "kubernetes" → "Kubernetes". */
export function techTagsFor(term: SearchTerm): string[] {
  return [...new Set(term.variants.map((v) => CANONICAL_TECH.get(v)).filter((v): v is string => !!v))];
}

const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });

/**
 * One AND-clause per term; inside, OR over every field × variant. Columns are plain ILIKE so the
 * pg_trgm GIN indexes apply. Company matches are pre-resolved to ids (BitmapOr-friendly) when given;
 * otherwise a relational filter is used.
 */
export function searchWhere(terms: SearchTerm[], companies?: CompanyMatches): Prisma.JobWhereInput[] {
  return terms.map((term) => {
    const or: Prisma.JobWhereInput[] = term.variants.flatMap((v) => [
      { title: ci(v) },
      { location: ci(v) },
      { department: ci(v) },
      { description: ci(v) },
    ]);
    const tags = techTagsFor(term);
    if (tags.length) or.push({ techStack: { hasSome: tags } });
    if (companies) {
      const ids = companies[term.raw] ?? [];
      if (ids.length) or.push({ companyId: { in: ids } });
    } else {
      or.push(...term.variants.map((v) => ({ company: { name: ci(v) } })));
    }
    return { OR: or };
  });
}

export interface CompanyLike {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  /** Hebrew name and aliases (bilingual search). */
  nameHe?: string | null;
  aliases?: string[] | null;
}

/** Hostname without www., e.g. "https://www.monday.com/careers" → "monday.com". */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resolve which companies each term names: by name, Hebrew name/aliases or website domain, plus the
 * companies the bilingual lexicon already recognized. Pure; the caller loads companies.
 */
export function matchCompanies(terms: SearchTerm[], companies: CompanyLike[]): CompanyMatches {
  const out: CompanyMatches = {};
  for (const term of terms) {
    const ids = new Set(term.companyIds ?? []);
    for (const c of companies) {
      if (
        termMatches(term, c.name) ||
        termMatches(term, domainOf(c.website)) ||
        termMatches(term, c.nameHe) ||
        (c.aliases ?? []).some((a) => termMatches(term, a))
      )
        ids.add(c.id);
    }
    out[term.raw] = [...ids];
  }
  return out;
}

export interface RankableJob {
  title: string;
  location: string;
  department?: string | null;
  techStack: string[];
  company: { name: string };
}

/** Whole-word match (Latin word boundaries; Hebrew allows a one-letter prefix). */
function wordMatch(term: SearchTerm, text: string): boolean {
  const h = normalizeSearchText(text);
  return term.variants.some((v) => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])[והבלמש]?${esc}($|[^\\p{L}\\p{N}])`, "u").test(h);
  });
}

/**
 * Relevance score: title and company hits rank first, then skills, then location/department; a term
 * that only matched in the description still counts a little. Higher is better.
 */
export function rankJob(job: RankableJob, terms: SearchTerm[]): number {
  let score = 0;
  const tech = job.techStack.join(" ");
  for (const term of terms) {
    let s = 1; // matched somewhere (the description) — the DB already guaranteed that
    if (termMatches(term, job.title)) s = Math.max(s, wordMatch(term, job.title) ? 100 : 70);
    if (termMatches(term, job.company.name)) s = Math.max(s, wordMatch(term, job.company.name) ? 90 : 60);
    if (techTagsFor(term).some((t) => job.techStack.includes(t)) || termMatches(term, tech)) s = Math.max(s, 40);
    if (termMatches(term, job.department)) s = Math.max(s, 25);
    if (termMatches(term, job.location)) s = Math.max(s, 20);
    score += s;
  }
  // Title starting with the first term ("DevOps Engineer" for "devops") edges ahead.
  if (terms[0] && terms[0].variants.some((v) => normalizeSearchText(job.title).startsWith(v))) score += 10;
  return score;
}
