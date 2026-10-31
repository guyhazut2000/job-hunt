/**
 * Translate CV content to the export language — translation only, never new facts.
 * One guardedLLM call per export (DB-cached 30 days, counts toward the 15/day user limit).
 * Every returned string is checked against its source (numbers, URLs, emails kept; sane length);
 * a string that fails keeps its original text. Mock/limit/error → untranslated content.
 */
import { z } from "zod";
import { guardedLLM, type LLMMessage } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import type { CvLang } from "@/lib/i18n/cv-templates";
import { hasHebrew } from "./bidi";
import { contentStrings, withStrings, type CvContent } from "./content";

const LATIN_WORDS = /[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){3,}/; // ≥4 English words in a row = prose

/** Which strings need translating into `to`. Tech names, company names and short English terms
 * inside Hebrew are normal in Israeli CVs and stay as written. */
export function needsTranslation(s: string, to: CvLang): boolean {
  if (!s.trim()) return false;
  if (to === "en") return hasHebrew(s);
  return !hasHebrew(s) && LATIN_WORDS.test(s);
}

const tokens = (s: string) => ({
  nums: (s.match(/\d+(?:[.,]\d+)*/g) ?? []).sort(),
  urls: (
    s.match(
      /https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+|\b[\w-]+(?:\.[\w-]+)+\/\S*|\b[\w-]+\.(?:com|io|dev|co\.il|org|net|me|app|ai)\b/g,
    ) ?? []
  ).sort(),
});

/** Accept a translation only if it kept every number/URL/email and has a plausible length. */
export function acceptTranslation(src: string, out: unknown): string {
  if (typeof out !== "string" || !out.trim()) return src;
  const a = tokens(src);
  const b = tokens(out);
  if (a.nums.join("|") !== b.nums.join("|") || a.urls.join("|") !== b.urls.join("|")) return src;
  const r = out.length / Math.max(1, src.length);
  if (r < 0.3 || r > 3) return src;
  return out.trim();
}

const responseSchema = z.object({ items: z.array(z.string()) });

export function translatePrompt(items: string[], to: CvLang): LLMMessage[] {
  const lang = to === "en" ? "English" : "Hebrew";
  return [
    {
      role: "system",
      content:
        `You translate CV text into ${lang}. Translate ONLY — do not add, remove, embellish or summarise anything. ` +
        "Keep every number, date, percentage, URL, email, company name, product name and technology name exactly as written. " +
        (to === "he"
          ? "Use natural Israeli-CV Hebrew; keep English tech terms (React, CI, API…) in English. "
          : "Use concise professional CV English. Transliterate Hebrew names of people and places. ") +
        'Return JSON {"items": [...]} with exactly one translated string per input, in the same order.',
    },
    { role: "user", content: JSON.stringify({ items }) },
  ];
}

export interface TranslateResult {
  content: CvContent;
  /** translated = AI did it; none = nothing needed; off = AI not configured; limited/error = left as is. */
  status: "translated" | "none" | "off" | "limited" | "error";
  reason?: AiLimitReason;
  /** How many strings were sent / kept untranslated by the fact check. */
  sent: number;
  kept: number;
}

export async function translateContent(c: CvContent, to: CvLang, userId: string): Promise<TranslateResult> {
  const all = contentStrings(c);
  const idx = all.map((s, i) => (needsTranslation(s, to) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return { content: c, status: "none", sent: 0, kept: 0 };
  const llm = await guardedLLM("cv_translate", userId);
  if (llm.name === "mock") return { content: c, status: "off", sent: 0, kept: 0 };
  const items = idx.map((i) => all[i]);
  try {
    const raw = await llm.complete(translatePrompt(items, to), { schema: responseSchema, maxTokens: 4000 });
    const parsed = responseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.items.length !== items.length)
      return { content: c, status: "error", sent: items.length, kept: items.length };
    const next = [...all];
    let kept = 0;
    idx.forEach((i, k) => {
      const v = acceptTranslation(all[i], parsed.data.items[k]);
      if (v === all[i]) kept++;
      next[i] = v;
    });
    return { content: withStrings(c, next), status: "translated", sent: items.length, kept };
  } catch (e) {
    if (e instanceof AiLimitError)
      return { content: c, status: "limited", reason: e.reason, sent: items.length, kept: items.length };
    return { content: c, status: "error", sent: items.length, kept: items.length };
  }
}
