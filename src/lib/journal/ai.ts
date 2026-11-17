/**
 * AI half of the work journal (docs/work-journal.md). Two guarded calls:
 *  - `journal_extract` (on save): achievements + 1–3 follow-up questions about metrics / impact;
 *  - `journal_bullets` (on request): X-Y-Z bullets for one role from a period of entries.
 * Both validated (no invented numbers / technologies) and both with a rules fallback.
 */
import { z } from "zod";
import type { LLMMessage, LLMProvider } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import type { Gender } from "@/lib/cv-assist/ai";
import {
  acceptJournalBullet,
  entriesFacts,
  insightsSchema,
  ruleInsights,
  ruleJournalBullets,
  sanitizeInsights,
  type Answer,
  type Insights,
  type JournalEntryLite,
} from "./core";

export type JournalStatus = "ok" | "off" | "limited" | "error";
const LANG = (l: "he" | "en") => (l === "en" ? "English" : "Hebrew");
const statusOf = (e: unknown): JournalStatus => (e instanceof AiLimitError ? "limited" : "error");

export function insightsPrompt(i: { text: string; role: string; lang: "he" | "en"; answers?: Answer[] }): LLMMessage[] {
  return [
    {
      role: "system",
      content:
        "You help a software professional keep a work journal that later becomes CV bullets. Read their entry and return JSON " +
        '{"achievements":[{"action":string,"tech":string[],"systems":string[],"impact":string|null}],"questions":string[]}. ' +
        "achievements: each concrete thing they did, as a short past-tense phrase in the entry's language without a pronoun " +
        "(Hebrew: פיתחתי / בניתי / עזרתי לפתח; English: Built / Automated / Helped develop). tech: technologies named in the entry " +
        "ONLY. systems: systems, services or teams involved, as written. impact: the likely business/technical effect worded as a " +
        "possibility for the user to confirm, WITHOUT any number they didn't write (or null). " +
        `questions: 1-3 SHORT follow-up questions in ${LANG(i.lang)} that get the missing numbers or impact ` +
        "(time saved, volume, users, before/after, reliability) — only what is actually missing. Never invent facts.",
    },
    {
      role: "user",
      content:
        `Role: ${i.role || "(not set)"}\nEntry:\n${i.text}` +
        (i.answers?.length ? `\n\nAlready answered:\n${i.answers.map((a) => `Q: ${a.q}\nA: ${a.a}`).join("\n")}` : ""),
    },
  ];
}

export async function extractInsights(
  llm: LLMProvider,
  i: { text: string; role: string; lang: "he" | "en"; answers?: Answer[] },
): Promise<Insights> {
  const rules = (status: JournalStatus): Insights => ({ ...ruleInsights(i.text, i.lang), status });
  if (llm.name === "mock") return rules("off");
  try {
    const raw = await llm.complete(insightsPrompt(i), { schema: insightsSchema, maxTokens: 1200 });
    const parsed = insightsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !parsed.data.achievements.length) return rules("error");
    return { ...sanitizeInsights(parsed.data, i.text, i.answers), status: "ok" };
  } catch (e) {
    return rules(statusOf(e));
  }
}

export const journalBulletsSchema = z.object({
  bullets: z
    .array(z.object({ text: z.string().max(600), days: z.array(z.string().max(10)).max(20).default([]) }))
    .max(12),
});

export interface JournalBulletsInput {
  role: string;
  lang: "he" | "en";
  gender?: Gender;
  entries: JournalEntryLite[];
  /** Bullets the role already has (not to repeat). */
  existing: string[];
  /** Target-job keywords the user already has (may be emphasized where supported). */
  have: string[];
  targetTitle?: string;
  /** The user's CV text (allowed technologies). */
  corpus: string;
}

export interface JournalBullet {
  text: string;
  days: string[];
}
export interface JournalBulletsResult {
  status: JournalStatus;
  source: "ai" | "rules";
  bullets: JournalBullet[];
  rejected: number;
}

