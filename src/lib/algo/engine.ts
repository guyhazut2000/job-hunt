import type { Locale } from "@/lib/i18n/dictionaries";
import { GUIDE, QUESTION_BY_ID, type GuideAnswers } from "./checklist";
import { PATTERN_BY_ID } from "./patterns";
import { PROBLEMS, PROBLEM_BY_ID } from "./problems";
import { PATTERN_IDS, tr, type PatternId, type Problem } from "./types";

/**
 * Deterministic core of the problem-solving method: score the checklist, read signals out of a
 * pasted problem, grade a pick, and turn attempts into per-pattern stats and a review queue.
 * Pure functions only (no DB, no AI) so it is fully unit-tested.
 */

export interface Candidate {
  pattern: PatternId;
  score: number;
  /** 0–100 relative to the best candidate. */
  strength: number;
  reasons: string[];
}

/** Sum the weights of every answered option; return the top patterns with the reasons behind them. */
export function scoreGuide(answers: GuideAnswers, locale: Locale, limit = 4): Candidate[] {
  const score = new Map<PatternId, number>();
  const reasons = new Map<PatternId, string[]>();
  for (const q of GUIDE) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    for (const [p, w] of Object.entries(opt.weights) as [PatternId, number][]) {
      score.set(p, (score.get(p) ?? 0) + w);
      const why = tr(opt.why, locale);
      if (w > 0 && why) reasons.set(p, [...(reasons.get(p) ?? []), why]);
    }
  }
  const ranked = [...score.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0]?.[1] ?? 1;
  return ranked.slice(0, limit).map(([pattern, s]) => ({
    pattern,
    score: s,
    strength: Math.round((s / top) * 100),
    reasons: reasons.get(pattern) ?? [],
  }));
}

/** Target complexity for a size bucket (from the checklist "size" answer). */
export const TARGET_BY_SIZE: Record<string, string> = {
  tiny: "O(n!)",
  small: "O(2^n)",
  medium: "O(n^3)",
  mid: "O(n^2)",
  large: "O(n log n) / O(n)",
  huge: "O(log n)",
};

// ── Signals in free text (paste mode, offline) ─────────────────────────────────────────────

const RULES: [RegExp, string, string][] = [
  [/linked list|->\s*next|רשימה מקושרת/i, "input", "linked"],
  [/\b(binary )?tree\b|root|\bbst\b|עץ|שורש/i, "input", "tree"],
  [
    /\bgraph\b|grid|matrix|island|edges?\b|nodes?\b|vertices|maze|board|גרף|מטריצה|רשת|לוח|מבוך|צמתים|קשתות/i,
    "input",
    "graph",
  ],
  [/interval|meeting|\[start, ?end\]|bookings?|טווח|פגיש|הזמנות/i, "input", "intervals"],
  [/dictionary|word list|list of words|wordlist|מילון|רשימת מילים/i, "input", "words"],
  [/stream|design a|implement a class|data structure that|זרם|תכנן מבנה|ממש מחלקה/i, "input", "stream"],
  [/\bsorted\b|ascending|non-decreasing|ממוין|בסדר עולה/i, "sorted", "sorted"],
  [
    /subarray|substring|contiguous|consecutive (elements|days|characters)|window|תת-?מערך|תתי-?מערכ|תת-?מחרוזת|תתי-?מחרוזו|רציף|רצופ|צמודים/i,
    "goal",
    "contiguous",
  ],
  [/two (numbers|elements|items)|pair|triplet|sum to|add up to|זוג|שלישי|מסתכמ/i, "goal", "pair"],
  [/\bk(th)?\b.*(largest|smallest|frequent|closest)|top k|k-th|median|הגדולים|הקטנים|ה-?K|חציון/i, "goal", "topk"],
  [
    /all (possible )?(combinations|permutations|subsets|arrangements|paths)|every (combination|arrangement|subset)|generate all|כל הצירופים|כל התמורות|כל הסידורים|כל תתי/i,
    "goal",
    "all",
  ],
  [/number of ways|how many ways|count the (ways|paths)|בכמה דרכים|כמה דרכים|כמה מסלולים/i, "goal", "count"],
  [
    /shortest|fewest (steps|moves)|minimum (number of )?(steps|moves|jumps)|הכי קצר|מינימום צעדים|מספר הצעדים/i,
    "goal",
    "shortest",
  ],
  [/connected|components?|provinces|groups?|cycle|קשיר|רכיב|קבוצות|מעגל/i, "goal", "connect"],
  [/prerequisite|depend|must come before|order of (tasks|courses)|דרישת קדם|דרישות קדם|תלויות/i, "goal", "order"],
  [/next (greater|warmer|larger|smaller)|parenthes|brackets|nested|הבא שגדול|סוגריים|מקונן/i, "goal", "next"],
  [/prefix|starts with|autocomplete|תחילית|מתחיל ב/i, "goal", "prefix"],
  [
    /appears (once|exactly once)|single (number|element)|xor|bits?\b|binary representation|פעם אחת|ביט/i,
    "goal",
    "single",
  ],
  [
    /minimi[sz]e|maximi[sz]e|maximum|minimum|largest|smallest|longest|מקסימ|מינימ|הכי גדול|הכי ארוך|הקצר ביותר/i,
    "goal",
    "optimize",
  ],
  [/negative|שליל/i, "negatives", "neg"],
  [/positive|non-negative|חיובי/i, "negatives", "nonneg"],
  [/weight|cost|travel time|distance|משקל|עלות|זמן העברה|מרחק/i, "weights", "weighted"],
  [
    /o\(1\) (extra )?(space|memory)|in[- ]place|constant (extra )?space|זיכרון o\(1\)|o\(1\) זיכרון|בלי זיכרון נוסף/i,
    "memory",
    "yes",
  ],
  [
    /smallest (capacity|speed|value)|minimum (capacity|speed|time|days)|at least .* such that|הקטן ביותר שמספיק|המינימלי ש/i,
    "monotone",
    "yes",
  ],
  [/seen before|duplicate|frequency|count of each|anagram|כפיל|תדירות|כמה פעמים/i, "lookup", "yes"],
];

