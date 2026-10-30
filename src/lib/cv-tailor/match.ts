import { spanYears } from "@/lib/profile/schema";
import { extractTech } from "@/lib/taxonomy";
import { cvCorpus } from "./base";
import type { CvDoc, CvLanguage, MatchSummary, Requirement, TailorTarget } from "./types";

const HEBREW = /[\u0590-\u05FF]/g;
const LATIN = /[A-Za-z]/g;

/** Language of a job posting: Hebrew when Hebrew letters are a real share of the text. */
export function detectLanguage(text: string): CvLanguage {
  const he = text.match(HEBREW)?.length ?? 0;
  const en = text.match(LATIN)?.length ?? 0;
  if (he + en === 0) return "he";
  return he / (he + en) >= 0.3 ? "he" : "en";
}

/** Years of experience the posting asks for (the smallest number mentioned), or null. */
export function requiredYears(text: string): number | null {
  const re = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?|שנות|שנים|שנ['׳]?)/gi;
  const nums: number[] = [];
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 20) nums.push(n);
  }
  return nums.length ? Math.min(...nums) : null;
}

const DEGREE_RE = /\b(b\.?sc|b\.?a\b|bachelor|m\.?sc|master'?s|degree|ph\.?d)|תואר/i;
const ENGLISH_RE = /\b(fluent|excellent|good|strong)?\s*english\b|אנגלית/i;
const HEBREW_REQ_RE = /\bhebrew\b|עברית ברמ/i;

/** Years covered by the CV's roles (earliest start → latest end, open end = now). */
export function cvYears(cv: CvDoc, now = new Date()): number {
  const starts = cv.experience
    .map((e) => e.start)
    .filter(Boolean)
    .sort();
  if (!starts.length) return 0;
  const open = cv.experience.some((e) => e.start && !e.end);
  const ends = cv.experience
    .map((e) => e.end)
    .filter(Boolean)
    .sort();
  return spanYears(starts[0], open ? "" : ends[ends.length - 1], now);
}

function findEvidence(cv: CvDoc, term: string): string | undefined {
  const t = term.toLowerCase();
  if (cv.skills.some((s) => s.toLowerCase() === t)) return "skills";
  const role = cv.experience.find((e) => [e.title, ...e.bullets].some((b) => extractTech(b).includes(term)));
  if (role) return `${role.title} · ${role.company}`;
  if (extractTech(cv.summary + " " + cv.headline).includes(term)) return "summary";
  return undefined;
}

/**
 * Covered vs missing requirements of a job, checked against the base CV (+ raw resume text).
 * Deterministic: tech keywords (taxonomy), years, degree, languages.
 */
export function matchSummary(
  cv: CvDoc,
  target: TailorTarget,
  opts: { resumeText?: string | null; hasDegree: boolean; now?: Date },
): MatchSummary {
  const text = `${target.title}\n${target.description}`;
  const reqs: Requirement[] = [];
  const corpusTech = new Set(extractTech(cvCorpus(cv, opts.resumeText ?? "")));
  const skillSet = new Set(cv.skills.map((s) => s.toLowerCase()));
  const tech = [...new Set([...target.techStack, ...extractTech(text)])].sort();
  for (const term of tech) {
    const covered = corpusTech.has(term) || skillSet.has(term.toLowerCase());
    reqs.push({ kind: "tech", label: term, covered, evidence: covered ? findEvidence(cv, term) : undefined });
  }
  const years = requiredYears(target.description);
  if (years != null) {
    const have = cvYears(cv, opts.now);
    reqs.push({
      kind: "years",
      label: `${years}+`,
      covered: have >= years - 0.25,
      evidence: have ? `${Math.floor(have)}` : undefined,
    });
  }
  if (DEGREE_RE.test(target.description)) {
    reqs.push({ kind: "degree", label: "degree", covered: opts.hasDegree });
  }
  const langs = cv.languages.join(" ").toLowerCase();
  if (ENGLISH_RE.test(target.description)) {
    reqs.push({ kind: "language", label: "English", covered: /english|אנגלית/.test(langs) });
  }
  if (HEBREW_REQ_RE.test(target.description)) {
    reqs.push({ kind: "language", label: "Hebrew", covered: /hebrew|עברית/.test(langs) });
  }
  const covered = reqs.filter((r) => r.covered);
  const missing = reqs.filter((r) => !r.covered);
  return {
    covered,
    missing,
    score: reqs.length ? Math.round((covered.length / reqs.length) * 100) : 100,
  };
}

/** Lower-cased job keywords used to rank skills and bullets. */
export function jobKeywords(target: TailorTarget): string[] {
  return [...new Set([...target.techStack, ...extractTech(`${target.title}\n${target.description}`)])].map((s) =>
    s.toLowerCase(),
  );
}
