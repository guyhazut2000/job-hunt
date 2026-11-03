import { z } from "zod";
import { normalizeSearchText, type SearchTerm, termMatches } from "../search/query";
import { techTagsFor } from "../jobs/search";

/**
 * Personal ranking (#84): the user's own keywords + ranking preferences, combined with the profile
 * match score, recency and "likely to answer" signals into one 0..100 score with reasons.
 * Pure — the jobs page loads the data (text-search hits, past responses) and calls `personalScore`.
 * Everything here is a transparent heuristic, not a prediction.
 */

export const WEIGHT_KEYS = ["match", "keywords", "recency", "response"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;
/** 0 = ignore, 3 = very important. */
export const MAX_WEIGHT = 3;
export const DEFAULT_WEIGHTS: Weights = { match: 3, keywords: 2, recency: 1, response: 1 };

export const MAX_KEYWORDS = 15;
export const MAX_KEYWORD_LENGTH = 40;

const keyword = z.string().trim().min(1).max(MAX_KEYWORD_LENGTH);
export const includeSchema = z.object({
  term: keyword,
  weight: z.number().int().min(1).max(3).default(1),
  must: z.boolean().default(false),
});
export type IncludeKeyword = z.infer<typeof includeSchema>;

const weight = z.number().int().min(0).max(MAX_WEIGHT);
export const prefsSchema = z.object({
  include: z.array(includeSchema).max(MAX_KEYWORDS).default([]),
  exclude: z.array(keyword).max(MAX_KEYWORDS).default([]),
  weights: z.object({ match: weight, keywords: weight, recency: weight, response: weight }).partial().default({}),
  defaultSort: z.boolean().default(false),
});
export type PrefsInput = z.input<typeof prefsSchema>;

export interface RankingPrefs {
  include: IncludeKeyword[];
  exclude: string[];
  weights: Weights;
  defaultSort: boolean;
}

export const EMPTY_PREFS: RankingPrefs = { include: [], exclude: [], weights: DEFAULT_WEIGHTS, defaultSort: false };

const dedupe = <T>(items: T[], key: (t: T) => string) => {
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = key(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Validate stored/untrusted prefs (bad JSON → defaults, duplicates dropped, weights filled in). */
export function normalizePrefs(raw: unknown): RankingPrefs {
  const p = prefsSchema.safeParse(raw ?? {});
  if (!p.success) return EMPTY_PREFS;
  const k = (s: string) => normalizeSearchText(s);
  const include = dedupe(p.data.include, (x) => k(x.term));
  const inc = new Set(include.map((x) => k(x.term)));
  return {
    include,
    // A word can't be both wanted and excluded; the include wins.
    exclude: dedupe(p.data.exclude, k).filter((x) => !inc.has(k(x))),
    weights: { ...DEFAULT_WEIGHTS, ...p.data.weights },
    defaultSort: p.data.defaultSort,
  };
}

export const hasKeywords = (p: RankingPrefs) => p.include.length > 0 || p.exclude.length > 0;

/** Split a free-text list ("react, node\nגו") into keywords (commas, semicolons, new lines). */
export function splitKeywords(text: string): string[] {
  return dedupe(
    text
      .split(/[,;\n،]+/)
      .map((s) => s.trim().slice(0, MAX_KEYWORD_LENGTH))
      .filter(Boolean),
    (s) => normalizeSearchText(s),
  ).slice(0, MAX_KEYWORDS);
}

/** Fields of a job available in memory (no description — descriptions are matched in the DB). */
export interface RankJob {
  id: string;
  title: string;
  techStack: string[];
  department?: string | null;
  postedAt: Date;
  companyId: string;
  company: { name: string };
}

export type HitPlace = "title" | "tech" | "company" | "text";

/** Where a keyword (all of its terms) hits a job; `inText` = the DB found it anywhere incl. the description. */
export function keywordHit(terms: SearchTerm[], job: RankJob, inText: boolean): HitPlace | null {
  if (!terms.length) return null;
  const every = (f: (t: SearchTerm) => boolean) => terms.every(f);
  if (every((t) => termMatches(t, job.title))) return "title";
  if (
    every((t) => techTagsFor(t).some((tag) => job.techStack.includes(tag)) || termMatches(t, job.techStack.join(" ")))
  )
    return "tech";
  if (every((t) => termMatches(t, job.company.name))) return "company";
  return inText ? "text" : null;
}

/** Excludes look only at the title, tech tags, company and department — a passing mention in a long description shouldn't hide a job. */
export function excludedBy(terms: SearchTerm[], job: RankJob): boolean {
  if (!terms.length) return false;
  const hay = [job.title, job.techStack.join(" "), job.company.name, job.department ?? ""];
  return terms.every(
    (t) => hay.some((h) => termMatches(t, h)) || techTagsFor(t).some((g) => job.techStack.includes(g)),
  );
}

export interface CompiledKeyword {
  term: string;
  weight: number;
  must: boolean;
  terms: SearchTerm[];
}

export type PersonalReason =
  | { key: "keyword"; term: string; place: HitPlace; points: number }
  | { key: "mustMissing"; term: string }
  | { key: "match"; score: number; points: number }
  | { key: "fresh"; days: number; points: number }
  | { key: "responded"; points: number }
  | { key: "gaps"; missing: number; points: number };

export interface PersonalResult {
  score: number;
  /** Each component 0..100 before weighting. */
  parts: Record<WeightKey, number | null>;
  /** True when a must-have keyword is missing or an exclude keyword hit; such jobs are filtered out. */
  hidden: boolean;
  excludedTerm?: string;
  reasons: PersonalReason[];
}

export interface PersonalInput {
  job: RankJob;
  /** Profile match 0..100, or null when the user has no scorable profile. */
  match: number | null;
  /** Number of the job's skills missing from the profile (null without a profile). */
  missingSkills: number | null;
  include: CompiledKeyword[];
  exclude: CompiledKeyword[];
  /** `include[i]` matched somewhere in the DB text (title/description/tech/company). */
  inText: (i: number) => boolean;
  /** The company answered one of the user's past applications (email or a later tracker stage). */
  companyResponded: boolean;
  weights: Weights;
  now?: Date;
}

const DAY = 86_400_000;

/** Fresh postings get answered more: ≤3d 100, ≤7d 80, ≤14d 55, ≤30d 30, older 10. */
export function recencyPoints(postedAt: Date, now = new Date()): number {
  const days = Math.max(0, (now.getTime() - postedAt.getTime()) / DAY);
  return days <= 3 ? 100 : days <= 7 ? 80 : days <= 14 ? 55 : days <= 30 ? 30 : 10;
}

const PLACE_FACTOR: Record<HitPlace, number> = { title: 1, tech: 0.85, company: 0.85, text: 0.5 };

export function personalScore(input: PersonalInput): PersonalResult {
  const { job, include, exclude, weights } = input;
  const now = input.now ?? new Date();
  const reasons: PersonalReason[] = [];

  const ex = exclude.find((k) => excludedBy(k.terms, job));
  let hidden = !!ex;

  // Keywords: weighted share of the wanted words that hit (title > tech/company > description).
  let keywords: number | null = null;
  if (include.length) {
    let got = 0;
    let max = 0;
    include.forEach((k, i) => {
      max += k.weight;
      const place = keywordHit(k.terms, job, input.inText(i));
      if (place) {
        got += k.weight * PLACE_FACTOR[place];
        reasons.push({ key: "keyword", term: k.term, place, points: 0 });
      } else if (k.must) {
        hidden = true;
        reasons.push({ key: "mustMissing", term: k.term });
      }
    });
    keywords = max ? Math.round((got / max) * 100) : 0;
  }

  const recency = recencyPoints(job.postedAt, now);
  const days = Math.round(Math.max(0, now.getTime() - job.postedAt.getTime()) / DAY);

  // "Likely to answer": the company answered you before, a fresh posting, few requirement gaps.
  const gapPts = input.missingSkills === null ? 0 : input.missingSkills === 0 ? 25 : input.missingSkills <= 2 ? 15 : 0;
  const response = Math.min(100, (input.companyResponded ? 55 : 0) + (days <= 7 ? 20 : 0) + gapPts);

  const parts: Record<WeightKey, number | null> = { match: input.match, keywords, recency, response };
  let sum = 0;
  let wsum = 0;
  const contribution: Partial<Record<WeightKey, number>> = {};
  for (const k of WEIGHT_KEYS) {
    const v = parts[k];
    const w = weights[k];
    if (v === null || !w) continue;
    sum += v * w;
    wsum += w;
    contribution[k] = v * w;
  }
  const score = wsum ? Math.round(sum / wsum) : 0;
  const pts = (k: WeightKey) => (wsum ? Math.round((contribution[k] ?? 0) / wsum) : 0);

  // Points per keyword = its share of the keyword contribution.
  const kwTotal = pts("keywords");
  const hits = reasons.filter((r): r is Extract<PersonalReason, { key: "keyword" }> => r.key === "keyword");
  const hitWeight = hits.reduce(
    (a, r) => a + (include.find((k) => k.term === r.term)?.weight ?? 1) * PLACE_FACTOR[r.place],
    0,
  );
  for (const r of hits)
    r.points = hitWeight
      ? Math.round(
          (kwTotal * (include.find((k) => k.term === r.term)?.weight ?? 1) * PLACE_FACTOR[r.place]) / hitWeight,
        )
      : 0;

  if (input.match !== null && weights.match) reasons.push({ key: "match", score: input.match, points: pts("match") });
  if (weights.recency && days <= 14) reasons.push({ key: "fresh", days, points: pts("recency") });
  if (weights.response) {
    const share = response ? pts("response") / response : 0;
    if (input.companyResponded) reasons.push({ key: "responded", points: Math.round(55 * share) });
    if (input.missingSkills !== null && gapPts)
      reasons.push({ key: "gaps", missing: input.missingSkills, points: Math.round(gapPts * share) });
  }
  const order = (r: PersonalReason) => (r.key === "mustMissing" ? 1000 : "points" in r ? r.points : 0);
  reasons.sort((a, b) => order(b) - order(a));
  return { score, parts, hidden, excludedTerm: ex?.term, reasons };
}

/** Compile prefs into search terms with the bilingual parser (same equivalences as the search box). */
export function compilePrefs(
  prefs: RankingPrefs,
  parse: (q: string) => SearchTerm[],
): { include: CompiledKeyword[]; exclude: CompiledKeyword[] } {
  return {
    include: prefs.include.map((k) => ({ ...k, terms: parse(k.term) })).filter((k) => k.terms.length),
    exclude: prefs.exclude
      .map((term) => ({ term, weight: 1, must: false, terms: parse(term) }))
      .filter((k) => k.terms.length),
  };
}
