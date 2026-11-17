/**
 * AI half of the CV builder assist (docs/cv-ai-assist.md): X-Y-Z bullet rewrites and
 * "improve wording" / "tailor to target job" for the headline and summary. One model call per
 * click, through the guarded provider (daily limits + prompt cache). Every answer goes through
 * `acceptAssist`; when the AI is off or over its limit we fall back to rules that only add
 * explicit "[X%]" placeholders, never a guessed number.
 */
import { z } from "zod";
import type { LLMMessage, LLMProvider } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { LIMITS, wordCount } from "@/lib/cv-standard/rules";
import { hasMetric } from "@/lib/cv-standard/verbs";
import { acceptAssist, hasPlaceholder, placeholderXyz, ruleHeadline, type EntrySection, type Suggestion } from "./core";

export type AssistStatus = "ok" | "off" | "limited" | "error";
export interface AssistResult {
  status: AssistStatus;
  /** "ai": validated model rewrites; "rules": placeholder fallback; "import": copied from the CVs. */
  source: "ai" | "rules" | "import";
  suggestions: Suggestion[];
  /** Model rewrites dropped by the no-invention check. */
  rejected: number;
  /** Target-job keywords the user doesn't have anywhere in the CV (shown, never written in). */
  missing?: string[];
  /** Target-job keywords the rewrite may surface (already in the user's CV). */
  have?: string[];
}

export type Mode = "improve" | "tailor";

const LANG = (l: "he" | "en") => (l === "en" ? "English" : "Hebrew");
const STYLE = (l: "he" | "en") =>
  l === "he"
    ? "Write natural Israeli-CV Hebrew (past-tense verbs like הובלתי, פיתחתי, קיצרתי); keep technology names in English. "
    : "Use concise professional CV English. ";
const RULES =
  "HARD RULES: use ONLY facts already in the given text and the user's CV. Never add an employer, product, date, degree, " +
  "technology, team size, duration, number or percentage that is not given. When the result has no number, write the " +
  'result clause with a placeholder in square brackets — e.g. "[X%]", "[N]", "[מספר]" — for the user to fill in. ' +
  "Keywords marked as the user's may be emphasized ONLY where the text already supports them. ";

export const bulletsSchema = z.object({
  items: z.array(z.object({ entry: z.number().int(), bullet: z.number().int(), rewrite: z.string().max(600) })).max(80),
});
export const fieldSchema = z.object({ rewrite: z.string().max(2400) });

export interface BulletsInput {
  section: EntrySection;
  mode: Mode;
  lang: "he" | "en";
  entries: { index: number; title: string; org: string; bullets: string[] }[];
  /** Target-job keywords the user already has. */
  have: string[];
  targetTitle?: string;
  corpus: string;
}

const MAX_ENTRIES = 8;
const MAX_BULLETS = 6;

export function bulletsPrompt(i: BulletsInput): LLMMessage[] {
  return [
    {
      role: "system",
      content:
        `You edit CV ${i.section === "projects" ? "project" : "experience"} bullets in ${LANG(i.lang)}. ` +
        "Rewrite each bullet in Google's X-Y-Z form: strong past-tense action verb + what was done (Y, how) + the measurable result (X). " +
        (i.mode === "tailor"
          ? `Tailor the wording to the target job${i.targetTitle ? ` (${i.targetTitle})` : ""}: lead with the parts that match its keywords. `
          : "Improve clarity and impact only. ") +
        RULES +
        `No first person ("I"/"אני"), no trailing period, at most ${LIMITS.bulletIdealMax} characters each. ` +
        STYLE(i.lang) +
        'Return JSON {"items":[{"entry":number,"bullet":number,"rewrite":string}]} with one item per bullet you can improve; skip bullets that are already strong.',
    },
    {
      role: "user",
      content: JSON.stringify({
        userKeywords: i.have,
        entries: i.entries.map((e) => ({ entry: e.index, title: e.title, org: e.org, bullets: e.bullets })),
      }),
    },
  ];
}

function clip(i: BulletsInput): BulletsInput {
  return {
    ...i,
    entries: i.entries
      .slice(0, MAX_ENTRIES)
      .map((e) => ({ ...e, bullets: e.bullets.slice(0, MAX_BULLETS).map((b) => b.trim()) })),
  };
}

const label = (e: { title: string; org: string }) => [e.title, e.org].filter(Boolean).join(" · ");

function ruleBullets(i: BulletsInput, origin: Mode): Suggestion[] {
  const out: Suggestion[] = [];
  for (const e of i.entries)
    e.bullets.forEach((b, bi) => {
      const text = placeholderXyz(b, i.lang);
      if (text)
        out.push({
          id: `r-${i.section}-${e.index}-${bi}`,
          kind: "bullet",
          origin,
          section: i.section,
          index: e.index,
          replace: bi,
          before: b,
          text,
          label: label(e),
        });
    });
  return out;
}

