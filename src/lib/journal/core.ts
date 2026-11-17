/**
 * Work journal ("יומן עבודה") — pure logic (docs/work-journal.md). The user writes what they did at
 * work; we read achievements out of it, ask for the missing numbers, and turn a period of entries
 * into X-Y-Z bullets for that role. Never invents a number: only numbers the user wrote (in an
 * entry or an answer) may appear, everything else is a "[X%]" placeholder.
 */
import { z } from "zod";
import { introducesFacts } from "@/lib/cv-tailor/tailor";
import { hasFirstPersonPronoun, hasMetric } from "@/lib/cv-standard/verbs";
import { LIMITS } from "@/lib/cv-standard/rules";
import { PLACEHOLDER_RE } from "@/lib/cv-standard/draft";
import { norm, similarity } from "@/lib/cv-assist/core";
import { extractTech } from "@/lib/taxonomy";

export const MAX_ENTRY_CHARS = 4000;
export const MAX_QUESTIONS = 3;

export interface RoleRef {
  index: number;
  company: string;
  title: string;
  start: string;
  end: string;
}

export const roleKey = (company: string, title: string) => `${norm(company)}|${norm(title)}`;
export const roleLabel = (r: { company: string; title: string }) => [r.title, r.company].filter(Boolean).join(" · ");

/** Default role: the current one (no end date), else the latest start. */
export function defaultRole<T extends { start: string; end: string }>(roles: T[]): T | null {
  if (!roles.length) return null;
  const current = roles.find((r) => !r.end);
  if (current) return current;
  return [...roles].sort((a, b) => (b.start || "").localeCompare(a.start || ""))[0];
}

export const achievementSchema = z.object({
  action: z.string().trim().min(2).max(300),
  tech: z.array(z.string().trim().max(40)).max(12).default([]),
  systems: z.array(z.string().trim().max(80)).max(8).default([]),
  /** Possible impact the user may confirm — never a number the user didn't write. */
  impact: z.string().trim().max(200).nullable().default(null),
});
export type Achievement = z.infer<typeof achievementSchema>;

export const insightsSchema = z.object({
  achievements: z.array(achievementSchema).max(8),
  questions: z.array(z.string().trim().min(3).max(200)).max(MAX_QUESTIONS),
});
export type Insights = z.infer<typeof insightsSchema> & { source: "ai" | "rules"; status?: string };

export interface Answer {
  q: string;
  a: string;
}
export const answersSchema = z.array(z.object({ q: z.string().max(200), a: z.string().max(500) })).max(6);

const NUM_RE = /\d+(?:[.,]\d+)?/g;
const nums = (s: string) => new Set((s.match(NUM_RE) ?? []).map((n) => n.replace(",", ".")));

// ---------- rules reading (no AI) ----------

/** "On Sunday", "היום", "ביום ראשון", "השבוע" … at the start of a sentence — dropped from bullets. */
const TIME_LEAD =
  /^(?:(?:on|this|last)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|week|morning)|today|yesterday|ביום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|היום|אתמול|השבוע|בשבוע\s+(?:שעבר|הזה)|הבוקר)[,\s]+/i;

export function stripTimeLead(s: string): string {
  return s.replace(TIME_LEAD, "").trim();
}

/** Split an entry into achievement-sized sentences ("…, ועזרתי לפתח …" splits too). */
export function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(
      /\n+|(?<=[.!?;])\s+|,\s+(?=ו?(?:עזרתי|פיתחתי|בניתי|הובלתי|תיקנתי|כתבתי|שדרגתי|העברתי|helped|built|developed|fixed|led|wrote)(?![\u0590-\u05ffa-z]))|\s+(?=ו(?:עזרתי|פיתחתי|בניתי|הובלתי|תיקנתי|כתבתי|שדרגתי)(?![\u0590-\u05ff]))|\s+and\s+(?=(?:helped|built|developed|fixed|led|wrote)\b)/i,
    )
    .map((s) =>
      stripTimeLead(
        s
          .replace(/^[-•●*]\s*/, "")
          .replace(/^ו(?=[א-ת])/, "")
          .trim(),
      ),
    )
    .map((s) => s.replace(/[.。]+$/, ""))
    .filter((s) => s.length >= 8);
}

const AUTOMATION = /אוטומצי|סקריפט|automat|script|cron|pipeline/i;
const INTEGRATION = /מתממשק|אינטגרצי|ממשק|מתקשר|integrat|api|webhook|sync/i;
const BUGFIX = /באג|תקל|bug|fix|incident|תיקנתי/i;
const PERF = /ביצוע|מהיר|האצ|performance|latency|faster|optimi/i;

