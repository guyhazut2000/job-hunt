import { z } from "zod";
import { normalizeSearchText, type SearchTerm, termMatches } from "../search/query";
import { techTagsFor } from "../jobs/search";
import { INDUSTRIES, type CompanyType, type Industry } from "./criteria";

/**
 * Personal ranking (#84): the user's own keywords + ranking preferences, combined with the profile
 * match score, recency and "likely to answer" signals into one 0..100 score with reasons.
 * Pure — the jobs page loads the data (text-search hits, past responses) and calls `personalScore`.
 * Everything here is a transparent heuristic, not a prediction.
 */

/**
 * Every criterion of the one personal-ranking engine (#84 + job-seeker criteria #106).
 * Each can be switched off and has an importance 1..3. A criterion with no data for a job
 * (null) is skipped, never counted as 0.
 */
export const WEIGHT_KEYS = [
  "match",
  "keywords",
  "salary",
  "seniority",
  "tech",
  "domain",
  "location",
  "workMode",
  "employment",
  "companySize",
  "recency",
  "referral",
  "response",
] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;
/** 1 = a little, 3 = a lot (0 is a legacy "ignore" and is stored as switched off). */
export const MAX_WEIGHT = 3;
export const DEFAULT_WEIGHTS: Weights = {
  match: 2,
  keywords: 2,
  salary: 2,
  seniority: 2,
  tech: 3,
  domain: 1,
  location: 2,
  workMode: 2,
  employment: 1,
  companySize: 1,
  recency: 1,
  referral: 1,
  response: 1,
};
/** Seeker criteria that used to live inside the profile match score; when on, match drops that part. */
export const MATCH_SPLIT = ["tech", "seniority", "location", "workMode"] as const satisfies readonly WeightKey[];
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"] as const;
export const COMPANY_TYPES = ["startup", "mid", "enterprise"] as const;
export const MAX_SALARY = 200_000;

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
  weights: z.partialRecord(z.enum(WEIGHT_KEYS), weight).default({}),
  defaultSort: z.boolean().default(false),
  /** Switched-off criteria (default: everything on). */
  off: z.array(z.enum(WEIGHT_KEYS)).max(WEIGHT_KEYS.length).default([]),
  /** Monthly gross ILS; null = use the profile's minimum salary. */
  salaryMin: z.number().int().min(0).max(MAX_SALARY).nullable().default(null),
  industries: z.array(z.enum(INDUSTRIES)).max(INDUSTRIES.length).default([]),
  /** Empty = derived default (everything but internships). */
  employment: z.array(z.enum(EMPLOYMENT_TYPES)).max(EMPLOYMENT_TYPES.length).default([]),
  /** Empty = use the profile's company types. */
  companyTypes: z.array(z.enum(COMPANY_TYPES)).max(COMPANY_TYPES.length).default([]),
});
export type PrefsInput = z.input<typeof prefsSchema>;

export interface RankingPrefs {
  include: IncludeKeyword[];
  exclude: string[];
  weights: Weights;
  defaultSort: boolean;
  off: WeightKey[];
  salaryMin: number | null;
  industries: Industry[];
  employment: (typeof EMPLOYMENT_TYPES)[number][];
  companyTypes: CompanyType[];
}

export const EMPTY_PREFS: RankingPrefs = {
  include: [],
  exclude: [],
  weights: DEFAULT_WEIGHTS,
  defaultSort: false,
  off: [],
  salaryMin: null,
  industries: [],
  employment: [],
  companyTypes: [],
};

/** The criteria part of the prefs, stored in RankingPrefs.criteria (Json). */
export const criteriaJson = (p: RankingPrefs) => ({
  off: p.off,
  salaryMin: p.salaryMin,
  industries: p.industries,
  employment: p.employment,
  companyTypes: p.companyTypes,
});