export async function rewriteBullets(llm: LLMProvider, raw: BulletsInput): Promise<AssistResult> {
  const i = clip(raw);
  if (!i.entries.some((e) => e.bullets.some(Boolean)))
    return { status: "ok", source: "ai", suggestions: [], rejected: 0 };
  const rules = (status: AssistStatus): AssistResult => ({
    status,
    source: "rules",
    suggestions: ruleBullets(i, i.mode),
    rejected: 0,
  });
  if (llm.name === "mock") return rules("off");
  try {
    const raw = await llm.complete(bulletsPrompt(i), { schema: bulletsSchema, maxTokens: 2400 });
    const parsed = bulletsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return rules("error");
    const byIndex = new Map(i.entries.map((e) => [e.index, e]));
    const out: Suggestion[] = [];
    const done = new Set<string>();
    let rejected = 0;
    for (const it of parsed.data.items) {
      const e = byIndex.get(it.entry);
      const before = e?.bullets[it.bullet];
      if (!e || !before || done.has(`${it.entry}:${it.bullet}`)) continue;
      const ok = acceptAssist(before, it.rewrite, i.corpus, { maxChars: LIMITS.bulletMaxChars });
      if (!ok) {
        rejected++;
        continue;
      }
      done.add(`${it.entry}:${it.bullet}`);
      // A bullet that already has its number doesn't need a "[X%]" to fill in.
      if (hasMetric(before) && hasPlaceholder(ok)) continue;
      out.push({
        id: `a-${i.section}-${e.index}-${it.bullet}`,
        kind: "bullet",
        origin: i.mode,
        section: i.section,
        index: e.index,
        replace: it.bullet,
        before,
        text: ok,
        label: label(e),
      });
    }
    return { status: "ok", source: "ai", suggestions: out, rejected };
  } catch (e) {
    return rules(e instanceof AiLimitError ? "limited" : "error");
  }
}

export interface FieldInput {
  field: "headline" | "summary";
  mode: Mode;
  lang: "he" | "en";
  text: string;
  have: string[];
  targetTitle?: string;
  /** Most recent role title, for the rules headline. */
  roleTitle: string;
  corpus: string;
}

export function fieldPrompt(i: FieldInput): LLMMessage[] {
  const shape =
    i.field === "headline"
      ? "a one-line CV headline (role title + 2-3 core strengths), at most 120 characters"
      : `a CV professional summary of 2-4 sentences, ${LIMITS.summaryMinWords}-${LIMITS.summaryIdealMaxWords} words, without first person`;
  return [
    {
      role: "system",
      content:
        `You write ${shape} in ${LANG(i.lang)}. ` +
        (i.mode === "tailor"
          ? `Tailor it to the target job${i.targetTitle ? ` (${i.targetTitle})` : ""}, surfacing the user's matching keywords that the CV supports. `
          : "Improve the wording, clarity and impact. ") +
        (i.text.trim() ? "Start from the current text. " : "Base it only on the CV excerpt. ") +
        RULES +
        "Do not state total years of experience unless the current text states it. " +
        STYLE(i.lang) +
        'Return JSON {"rewrite": string}.',
    },
    {
      role: "user",
      content: JSON.stringify({
        current: i.text,
        userKeywords: i.have,
        cvExcerpt: i.corpus.slice(0, 4000),
      }),
    },
  ];
}

export async function rewriteField(llm: LLMProvider, i: FieldInput): Promise<AssistResult> {
  const maxChars = i.field === "headline" ? 140 : 2000;
  const rules = (status: AssistStatus): AssistResult => {
    const text = i.field === "headline" && i.mode === "tailor" ? ruleHeadline(i.text, i.roleTitle, i.have) : null;
    return {
      status,
      source: "rules",
      suggestions: text
        ? [{ id: `r-${i.field}`, kind: "field", origin: i.mode, field: i.field, before: i.text, text }]
        : [],
      rejected: 0,
    };
  };
  if (llm.name === "mock") return rules("off");
  try {
    const raw = await llm.complete(fieldPrompt(i), { schema: fieldSchema, maxTokens: 900 });
    const parsed = fieldSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return rules("error");
    const text = acceptAssist(i.text, parsed.data.rewrite, i.corpus, { maxChars, allowEmptyOriginal: true });
    if (!text || (i.field === "summary" && wordCount(text) > LIMITS.summaryMaxWords))
      return { status: "ok", source: "ai", suggestions: [], rejected: 1 };
    return {
      status: "ok",
      source: "ai",
      suggestions: [
        { id: `a-${i.field}-${i.mode}`, kind: "field", origin: i.mode, field: i.field, before: i.text, text },
      ],
      rejected: 0,
    };
  } catch (e) {
    return rules(e instanceof AiLimitError ? "limited" : "error");
  }
}