export function journalBulletsPrompt(i: JournalBulletsInput): LLMMessage[] {
  const he = i.lang === "he";
  return [
    {
      role: "system",
      content:
        `You are a senior tech recruiter turning a candidate's work journal into CV experience bullets in ${LANG(i.lang)}. ` +
        'Return JSON {"bullets":[{"text":string,"days":["YYYY-MM-DD"]}]} — 2 to 6 bullets, merging related entries, each ' +
        "X-Y-Z: accomplished [X] as measured by [Y] by doing [Z], max 220 characters, strongest first. " +
        (he
          ? "Natural Israeli high-tech CV Hebrew: past-tense verbs without a pronoun (פיתחתי, בניתי, הובלתי); technology names in English; never slash forms like מפתח/ת. "
          : "Concise professional English starting with a strong past-tense verb. ") +
        "HARD RULES: use ONLY facts from the entries and the answers. A number may appear ONLY if the user wrote it; " +
        'otherwise put a placeholder in square brackets — "[X%]", "[N]", "[מספר]" or "[מדד]". Never add a technology, team ' +
        "size, product or duration that isn't written. Don't repeat the existing bullets. " +
        (i.have.length
          ? `Where the entries support it, prefer these target-job keywords: ${i.have.join(", ")}. `
          : "") +
        `EXAMPLES (illustrative only; never copy their facts):\n` +
        'entry "ביום ראשון פיתחתי אוטומציה שמעבירה קבצים משרת לשרת" → "פיתחתי אוטומציה להעברת קבצים בין שרתים, שחסכה [N] שעות עבודה ידנית בשבוע"\n' +
        'entry "helped build a service that talks to the billing system; it now syncs 2000 invoices a day" → "Co-developed a billing integration service syncing 2,000 invoices a day, replacing [N] manual steps"',
    },
    {
      role: "user",
      content:
        `Role: ${i.role}${i.targetTitle ? `\nTarget job: ${i.targetTitle}` : ""}\n` +
        (i.existing.length ? `Existing bullets:\n${i.existing.map((b) => `- ${b}`).join("\n")}\n` : "") +
        `Journal entries:\n` +
        i.entries
          .map(
            (e) =>
              `[${e.day}] ${e.text}` +
              (e.answers.length ? `\n  answers: ${e.answers.map((a) => `${a.q} → ${a.a}`).join(" | ")}` : ""),
          )
          .join("\n"),
    },
  ];
}

const MAX_ENTRIES = 40;

export async function suggestJournalBullets(llm: LLMProvider, raw: JournalBulletsInput): Promise<JournalBulletsResult> {
  const i = { ...raw, entries: raw.entries.slice(-MAX_ENTRIES).map((e) => ({ ...e, text: e.text.slice(0, 1500) })) };
  const facts = entriesFacts(i.entries);
  const rules = (status: JournalStatus): JournalBulletsResult => ({
    status,
    source: "rules",
    bullets: ruleJournalBullets(i.entries, i.lang, i.existing).map((text) => ({ text, days: [] })),
    rejected: 0,
  });
  if (!i.entries.length) return { status: "ok", source: "ai", bullets: [], rejected: 0 };
  if (llm.name === "mock") return rules("off");
  try {
    const out = await llm.complete(journalBulletsPrompt(i), { schema: journalBulletsSchema, maxTokens: 1600 });
    const parsed = journalBulletsSchema.safeParse(JSON.parse(out));
    if (!parsed.success) return rules("error");
    const bullets: JournalBullet[] = [];
    let rejected = 0;
    const days = new Set(i.entries.map((e) => e.day));
    for (const b of parsed.data.bullets) {
      const ok = acceptJournalBullet(b.text, facts, `${i.corpus}\n${i.have.join(" ")}`, [
        ...i.existing,
        ...bullets.map((x) => x.text),
      ]);
      if (!ok) {
        rejected++;
        continue;
      }
      bullets.push({ text: ok, days: b.days.filter((d) => days.has(d)) });
    }
    if (!bullets.length) return { ...rules("ok"), rejected };
    return { status: "ok", source: "ai", bullets, rejected };
  } catch (e) {
    return rules(statusOf(e));
  }
}
