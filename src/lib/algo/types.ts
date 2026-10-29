/**
 * Problem-solving method (LeetCode-style prep): shared types. All content in src/lib/algo is
 * original; external sites are only linked (see docs/problem-solving.md).
 */
import type { Locale } from "@/lib/i18n/dictionaries";

/** A bilingual string. Technical terms stay in English in both languages. */
export interface L {
  he: string;
  en: string;
}

export const tr = (l: L, locale: Locale) => l[locale] ?? l.en;

export const PATTERN_IDS = [
  "two-pointers",
  "sliding-window",
  "prefix-sums",
  "hashing",
  "binary-search",
  "monotonic-stack",
  "heap",
  "intervals",
  "fast-slow",
  "tree-traversal",
  "graph-traversal",
  "topo-sort",
  "union-find",
  "dijkstra",
  "backtracking",
  "dp-1d",
  "dp-2d",
  "knapsack",
  "greedy",
  "bit-manipulation",
  "trie",
] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

/** Related patterns share a family; picking a sibling of the expected pattern earns partial credit. */
export const FAMILIES = [
  "array",
  "search",
  "stack-heap",
  "linked",
  "tree",
  "graph",
  "recursion",
  "dp",
  "other",
] as const;
export type Family = (typeof FAMILIES)[number];

export interface Pattern {
  id: PatternId;
  /** English name (a technical term, same in both locales). */
  name: string;
  family: Family;
  summary: L;
  /** Phrases / properties in the problem text that should make you think of this pattern. */
  signals: L[];
  /** Language-neutral pseudocode. */
  template: string;
  time: string;
  space: string;
  pitfalls: L[];
  /** Sub-variants worth knowing (e.g. binary search on the answer). */
  variants: L[];
  /** Data structure ids (see data-structures.ts) the pattern relies on. */
  uses: string[];
  related: PatternId[];
}

export interface DataStructure {
  id: string;
  name: string;
  summary: L;
  ops: { op: string; cost: string; note?: L }[];
  whenToUse: L[];
  pitfalls: L[];
}

export type Difficulty = "easy" | "medium" | "hard";

export interface Problem {
  id: string;
  /** Our own short title (English). */
  title: string;
  difficulty: Difficulty;
  statement: L;
  /** Input size hint, shown with the statement (e.g. "1 ≤ n ≤ 10^5"). */
  constraints: string;
  /** Expected pattern(s): any one of them counts as correct. */
  patterns: PatternId[];
  /** Also valid but not the canonical approach (counts as correct, with a note). */
  alsoOk?: PatternId[];
  /** Why the expected pattern fits: the reasoning we compare against. */
  why: L;
  /** Checklist answers a careful reader should give (question id → option id). */
  keys: Partial<Record<string, string>>;
  /** Optional outbound link to the matching LeetCode problem (slug only; nothing copied). */
  leetcode?: string;
}
