/**
 * "Have you used this at work?" stories (#83) — pure helpers: validation, the template STAR answer
 * (offline fallback, built only from the user's own words), the AI polish prompt and the guard that
 * rejects any AI answer introducing facts (numbers, tools) the user didn't write.
 */
import { z } from "zod";
import type { LLMMessage } from "@/lib/ai/types";
import type { StoryFields, StoryItemKind } from "@/lib/algo/industry";

export type StoryLang = "he" | "en";
export const STORY_FIELDS = ["situation", "built", "why", "result"] as const;
export type StoryField = (typeof STORY_FIELDS)[number];
export const STORY_FIELD_MAX = 600;

export const storyInputSchema = z.object({
  kind: z.enum(["ds", "pattern"]),
  itemId: z.string().min(1).max(60),
  situation: z.string().max(STORY_FIELD_MAX),
  built: z.string().max(STORY_FIELD_MAX),
  why: z.string().max(STORY_FIELD_MAX),
  result: z.string().max(STORY_FIELD_MAX),
});
export type StoryInput = z.infer<typeof storyInputSchema>;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const sentence = (s: string) => {
  const t = clean(s).replace(/[.。!?]+$/, "");
  return t ? `${t}.` : "";
};

export function normalizeFields(f: StoryFields): StoryFields {
  return { situation: clean(f.situation), built: clean(f.built), why: clean(f.why), result: clean(f.result) };
}

export function isEmptyStory(f: Partial<StoryFields> | null | undefined): boolean {
  if (!f) return true;
  return STORY_FIELDS.every((k) => !clean(f[k] ?? ""));
}

/** How many of the four prompts are filled (for the "3/4" progress chip). */
export function filledCount(f: Partial<StoryFields> | null | undefined): number {
  if (!f) return 0;
  return STORY_FIELDS.filter((k) => clean(f[k] ?? "")).length;
}

/**
 * STAR-shaped spoken answer built only from the user's text (no new facts). Used when AI is off,
 * limited, or its answer fails the guard.
 */
/** "Hash map (dictionary)" → "Hash map": the name as you'd say it out loud. */
export const spokenName = (name: string) => name.replace(/\s*\([^)]*\)/g, "").trim() || name;

/** Drop a leading "because"/"כי" so "I chose it because …" doesn't read "because because". */
const dropBecause = (s: string) => s.replace(/^(?:because|since|כי|מכיוון ש|בגלל ש)\s*/i, "");

export function templateAnswer(f: StoryFields, itemName: string, lang: StoryLang): string {
  const n = normalizeFields(f);
  n.why = dropBecause(n.why);
  itemName = spokenName(itemName);
  const parts: string[] = [];
  if (lang === "he") {
    parts.push(`כן, השתמשתי ב-${itemName} בעבודה.`);
    if (n.situation) parts.push(`המצב היה כזה: ${sentence(n.situation)}`);
    if (n.built) parts.push(`מה שעשיתי: ${sentence(n.built)}`);
    if (n.why) parts.push(`בחרתי בזה כי ${sentence(n.why)}`);
    if (n.result) parts.push(`התוצאה: ${sentence(n.result)}`);
  } else {
    parts.push(`Yes, I've used ${itemName} at work.`);
    if (n.situation) parts.push(`The situation: ${sentence(n.situation)}`);
    if (n.built) parts.push(`What I did: ${sentence(n.built)}`);
    if (n.why) parts.push(`I chose it because ${sentence(n.why)}`);
    if (n.result) parts.push(`The result: ${sentence(n.result)}`);
  }
  return parts.join(" ");
}

/** ~150 words per minute spoken → seconds. */
export function spokenSeconds(text: string): number {
  const words = clean(text).split(" ").filter(Boolean).length;
  return Math.round((words / 150) * 60);
}

export function polishPrompt(f: StoryFields, itemName: string, kind: StoryItemKind, lang: StoryLang): LLMMessage[] {
  const n = normalizeFields(f);
  itemName = spokenName(itemName);
  const what = kind === "ds" ? "data structure" : "algorithm pattern";
  const language = lang === "he" ? "Hebrew (keep technical terms in English)" : "English";
  return [
    {
      role: "system",
      content:
        "You help a software engineer rehearse a spoken interview answer. Rephrase ONLY the facts the user wrote. " +
        "Never add numbers, metrics, tools, companies, team sizes or outcomes that are not in the user's notes. " +
        "If a part is missing, leave it out rather than inventing it. Output plain text, first person, natural spoken style, " +
        "STAR order (situation, task, action, result), 70–150 words (30–60 seconds). No headings, no bullet points, no markdown.",
    },
    {
      role: "user",
      content:
        `Interview question: "Have you used ${itemName} (${what}) at work?"\nWrite the answer in ${language}.\n\n` +
        `User's notes:\nSituation: ${n.situation || "(empty)"}\nWhat I built: ${n.built || "(empty)"}\n` +
        `Why this ${what}: ${n.why || "(empty)"}\nResult / metric: ${n.result || "(empty)"}`,
    },
  ];
}

const NUM = /\d+(?:[.,]\d+)?/g;
/** Latin-script words that look like names of tools (capitalised or with dots/digits), lowercased. */
const TOOLISH = /\b[A-Z][A-Za-z0-9+.#-]{2,}\b/g;

function numbers(s: string): Set<string> {
  return new Set((s.match(NUM) ?? []).map((x) => x.replace(",", ".")));
}

/**
 * Accept an AI answer only when it is a plausible length and introduces no numbers and no
 * capitalised tool-like names that the user didn't write (or that aren't the item name itself).
 */
export function validatePolish(raw: string, f: StoryFields, itemName: string): string | null {
  const text = raw
    .replace(/[*#`>]/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  if (text.length < 60 || text.length > 1400) return null;
  const src = Object.values(normalizeFields(f)).join(" ");
  const srcNums = numbers(src);
  for (const n of numbers(text)) if (!srcNums.has(n)) return null;
  const allowed = new Set([...(src + " " + itemName).matchAll(/[A-Za-z0-9+.#-]{2,}/g)].map((m) => m[0].toLowerCase()));
  for (const m of text.matchAll(TOOLISH)) {
    const before = text.slice(0, m.index).trimEnd();
    const sentenceStart = before === "" || /[.!?:\n]$/.test(before);
    const w = m[0].toLowerCase().replace(/[.,]+$/, "");
    if (allowed.has(w)) continue;
    // A capitalised first word of an English sentence ("Then", "Our") isn't a tool name.
    if (sentenceStart && /^[A-Z][a-z]+$/.test(m[0])) continue;
    if (/^(I|I'm|I've|STAR)$/.test(m[0])) continue;
    return null;
  }
  return text;
}

/** Display name for a story item (the English canonical name — tech names stay LTR). */
export type StoryView = {
  kind: StoryItemKind;
  itemId: string;
  fields: StoryFields;
  polished: string | null;
  polishedLang: StoryLang | null;
  polishedSource: "ai" | "template" | null;
  updatedAt: string;
};
