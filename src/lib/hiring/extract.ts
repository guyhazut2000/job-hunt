/**
 * Hiring-process extraction (docs/hiring-process.md).
 *
 * Input: plain text of public, company-owned pages (careers page, official blog, the job description).
 * Output: ordered stages, each with a verbatim `evidence` quote and the `sourceUrl` it came from.
 *
 * Grounding is mandatory: whatever produced a stage (Gemini or the offline heuristic), it is kept only when
 * its evidence quote is found in the fetched text of its source page — exactly, or after a tolerant match
 * (punctuation, niqqud, ellipses, a few changed words) in which case the page's own words are stored as the
 * quote. Nothing is ever invented — if fewer than MIN_STAGES stages survive (1 from a dedicated
 * process page is accepted at low confidence), the result is "none".
 */
import { z } from "zod";
import { AiLimitError } from "@/lib/ai/errors";
import type { LLMProvider } from "@/lib/ai/types";
import { detectKind, isStageKind, STAGE_KINDS, type StageKind } from "./kinds";

export interface SourcePage {
  url: string;
  title: string;
  text: string;
  /** "page" = careers/blog page; "job" = a job description. */
  origin?: "page" | "job";
}

export interface ExtractedStage {
  kind: StageKind;
  title: string;
  detailHe: string | null;
  detailEn: string | null;
  duration: string | null;
  evidence: string;
  sourceUrl: string;
}

export interface Extraction {
  status: "found" | "none";
  confidence: "high" | "medium" | "low";
  estimatedDuration: string | null;
  notesHe: string | null;
  notesEn: string | null;
  stages: ExtractedStage[];
  /** URLs that support at least one kept stage. */
  sourceUrls: string[];
  method: string;
  /** Why the result is "none" (diagnostics). */
  reason?: ExtractionFailure | null;
  /** Stages the model proposed before grounding (diagnostics). */
  proposed?: number;
  /** llm_failed because of a quota / rate limit (AiLimitError), not a transient error such as a timeout. */
  limitHit?: boolean;
}

/** Why an extraction found nothing. */
export type ExtractionFailure = "no_pages" | "llm_none" | "grounding_dropped" | "below_threshold" | "llm_failed";

export const MIN_STAGES = 2;
export const MAX_STAGES = 12;

/** Phrases that introduce a description of the hiring process. */
export const PROCESS_RE =
  /(hiring|interview(ing)?|recruit(ment|ing)?|selection|application|candidate) (process|journey|steps|stages)|how we hire|how we interview|what to expect|our process|the process|interview stages|תהליך (ה)?(גיוס|מיון|קבלה|ראיונות|המיון|הגיוס)|שלבי (ה)?(גיוס|מיון|ראיונות)/i;
/** Words a stage line normally contains. */
const STAGE_HINT =
  /interview|call|screen|chat|conversation|assignment|assessment|exercise|challenge|test|offer|meet|panel|onsite|on-site|references?|ראיון|ראיונות|שיחה|שיחת|מטלה|מטלת|מבחן|הצעה|הצעת|פגישה|ממליצים/i;
/** Boilerplate that mentions interviews but never describes the process. */
const BOILERPLATE =
  /accommodat|disabilit|scam|fraud|phishing|equal (employment )?opportunit|never ask|discriminat|privacy (notice|policy)|personal data|cookies?\b|benefits?\b|perks|e-?verify|background check policy|veteran/i;

/** Lower-case, unify quotes/dashes/whitespace — used for both evidence and source text before matching. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032`]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2022\u25cf\u25aa\u00b7*•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The parts of a page that talk about the process (keeps prompts small and the heuristic focused). */
export function processPassages(text: string, maxChars = 7_000): string {
  const out: string[] = [];
  let total = 0;
  const re = new RegExp(PROCESS_RE.source, "gi");
  let lastEnd = -1;
  for (let m; (m = re.exec(text)) && total < maxChars;) {
    const start = Math.max(0, m.index - 300, lastEnd);
    if (start >= text.length) break;
    const end = Math.min(text.length, m.index + 4_000, start + (maxChars - total));
    if (end <= start) continue;
    out.push(text.slice(start, end));
    total += end - start;
    lastEnd = end;
    re.lastIndex = Math.max(re.lastIndex, end);
  }
  return out.join("\n…\n");
}