function powerValue(s: string): number {
  const t = s.replace(/[,\s]/g, "");
  let m = t.match(/^(\d+(?:\.\d+)?)?[*·x×]?10(?:\^|\*\*)(\d+)$/);
  if (m) return (m[1] ? Number(m[1]) : 1) * 10 ** Number(m[2]);
  m = t.match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
  if (m) return Number(m[1]) * 10 ** Number(m[2]);
  return Number(t);
}

/** Largest "≤ X" bound in the text, or null. */
export function detectBound(text: string): number | null {
  const re =
    /(?:≤|<=|up to|at most|עד)\s*((?:\d[\d,]*(?:\.\d+)?\s*[*·x×]?\s*)?10\s*(?:\^|\*\*)\s*\d+|\d+(?:\.\d+)?e\d+|\d[\d,]*)/gi;
  let max: number | null = null;
  for (const m of text.matchAll(re)) {
    const v = powerValue(m[1]);
    if (Number.isFinite(v) && v > 0) max = Math.max(max ?? 0, v);
  }
  return max;
}

export function sizeBucket(n: number): string {
  if (n <= 12) return "tiny";
  if (n <= 25) return "small";
  if (n <= 500) return "medium";
  if (n <= 5000) return "mid";
  if (n <= 2_000_000) return "large";
  return "huge";
}

/** Infer checklist answers from free problem text (English or Hebrew). First rule per question wins. */
export function detectSignals(text: string): GuideAnswers {
  const out: GuideAnswers = {};
  for (const [re, q, opt] of RULES) if (!out[q] && re.test(text)) out[q] = opt;
  const bound = detectBound(text);
  if (bound) out.size = sizeBucket(bound);
  if (!out.input && /array|string|list|numbers|מערך|מחרוזת|רשימ|מספרים/i.test(text)) out.input = "array";
  if (out.input !== "graph") delete out.weights;
  return out;
}

// ── Grading a practice attempt ─────────────────────────────────────────────────────────────

export type AttemptResult = "correct" | "partial" | "miss";

export function gradePick(problem: Problem, picked: PatternId[]): AttemptResult {
  if (!picked.length) return "miss";
  const ok = new Set<PatternId>([...problem.patterns, ...(problem.alsoOk ?? [])]);
  if (picked.some((p) => ok.has(p))) return "correct";
  const fams = new Set(problem.patterns.map((p) => PATTERN_BY_ID.get(p)?.family));
  if (picked.some((p) => fams.has(PATTERN_BY_ID.get(p)?.family))) return "partial";
  return "miss";
}

export interface KeyCheck {
  question: string;
  expected: string;
  given: string | null;
  ok: boolean;
}

/** Compare the user's checklist answers with the problem's key answers (only questions with a key). */
export function checkKeys(problem: Problem, answers: GuideAnswers): KeyCheck[] {
  return Object.entries(problem.keys).map(([question, expected]) => ({
    question,
    expected: expected!,
    given: answers[question] ?? null,
    ok: answers[question] === expected,
  }));
}

export function optionLabel(question: string, option: string | null, locale: Locale): string {
  const q = QUESTION_BY_ID.get(question);
  const o = q?.options.find((x) => x.id === option);
  return o ? tr(o.label, locale) : "—";
}

