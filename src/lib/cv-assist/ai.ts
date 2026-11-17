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
import {
  acceptAssist,
  hasPlaceholder,
  norm,
  placeholderXyz,
  ruleHeadline,
  type EntrySection,
  type Suggestion,
} from "./core";

export type AssistStatus = "ok" | "off" | "limited" | "error";
export interface AssistResult {
  status: AssistStatus;
  /** "ai": validated model rewrites; "rules": placeholder fallback; "import": copied from the CVs. */
  source: "ai" | "rules" | "import";
  suggestions: Suggestion[];
  /** Model rewrites dropped by the no-invention check. */
  rejected: number;
  /** Model answers identical to the original (nothing to improve) — not the same as "dropped". */
  same?: number;
  /** Nothing to work on yet (e.g. a role with no bullets). */
  empty?: boolean;
  /** How the uploaded CVs were read (import only). */
  readBy?: "stored" | "ai" | "rules" | "none";
  /** Work-journal entries used (journal suggestions only); 0 = none for these roles. */
  journalEntries?: number;
  /** Target-job keywords the user doesn't have anywhere in the CV (shown, never written in). */
  missing?: string[];
  /** Target-job keywords the rewrite may surface (already in the user's CV). */
  have?: string[];
}

export type Mode = "improve" | "tailor";

const LANG = (l: "he" | "en") => (l === "en" ? "English" : "Hebrew");
export type Gender = "m" | "f" | null;

/** Masculine / feminine from the user's own Hebrew role words ("מתכנת" vs "מתכנתת"); null when unclear. */
export function hebrewGender(texts: string[]): Gender {
  const t = texts.join(" ");
  const end = "(?![\\u0590-\\u05ff])";
  const f = new RegExp(`(מפתחת|מתכנתת|מהנדסת|מנהלת|בוגרת|אחראית|מובילה|ראשת צוות|ארכיטקטית)${end}`, "g");
  const m = new RegExp(`(מפתח|מתכנת|מהנדס|מנהל|בוגר|אחראי|מוביל|ראש צוות|ארכיטקט)${end}`, "g");
  const nf = (t.match(f) ?? []).length;
  const nm = (t.match(m) ?? []).length;
  return nm > nf ? "m" : nf > nm ? "f" : null;
}

const STYLE = (l: "he" | "en", g: Gender = null) =>
  l === "he"
    ? "Write natural Israeli high-tech CV Hebrew: past-tense first-person verbs without a pronoun (פיתחתי, הובלתי, קיצרתי, בניתי); " +
      "technology and product names stay in English (React, Node.js, Azure). NEVER use slash forms like מפתח/ת, בעל/ת, מכוון/ת. " +
      (g === "m"
        ? "The user writes in the masculine form — use masculine (מפתח, בעל ניסיון). "
        : g === "f"
          ? "The user writes in the feminine form — use feminine (מפתחת, בעלת ניסיון). "
          : "Prefer gender-neutral phrasing (verbs like פיתחתי are neutral; avoid gendered adjectives). ")
    : "Use concise, confident professional CV English (no buzzword stacking). ";

const RULES =
  "HARD RULES: use ONLY facts already in the given text and the user's CV. Never add an employer, product, date, degree, " +
  "technology, team size, duration, number or percentage that is not given. When the result has no number, write the " +
  'result clause with a placeholder in square brackets — "[X%]", "[N]", "[מספר]" or "[מדד]" — for the user to fill in. ' +
  "Keywords marked as the user's may be emphasized ONLY where the text already supports them. ";

/** Few-shot examples (illustrative only — their facts must never be copied). */
const BULLET_EXAMPLES = `EXAMPLES (illustrative only; never copy their facts):
EN weak: "Responsible for the billing API"
EN good: "Rebuilt the billing API in Node.js, cutting invoice processing time by [X%]"
EN weak: "Built Python automation workflows that increased operational efficiency by ~80% (SMS/email notifications, CSV processing)"
EN good: "Automated SMS/email notifications and CSV processing with Python workflows, raising operational efficiency by ~80%"
HE weak: "אחראי על מערכת הדוחות"
HE good: "פיתחתי מחדש את מערכת הדוחות ב-React ו-Node.js, וקיצרתי את זמן הפקת דוח ב-[X%]"
HE weak: "עבדתי על אוטומציה להעברת קבצים"
HE good: "בניתי אוטומציה להעברת קבצים בין שרתים, שחסכה [N] שעות עבודה ידנית בשבוע"
`;

export const bulletsSchema = z.object({
  items: z.array(z.object({ entry: z.number().int(), bullet: z.number().int(), rewrite: z.string().max(600) })).max(80),
});
export const fieldSchema = z.object({ rewrite: z.string().max(2400) });