/** Cheap signal used to decide whether a job description is worth extracting at all. */
export function hasProcessSignals(text: string): boolean {
  const passage = processPassages(text, 5_000);
  if (!passage) return false;
  return new Set(heuristicLines(passage).map((l) => l.kind)).size >= MIN_STAGES;
}

/** Number of distinct stage kinds in stage-like lines of `passage` (boilerplate excluded). */
export function stageLineCount(passage: string): number {
  return new Set(heuristicLines(passage).map((l) => l.kind)).size;
}

const DEDICATED_RE =
  /how[-_ ]?we[-_ ]?hire|hiring|interview|recruit|candidate|process|journey|what[-_ ]to[-_ ]expect|get[-_ ]?hired|faq|גיוס|מיון|ראיון|ראיונות|%d7%92%d7%99%d7%95%d7%a1/i;
/** URL/title of a page dedicated to the hiring process (not a generic careers page or job post). */
export function isDedicatedProcessSource(url: string, title: string): boolean {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep */
  }
  return DEDICATED_RE.test(`${path} ${title}`);
}

function heuristicLines(passage: string): { kind: StageKind; line: string }[] {
  const out: { kind: StageKind; line: string }[] = [];
  const lines = passage
    .split(/\n|(?<=[.!?])\s+(?=[A-Z0-9\u0590-\u05FF])/)
    .map((l) => l.replace(/^[\s\-–•*\d.)]+/, "").trim())
    .filter((l) => l.length >= 8 && l.length <= 260);
  for (const line of lines) {
    if (BOILERPLATE.test(line) || !STAGE_HINT.test(line)) continue;
    const kind = detectKind(line);
    if (kind === "other" || kind === "application") continue;
    out.push({ kind, line });
  }
  return out;
}

/** Offline extractor (mock provider / LLM failure): stage-like lines inside a process passage, verbatim. */
export function heuristicExtract(pages: SourcePage[]): ExtractedStage[] {
  const stages: ExtractedStage[] = [];
  const seen = new Set<StageKind>();
  for (const page of pages) {
    for (const { kind, line } of heuristicLines(processPassages(page.text))) {
      if (seen.has(kind)) continue;
      seen.add(kind);
      stages.push({
        kind,
        title: line.length <= 80 ? line : `${line.slice(0, 77).trimEnd()}…`,
        detailHe: null,
        detailEn: line.length > 80 ? line : null,
        duration: null,
        evidence: line,
        sourceUrl: page.url,
      });
    }
  }
  return stages;
}

const nullableStr = z.string().nullable();
export const llmSchema = z.object({
  hasProcess: z.boolean(),
  estimatedDuration: nullableStr,
  notesHe: nullableStr,
  notesEn: nullableStr,
  stages: z
    .array(
      z.object({
        kind: z.enum(STAGE_KINDS),
        title: z.string(),
        detailHe: nullableStr,
        detailEn: nullableStr,
        duration: nullableStr,
        evidence: z.string(),
        sourceUrl: z.string(),
      }),
    )
    .max(MAX_STAGES + 3),
});
export type LlmOutput = z.infer<typeof llmSchema>;