// ── Stats, review and the next problem ─────────────────────────────────────────────────────

export interface AttemptLike {
  problemId: string | null;
  expected: string[];
  result: string;
  createdAt: Date;
}

export interface PatternStat {
  pattern: PatternId;
  attempts: number;
  correct: number;
  partial: number;
  /** correct = 1, partial = 0.5 */
  accuracy: number;
  lastResult: string | null;
  weak: boolean;
}

/** Per-pattern accuracy over practice attempts (each attempt counts for every expected pattern). */
export function patternStats(attempts: AttemptLike[]): PatternStat[] {
  const by = new Map<PatternId, PatternStat>();
  const sorted = [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const a of sorted) {
    if (!["correct", "partial", "miss"].includes(a.result)) continue;
    for (const raw of a.expected) {
      if (!PATTERN_BY_ID.has(raw as PatternId)) continue;
      const p = raw as PatternId;
      const s = by.get(p) ?? {
        pattern: p,
        attempts: 0,
        correct: 0,
        partial: 0,
        accuracy: 0,
        lastResult: null,
        weak: false,
      };
      s.attempts++;
      if (a.result === "correct") s.correct++;
      if (a.result === "partial") s.partial++;
      s.lastResult = a.result;
      by.set(p, s);
    }
  }
  for (const s of by.values()) {
    s.accuracy = Math.round(((s.correct + s.partial / 2) / s.attempts) * 100);
    s.weak = (s.attempts >= 2 && s.accuracy < 60) || s.lastResult === "miss";
  }
  return [...by.values()].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

const INTERVALS = [1, 3, 7, 16, 35];
const DAY = 86_400_000;

export interface ProblemReview {
  problemId: string;
  lastResult: string;
  attempts: number;
  dueAt: Date;
}

/** When to see each attempted problem again: miss → now, partial → tomorrow, a streak of correct → 1/3/7/16/35 days. */
export function reviewSchedule(attempts: AttemptLike[]): ProblemReview[] {
  const by = new Map<string, AttemptLike[]>();
  for (const a of attempts) {
    if (!a.problemId || !PROBLEM_BY_ID.has(a.problemId)) continue;
    by.set(a.problemId, [...(by.get(a.problemId) ?? []), a]);
  }
  const out: ProblemReview[] = [];
  for (const [problemId, list] of by) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const last = list[list.length - 1];
    let streak = 0;
    for (let i = list.length - 1; i >= 0 && list[i].result === "correct"; i--) streak++;
    const days =
      last.result === "miss" ? 0 : last.result === "partial" ? 1 : INTERVALS[Math.min(streak, INTERVALS.length) - 1];
    out.push({
      problemId,
      lastResult: last.result,
      attempts: list.length,
      dueAt: new Date(last.createdAt.getTime() + days * DAY),
    });
  }
  return out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export interface NextPick {
  problem: Problem;
  reason: "review" | "weak" | "new-pattern" | "new" | "any";
}

/**
 * Next practice problem: a due review first, then an unseen problem in a weak pattern, then a
 * pattern never tried, then any unseen problem, then the oldest review.
 */
export function nextProblem(attempts: AttemptLike[], now = new Date(), skip?: string): NextPick {
  const reviews = reviewSchedule(attempts).filter((r) => r.problemId !== skip);
  const due = reviews.find((r) => r.dueAt <= now);
  if (due) return { problem: PROBLEM_BY_ID.get(due.problemId)!, reason: "review" };
  const seen = new Set(reviews.map((r) => r.problemId));
  if (skip) seen.add(skip);
  const unseen = PROBLEMS.filter((p) => !seen.has(p.id));
  const stats = patternStats(attempts);
  for (const s of stats.filter((x) => x.weak)) {
    const p = unseen.find((u) => u.patterns.includes(s.pattern));
    if (p) return { problem: p, reason: "weak" };
  }
  const tried = new Set(stats.map((s) => s.pattern));
  const fresh = unseen.find((u) => u.patterns.every((p) => !tried.has(p)));
  if (fresh) return { problem: fresh, reason: tried.size ? "new-pattern" : "new" };
  if (unseen[0]) return { problem: unseen[0], reason: "new" };
  const oldest = reviews[0];
  return { problem: PROBLEM_BY_ID.get(oldest?.problemId ?? "") ?? PROBLEMS[0], reason: "any" };
}

/** Pattern ids from untrusted input (unknown ids dropped, de-duplicated, at most 3). */
export function cleanPicks(raw: unknown): PatternId[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<PatternId>();
  for (const x of raw)
    if (typeof x === "string" && (PATTERN_IDS as readonly string[]).includes(x)) ids.add(x as PatternId);
  return [...ids].slice(0, 3);
}