export interface BulletsInput {
  section: EntrySection;
  mode: Mode;
  /** Language of the CV being built; bullets in another language are translated faithfully. */
  lang: "he" | "en";
  gender?: Gender;
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
        `You are an expert Israeli tech recruiter editing CV ${i.section === "projects" ? "project" : "experience"} bullets. ` +
        `Write every rewrite in ${LANG(i.lang)}; if a bullet is written in another language, translate it faithfully. ` +
        "Rewrite each bullet in Google's X-Y-Z form: strong past-tense action verb + what was done and how (Y, with the tech named in the bullet) + the measurable result (X). " +
        "Keep every number the bullet already has. " +
        (i.mode === "tailor"
          ? `Tailor the wording to the target job${i.targetTitle ? ` (${i.targetTitle})` : ""}: lead with the parts that match the user's keywords. `
          : "Improve clarity and impact. ") +
        RULES +
        `No pronoun ("I"/"אני"), no trailing period, one sentence, at most ${LIMITS.bulletIdealMax} characters each. ` +
        STYLE(i.lang, i.gender) +
        BULLET_EXAMPLES +
        'Return JSON {"items":[{"entry":number,"bullet":number,"rewrite":string}]}: one item per bullet; every rewrite must differ from the original. Omit only bullets that are already excellent X-Y-Z.',
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
    return { status: "ok", source: "ai", suggestions: [], rejected: 0, empty: true };
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
    let same = 0;
    for (const it of parsed.data.items) {
      const e = byIndex.get(it.entry);
      const before = e?.bullets[it.bullet];
      if (!e || !before || done.has(`${it.entry}:${it.bullet}`)) continue;
      if (norm(it.rewrite) === norm(before)) {
        same++;
        continue;
      }
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
    return { status: "ok", source: "ai", suggestions: out, rejected, same };
  } catch (e) {
    return rules(e instanceof AiLimitError ? "limited" : "error");
  }
}

export interface FieldInput {
  field: "headline" | "summary";
  mode: Mode;
  lang: "he" | "en";
  gender?: Gender;
  text: string;
  have: string[];
  targetTitle?: string;
  /** Most recent role title, for the rules headline. */
  roleTitle: string;
  corpus: string;
}

const FIELD_EXAMPLES = {
  headline: `EXAMPLES (illustrative only):
EN: "Full-Stack Developer | React, Node.js & Python | Legacy modernization and automation"
HE: "מפתח Full-Stack | React, Node.js ו-Python | מודרניזציה של מערכות ואוטומציה"
`,
  summary: `EXAMPLES (illustrative only; never copy their facts):
EN: "Full-Stack developer with 3 years building web products in React and Node.js. Modernized legacy systems into cloud web apps and automated manual workflows in Python. Looking for a product company with real scale."
HE: "מפתח Full-Stack עם 3 שנות ניסיון בפיתוח מוצרי ווב ב-React ו-Node.js. הובלתי מודרניזציה של מערכות ותיקות לאפליקציות ענן, ובניתי אוטומציות ב-Python שחסכו עבודה ידנית. מחפש את האתגר הבא בחברת מוצר."
`,
};

export function fieldPrompt(i: FieldInput): LLMMessage[] {
  const shape =
    i.field === "headline"
      ? "a one-line CV headline (role title + 2-3 core strengths separated by |), at most 120 characters"
      : `a CV professional summary of 2-4 sentences, ${LIMITS.summaryMinWords}-${LIMITS.summaryIdealMaxWords} words: who the user is + core stack, 1-2 concrete achievements from the CV, what they look for`;
  return [
    {
      role: "system",
      content:
        `You are an expert Israeli tech recruiter. You write ${shape} in ${LANG(i.lang)}. ` +
        (i.mode === "tailor"
          ? `Tailor it to the target job${i.targetTitle ? ` (${i.targetTitle})` : ""}, surfacing the user's matching keywords that the CV supports. `
          : 'Make it noticeably sharper: concrete, specific, no clichés ("passionate", "team player", "proven track record"). ') +
        (i.text.trim()
          ? "Start from the current text but use the CV excerpt for concrete facts. The result MUST differ from the current text. "
          : "Base it only on the CV excerpt. ") +
        RULES +
        "Numbers (e.g. years of experience) only when the CV excerpt states them. " +
        STYLE(i.lang, i.gender) +
        FIELD_EXAMPLES[i.field] +
        'Return JSON {"rewrite": string}.',
    },
    {
      role: "user",
      content: JSON.stringify({
        current: i.text,
        userKeywords: i.have,
        cvExcerpt: i.corpus.slice(0, 6000),
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
    if (norm(parsed.data.rewrite) === norm(i.text))
      return { status: "ok", source: "ai", suggestions: [], rejected: 0, same: 1 };
    // A summary may state a number the CV states (years of experience); bullets may not borrow numbers.
    const text = acceptAssist(i.text, parsed.data.rewrite, i.corpus, {
      maxChars,
      allowEmptyOriginal: true,
      numbersFrom: i.corpus,
    });
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