export function buildPrompt(company: string, pages: SourcePage[]) {
  const docs = pages
    .map(
      (p, i) =>
        `### SOURCE ${i + 1}\nURL: ${p.url}\nTITLE: ${p.title}\n\n${processPassages(p.text) || p.text.slice(0, 4_000)}`,
    )
    .join("\n\n");
  return [
    {
      role: "system" as const,
      content: [
        "You extract a company's hiring / interview process from its own public pages for job seekers.",
        "STRICT RULES:",
        "- Use ONLY the provided sources. Never use outside knowledge, never guess, never add typical stages.",
        "- Each stage MUST include `evidence`: an exact, verbatim, contiguous quote (10–200 characters) copied from the source text that describes that stage — in the source's original language, never translated or paraphrased — and `sourceUrl`: the URL of that source.",
        '- Sources may be careers pages, FAQ pages ("What does the interview process look like?"), blog posts by the company, or job descriptions. Hebrew sources are common.',
        "- A source that clearly describes even a single concrete step of the company's process (e.g. 'every candidate completes a home assignment') counts; return that one stage.",
        "- If the sources do not describe the company's own hiring process as a sequence of stages (e.g. they only mention accommodations, scams or generic text), return hasProcess=false and an empty stages list.",
        "- Order stages as the source describes them. `kind` must be one of the allowed values; use 'other' when nothing fits.",
        "- `title`: short stage name in the source's language. `detailHe`/`detailEn`: one short sentence summarising what the source says about the stage, in Hebrew / English.",
        "- `duration` / `estimatedDuration`: only if the source states it explicitly (copy the phrase), else null.",
        "- `notesHe`/`notesEn`: optional one-sentence tips stated in the source, else null.",
      ].join("\n"),
    },
    { role: "user" as const, content: `Company: ${company}\n\n${docs}` },
  ];
}

/** Loose form for tolerant matching: no niqqud / bidi marks / punctuation. */
function looseToken(t: string): string {
  return t
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "");
}