export const isOn = (p: Pick<RankingPrefs, "off" | "weights">, k: WeightKey) => !p.off.includes(k) && p.weights[k] > 0;

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
  // A DB row keeps the criteria in their own Json column; flatten it.
  let input = raw ?? {};
  if (input && typeof input === "object" && "criteria" in input) {
    const { criteria, ...rest } = input as { criteria: unknown };
    input = { ...(criteria && typeof criteria === "object" ? criteria : {}), ...rest };
  }
  const p = prefsSchema.safeParse(input);
  if (!p.success) return EMPTY_PREFS;
  // Legacy weight 0 ("ignore") = switched off, at its default importance.
  const off = new Set<WeightKey>(p.data.off);
  const weights: Weights = { ...DEFAULT_WEIGHTS };
  for (const k of WEIGHT_KEYS) {
    const w = p.data.weights[k];
    if (w === undefined) continue;
    if (w === 0) off.add(k);
    else weights[k] = w;
  }
  const k = (s: string) => normalizeSearchText(s);
  const include = dedupe(p.data.include, (x) => k(x.term));
  const inc = new Set(include.map((x) => k(x.term)));
  return {
    include,
    // A word can't be both wanted and excluded; the include wins.
    exclude: dedupe(p.data.exclude, k).filter((x) => !inc.has(k(x))),
    weights,
    defaultSort: p.data.defaultSort,
    off: WEIGHT_KEYS.filter((k) => off.has(k)),
    salaryMin: p.data.salaryMin || null,
    industries: [...new Set(p.data.industries)],
    employment: [...new Set(p.data.employment)],
    companyTypes: [...new Set(p.data.companyTypes)],
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
  | { key: "responded"; points: number };

/** One line of the "why" breakdown: every criterion, including off ones and ones with no data. */
export interface CriterionRow {
  key: WeightKey;
  on: boolean;
  weight: number;
  /** 0..100, null = no data / no preference (skipped, never penalized). */
  value: number | null;
  /** Points this criterion adds to the final score (0 when off or no data). */
  points: number;
}

export interface PersonalResult {
  score: number;
  /** Each component 0..100 before weighting. */
  parts: Record<WeightKey, number | null>;
  criteria: CriterionRow[];
  /** True when a must-have keyword is missing or an exclude keyword hit; such jobs are filtered out. */
  hidden: boolean;
  excludedTerm?: string;
  reasons: PersonalReason[];
}

export interface PersonalInput {
  job: RankJob;
  /** Profile match 0..100, or null when the user has no scorable profile. */
  match: number | null;
  /** Seeker criteria values (salary, seniority, …), 0..100 or null = no data. Missing keys = no data. */
  values?: Partial<Record<WeightKey, number | null>>;
  include: CompiledKeyword[];
  exclude: CompiledKeyword[];
  /** `include[i]` matched somewhere in the DB text (title/description/tech/company). */
  inText: (i: number) => boolean;
  /** The company answered one of the user's past applications (email or a later tracker stage). */
  companyResponded: boolean;
  weights: Weights;
  /** Switched-off criteria. */
  off?: readonly WeightKey[];
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

  // "Likely to answer": only a known signal counts (the company answered you before); no signal = no data.
  // (Freshness and skill gaps are their own criteria, so they aren't counted twice here.)
  const response = input.companyResponded ? 100 : null;

  const parts = Object.fromEntries(WEIGHT_KEYS.map((k) => [k, input.values?.[k] ?? null])) as Record<
    WeightKey,
    number | null
  >;
  Object.assign(parts, { match: input.match, keywords, recency, response });
  const off = new Set(input.off ?? []);
  const on = (k: WeightKey) => !off.has(k) && weights[k] > 0;
  let sum = 0;
  let wsum = 0;
  for (const k of WEIGHT_KEYS) {
    const v = parts[k];
    if (v === null || !on(k)) continue;
    sum += v * weights[k];
    wsum += weights[k];
  }
  const score = wsum ? Math.round(sum / wsum) : 0;
  const pts = (k: WeightKey) => {
    const v = parts[k];
    return wsum && v !== null && on(k) ? Math.round((v * weights[k]) / wsum) : 0;
  };
  const criteria: CriterionRow[] = WEIGHT_KEYS.map((k) => ({
    key: k,
    on: on(k),
    weight: weights[k],
    value: parts[k],
    points: pts(k),
  }));

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

  if (input.match !== null && on("match")) reasons.push({ key: "match", score: input.match, points: pts("match") });
  if (on("recency") && days <= 14) reasons.push({ key: "fresh", days, points: pts("recency") });
  if (on("response") && input.companyResponded) reasons.push({ key: "responded", points: pts("response") });
  const order = (r: PersonalReason) => (r.key === "mustMissing" ? 1000 : "points" in r ? r.points : 0);
  reasons.sort((a, b) => order(b) - order(a));
  return { score, parts, criteria, hidden, excludedTerm: ex?.term, reasons };
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

/**
 * The profile match without the parts that are now their own criteria (tech, seniority, location,
 * work mode) — so nothing is counted twice. With all four off it is the full match score.
 * Returns null when nothing is left to judge (no target roles and every part split out).
 */
export function matchCore(
  m: { score: number; parts: { skills: number; role: number; seniority: number; location: number; bonus: number } },
  hasRoles: boolean,
  on: (k: WeightKey) => boolean,
): number | null {
  const split = MATCH_SPLIT.filter(on);
  if (!split.length) return m.score;
  let got = hasRoles ? m.parts.role : 0;
  let max = hasRoles ? 15 : 0;
  if (!on("tech")) {
    got += m.parts.skills + m.parts.bonus;
    max += 50;
  }
  if (!on("seniority")) {
    got += m.parts.seniority;
    max += 20;
  }
  if (!on("location") && !on("workMode")) {
    got += m.parts.location;
    max += 15;
  }
  return max ? Math.max(0, Math.min(100, Math.round((got / max) * 100))) : null;
}
