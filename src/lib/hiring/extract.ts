/**
 * Hiring-process extraction (docs/hiring-process.md).
 *
 * Input: plain text of public, company-owned pages (careers page, official blog, the job description).
 * Output: ordered stages, each with a verbatim `evidence` quote and the `sourceUrl` it came from.
 *
 * Grounding is mandatory: whatever produced a stage (Gemini or the offline heuristic), it is kept only when
 * its evidence quote is found in the fetched text of its source page. Nothing is ever invented — if fewer
 * than MIN_STAGES stages survive, the result is "none".
 */
import { z } from "zod";
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
}

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
        "- Each stage MUST include `evidence`: an exact, verbatim, contiguous quote (10–200 characters) copied from the source text that describes that stage, and `sourceUrl`: the URL of that source.",
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

/** Keep only stages whose evidence is literally present in the fetched text of a source page. */
export function groundStages(raw: LlmOutput["stages"] | ExtractedStage[], pages: SourcePage[]): ExtractedStage[] {
  const norm = pages.map((p) => ({ url: p.url, text: normalizeForMatch(p.text) }));
  const kept: ExtractedStage[] = [];
  for (const s of raw) {
    const ev = normalizeForMatch(s.evidence ?? "").replace(/^["'…. ]+|["'…. ]+$/g, "");
    if (ev.length < 10) continue;
    const page =
      norm.find((p) => p.url === s.sourceUrl && p.text.includes(ev)) ?? norm.find((p) => p.text.includes(ev));
    if (!page) continue;
    const duration = s.duration && page.text.includes(normalizeForMatch(s.duration)) ? s.duration.trim() : null;
    let kind: StageKind = isStageKind(s.kind) ? s.kind : "other";
    if (kind === "other") kind = detectKind(`${s.title} ${s.evidence}`);
    kept.push({
      kind,
      title: (s.title || "").trim().slice(0, 120) || s.evidence.slice(0, 80),
      detailHe: s.detailHe?.trim().slice(0, 400) || null,
      detailEn: s.detailEn?.trim().slice(0, 400) || null,
      duration,
      evidence: s.evidence.trim().slice(0, 400),
      sourceUrl: page.url,
    });
    if (kept.length >= MAX_STAGES) break;
  }
  return kept;
}

function confidenceFor(stages: ExtractedStage[], pages: SourcePage[]): Extraction["confidence"] {
  const dedicated = pages.some(
    (p) =>
      p.origin !== "job" &&
      stages.some((s) => s.sourceUrl === p.url) &&
      /hir|interview|process|recruit|candidate|גיוס|ראיון/i.test(`${p.url} ${p.title}`),
  );
  if (stages.length >= 3 && dedicated) return "high";
  if (stages.length >= 3 || dedicated) return "medium";
  return "low";
}

const NONE = (method: string): Extraction => ({
  status: "none",
  confidence: "low",
  estimatedDuration: null,
  notesHe: null,
  notesEn: null,
  stages: [],
  sourceUrls: [],
  method,
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
  if (usable.length === 0) return NONE(llm && llm.name !== "mock" ? llm.name : "heuristic");
  let method = "heuristic";
  let stages: ExtractedStage[] = [];
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
      return { ...NONE("llm_failed") };
    }
  } else {
    stages = groundStages(heuristicExtract(usable), usable);
  }
  if (stages.length < MIN_STAGES) return { ...NONE(method) };
  return {
    status: "found",
    // The offline heuristic copies lines verbatim but cannot judge context — never more than "low".
    confidence: method === "heuristic" ? "low" : confidenceFor(stages, usable),
    ...extra,
    stages,
    sourceUrls: [...new Set(stages.map((s) => s.sourceUrl))],
    method,
  };
}