interface Tok {
  t: string;
  start: number;
  end: number;
}
const TOKEN_RE = /[\p{L}\p{N}\u0591-\u05c7]+/gu;
function tokens(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = looseToken(m[0]);
    if (t) out.push({ t, start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

/** Minimum share of the quote's words that must appear, in a window of the same size, for a fuzzy match. */
export const FUZZY_MIN_RATIO = 0.85;

/**
 * Where `evidence` occurs in `text`: exact (after normalisation), each piece of an ellipsis-joined quote in
 * order, or a same-length window sharing ≥ FUZZY_MIN_RATIO of its words (first and last word included).
 * Returns the page's own wording for that span (so stored quotes are always verbatim), or null.
 */
export function locateEvidence(evidence: string, text: string): string | null {
  const ev = normalizeForMatch(evidence).replace(/^["'…. ]+|["'…. ]+$/g, "");
  if (ev.length < 10) return null;
  if (normalizeForMatch(text).includes(ev)) return evidence.trim();
  const pageToks = tokens(text);
  if (!pageToks.length) return null;
  const spanOf = (a: number, b: number) => text.slice(pageToks[a].start, pageToks[b].end).replace(/\s+/g, " ").trim();

  const findSeq = (q: string[], from: number): number => {
    outer: for (let i = from; i + q.length <= pageToks.length; i++) {
      for (let k = 0; k < q.length; k++) if (pageToks[i + k].t !== q[k]) continue outer;
      return i;
    }
    return -1;
  };
  // 1. Same words, different punctuation / marks.
  const q = tokens(evidence).map((x) => x.t);
  if (q.length >= 2) {
    const i = findSeq(q, 0);
    if (i >= 0) return spanOf(i, i + q.length - 1);
  }
  // 2. "first part … second part": every piece, in order.
  const pieces = evidence
    .split(/…|\.\.\./)
    .map((p) => tokens(p).map((x) => x.t))
    .filter((p) => p.length);
  if (pieces.length >= 2 && pieces.every((p) => p.length >= 2)) {
    let from = 0;
    let first = -1;
    let last = -1;
    for (const p of pieces) {
      const i = findSeq(p, from);
      if (i < 0) {
        first = -1;
        break;
      }
      if (first < 0) first = i;
      last = i + p.length - 1;
      from = i + p.length;
    }
    if (first >= 0 && last - first < q.length * 3) return spanOf(first, last);
  }
  // 3. A few words changed (the model fixed a typo or dropped a word).
  if (q.length < 4) return null;
  const need = new Map<string, number>();
  for (const t of q) need.set(t, (need.get(t) ?? 0) + 1);
  const n = q.length;
  for (const w of [n, n - 1, n + 1, n - 2, n + 2]) {
    if (w < 3 || w > pageToks.length) continue;
    const have = new Map<string, number>();
    let hits = 0;
    const add = (t: string, d: 1 | -1) => {
      const before = Math.min(have.get(t) ?? 0, need.get(t) ?? 0);
      have.set(t, (have.get(t) ?? 0) + d);
      hits += Math.min(have.get(t) ?? 0, need.get(t) ?? 0) - before;
    };
    for (let i = 0; i < w; i++) add(pageToks[i].t, 1);
    for (let i = 0; ; i++) {
      if (hits / n >= FUZZY_MIN_RATIO && pageToks[i].t === q[0] && pageToks[i + w - 1].t === q[n - 1])
        return spanOf(i, i + w - 1);
      if (i + w >= pageToks.length) break;
      add(pageToks[i].t, -1);
      add(pageToks[i + w].t, 1);
    }
  }
  return null;
}

/** Keep only stages whose evidence is present (exactly or tolerantly) in the fetched text of a source page. */
export function groundStages(raw: LlmOutput["stages"] | ExtractedStage[], pages: SourcePage[]): ExtractedStage[] {
  const kept: ExtractedStage[] = [];
  const ordered = (url: string) => [...pages.filter((p) => p.url === url), ...pages.filter((p) => p.url !== url)];
  for (const s of raw) {
    let page: SourcePage | null = null;
    let quote: string | null = null;
    for (const p of ordered(s.sourceUrl)) {
      quote = locateEvidence(s.evidence ?? "", p.text);
      if (quote) {
        page = p;
        break;
      }
    }
    if (!page || !quote) continue;
    // The same span backing two stages is a sign of a padded list; keep the first.
    if (kept.some((k) => normalizeForMatch(k.evidence) === normalizeForMatch(quote))) continue;
    const pageNorm = normalizeForMatch(page.text);
    const duration = s.duration && pageNorm.includes(normalizeForMatch(s.duration)) ? s.duration.trim() : null;
    let kind: StageKind = isStageKind(s.kind) ? s.kind : "other";
    if (kind === "other") kind = detectKind(`${s.title} ${s.evidence}`);
    kept.push({
      kind,
      title: (s.title || "").trim().slice(0, 120) || quote.slice(0, 80),
      detailHe: s.detailHe?.trim().slice(0, 400) || null,
      detailEn: s.detailEn?.trim().slice(0, 400) || null,
      duration,
      evidence: quote.slice(0, 400),
      sourceUrl: page.url,
    });
    if (kept.length >= MAX_STAGES) break;
  }
  return kept;
}

function hasDedicatedSource(stages: ExtractedStage[], pages: SourcePage[]): boolean {
  return pages.some(
    (p) => p.origin !== "job" && stages.some((s) => s.sourceUrl === p.url) && isDedicatedProcessSource(p.url, p.title),
  );
}

/**
 * Enough grounded stages to publish? ≥ MIN_STAGES, or a single stage from a page dedicated to the hiring
 * process (published at low confidence — a well-sourced partial answer beats "no info").
 */
export function meetsThreshold(stages: ExtractedStage[], pages: SourcePage[]): boolean {
  return stages.length >= MIN_STAGES || (stages.length === 1 && hasDedicatedSource(stages, pages));
}

function confidenceFor(stages: ExtractedStage[], pages: SourcePage[]): Extraction["confidence"] {
  if (stages.length < MIN_STAGES) return "low";
  const dedicated = hasDedicatedSource(stages, pages);
  const onlyJobs = stages.every((s) => pages.find((p) => p.url === s.sourceUrl)?.origin === "job");
  if (onlyJobs) return stages.length >= 3 ? "medium" : "low";
  if (stages.length >= 3 && dedicated) return "high";
  if (stages.length >= 3 || dedicated) return "medium";
  return "low";
}

const NONE = (method: string, reason: ExtractionFailure | null = null, proposed = 0): Extraction => ({
  status: "none",
  confidence: "low",
  estimatedDuration: null,
  notesHe: null,
  notesEn: null,
  stages: [],
  sourceUrls: [],
  method,
  reason,
  proposed,
});

/**
 * Extract a grounded process from `pages`. `llm` = null (or a mock provider) → heuristic only.
 * LLM errors (including AiLimitError) return method "llm_failed" (callers store nothing and retry later),
 * so a quota hit never fabricates stages or downgrades a company to "no info".
 */
export async function extractHiringProcess(
  company: string,
  pages: SourcePage[],
  llm: LLMProvider | null,
): Promise<Extraction> {
  const usable = pages.filter((p) => p.text.trim().length > 0);
  if (usable.length === 0) return NONE(llm && llm.name !== "mock" ? llm.name : "heuristic", "no_pages");
  let method = "heuristic";
  let stages: ExtractedStage[] = [];
  let proposed = 0;
  let saidNone = false;
  let extra: Pick<Extraction, "estimatedDuration" | "notesHe" | "notesEn"> = {
    estimatedDuration: null,
    notesHe: null,
    notesEn: null,
  };
  if (llm && llm.name !== "mock") {
    try {
      const out = llmSchema.parse(
        JSON.parse(await llm.complete(buildPrompt(company, usable), { schema: llmSchema, maxTokens: 2_000 })),
      );
      method = llm.name;
      proposed = out.hasProcess ? out.stages.length : 0;
      saidNone = !out.hasProcess || out.stages.length === 0;
      if (out.hasProcess) {
        stages = groundStages(out.stages, usable);
        const allText = normalizeForMatch(usable.map((p) => p.text).join("\n"));
        extra = {
          estimatedDuration:
            out.estimatedDuration && allText.includes(normalizeForMatch(out.estimatedDuration))
              ? out.estimatedDuration.trim().slice(0, 80)
              : null,
          notesHe: out.notesHe?.trim().slice(0, 400) || null,
          notesEn: out.notesEn?.trim().slice(0, 400) || null,
        };
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[hiring] llm extraction failed:", e instanceof Error ? e.message.slice(0, 200) : "error");
      }
      // Callers treat this as "not checked yet" (no row is stored) so a quota hit never downgrades a company.
      return { ...NONE("llm_failed", "llm_failed"), limitHit: e instanceof AiLimitError };
    }
  } else {
    const h = heuristicExtract(usable);
    proposed = h.length;
    saidNone = h.length === 0;
    stages = groundStages(h, usable);
  }
  if (!meetsThreshold(stages, usable)) {
    const reason: ExtractionFailure = saidNone
      ? "llm_none"
      : stages.length === 0
        ? "grounding_dropped"
        : "below_threshold";
    return NONE(method, reason, proposed);
  }
  return {
    status: "found",
    // The offline heuristic copies lines verbatim but cannot judge context — never more than "low".
    confidence: method === "heuristic" ? "low" : confidenceFor(stages, usable),
    ...extra,
    stages,
    sourceUrls: [...new Set(stages.map((s) => s.sourceUrl))],
    method,
    reason: null,
    proposed,
  };
}

/**
 * The process-describing part of a job description as an extraction source, or null when the posting
 * only has boilerplate (accommodations, "AI in recruitment", an empty "Interview process" heading…).
 */
export function jobProcessSource(job: { url: string; title: string; text: string }): SourcePage | null {
  if (!hasProcessSignals(job.text)) return null;
  return { url: job.url, title: job.title, text: job.text, origin: "job" };
}