/** Rules fallback: one achievement per sentence, tech from the taxonomy, metric questions from cues. */
export function ruleInsights(text: string, lang: "he" | "en"): Insights {
  const parts = sentences(text).slice(0, 6);
  const achievements = parts.map((s) => ({ action: s.slice(0, 300), tech: extractTech(s), systems: [], impact: null }));
  const q: string[] = [];
  const he = lang === "he";
  const all = parts.join(" ");
  if (AUTOMATION.test(all))
    q.push(
      he
        ? "כמה זמן או עבודה ידנית האוטומציה חוסכת (בשבוע / בחודש)?"
        : "How much time or manual work does the automation save (per week / month)?",
    );
  if (INTEGRATION.test(all))
    q.push(
      he
        ? "אילו מערכות זה מחבר, ומה זה מאפשר שלא היה אפשרי קודם?"
        : "Which systems does it connect, and what does it enable that wasn't possible before?",
    );
  if (BUGFIX.test(all)) q.push(he ? "כמה משתמשים או תקלות זה פתר?" : "How many users or incidents did it resolve?");
  if (PERF.test(all)) q.push(he ? "מה היה הזמן לפני ואחרי?" : "What was the time before and after?");
  if (!hasMetric(all) && q.length < MAX_QUESTIONS)
    q.push(
      he
        ? "מי משתמש בזה וכמה (משתמשים / צוותים / קבצים ביום)?"
        : "Who uses it and how much (users / teams / files a day)?",
    );
  return { achievements, questions: q.slice(0, MAX_QUESTIONS), source: "rules" };
}

/** Clean a model reading: tech only from the entry, no invented numbers in impact, short questions. */
export function sanitizeInsights(raw: z.infer<typeof insightsSchema>, text: string, answers: Answer[] = []): Insights {
  const src = `${text}\n${answers.map((x) => x.a).join("\n")}`;
  const allowedTech = new Set(extractTech(src));
  const lower = src.toLowerCase();
  const okNums = nums(src);
  const achievements = raw.achievements.map((a) => ({
    action: a.action,
    tech: a.tech.filter((t) => allowedTech.has(t) || lower.includes(t.toLowerCase())),
    systems: a.systems,
    impact: a.impact && [...nums(a.impact)].every((n) => okNums.has(n)) ? a.impact : null,
  }));
  return {
    achievements: achievements.filter((a) => [...nums(a.action)].every((n) => okNums.has(n))),
    questions: raw.questions.slice(0, MAX_QUESTIONS),
    source: "ai",
  };
}

// ---------- bullets from a period of entries ----------

export interface JournalEntryLite {
  id: string;
  day: string;
  text: string;
  answers: Answer[];
  insights: Insights | null;
}

export function inPeriod(day: string, from?: string | null, to?: string | null): boolean {
  return (!from || day >= from) && (!to || day <= to);
}

/** Everything the user wrote for these entries — the only allowed source of numbers. */
export function entriesFacts(entries: JournalEntryLite[]): string {
  return entries.map((e) => `${e.text}\n${e.answers.map((x) => `${x.q} ${x.a}`).join("\n")}`).join("\n");
}

/**
 * Accept a journal bullet only when it adds no fact: numbers from the user's entries/answers,
 * technologies from the entries or their CV, no pronoun, a sane length, not a repeat.
 */
export function acceptJournalBullet(text: string, facts: string, corpus: string, existing: string[]): string | null {
  const r = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/, "");
  if (r.length < 15 || r.length > LIMITS.bulletMaxChars) return null;
  const stripped = r.replace(new RegExp(PLACEHOLDER_RE.source, "g"), " ");
  if (introducesFacts(stripped, new Set(extractTech(`${facts}\n${corpus}`)), nums(facts))) return null;
  if (hasFirstPersonPronoun(r)) return null;
  if (existing.some((b) => similarity(b, r) >= 0.7 || norm(b) === norm(r))) return null;
  return r;
}

/** Rules bullets: each achievement (or sentence) + a placeholder result clause when it has no number. */
export function ruleJournalBullets(entries: JournalEntryLite[], lang: "he" | "en", existing: string[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    const acts = e.insights?.achievements.length ? e.insights.achievements.map((a) => a.action) : sentences(e.text);
    // The user's numeric answer belongs to the entry's main (first) achievement.
    const answer = e.answers.find((x) => hasMetric(x.a))?.a;
    for (const [k, a] of acts.entries()) {
      const base = stripTimeLead(a).replace(/[.。]+$/, "");
      if (!base) continue;
      const answered = k === 0 ? answer : undefined;
      const text = hasMetric(base)
        ? base
        : answered
          ? `${base} (${answered.trim()})`
          : lang === "he"
            ? `${base}, מה ששיפר את [מדד] ב-[X%]`
            : `${base}, improving [metric] by [X%]`;
      if (text.length > LIMITS.bulletMaxChars) continue;
      if ([...out, ...existing].some((b) => similarity(b, text) >= 0.7)) continue;
      out.push(text);
    }
  }
  return out.slice(0, 8);
}

/** Israel calendar day (YYYY-MM-DD). */
export function israelDayOf(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Should the reminder go out now? Daily at/after `hour`; weekly on `weekday` at/after `hour`; once per period. */
export function reminderDue(
  s: { reminderOn: boolean; frequency: string; weekday: number; hour: number; lastRemindedAt: Date | null },
  clock: { day: number; hour: number; date: string },
  lastEntryDay: string | null,
  now: Date,
): boolean {
  if (!s.reminderOn || clock.hour < s.hour) return false;
  const weekly = s.frequency !== "daily";
  if (weekly && clock.day !== s.weekday) return false;
  const period = weekly ? 6.5 * 86_400_000 : 20 * 3_600_000;
  if (s.lastRemindedAt && now.getTime() - s.lastRemindedAt.getTime() < period) return false;
  // Already wrote in this period → no nudge.
  if (lastEntryDay) {
    const since = israelDayOf(new Date(now.getTime() - (weekly ? 6 : 0) * 86_400_000));
    if (lastEntryDay >= since) return false;
  }
  return true;
}
