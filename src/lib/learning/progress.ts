import { z } from "zod";
import type { SkillNode, Stage } from "./types";
import { STAGES } from "./types";

/** Per-stage practice state stored in StageProgress.practice. */
export const practiceSchema = z.record(
  z.string().max(40),
  z.object({ done: z.boolean(), notes: z.string().max(4000).optional() }),
);
export type PracticeState = z.infer<typeof practiceSchema>;

export function parsePractice(raw: unknown): PracticeState {
  const r = practiceSchema.safeParse(raw);
  return r.success ? r.data : {};
}

export interface StageRow {
  skill: string;
  stage: string;
  status: "LEARNING" | "DONE";
  topicsDone: string[];
  practice: unknown;
  updatedAt: Date;
}

export type StageState = "todo" | "active" | "done";

export interface StageRollup {
  stage: Stage;
  state: StageState;
  /** 0..1 — done = 1; otherwise ticked roadmap topics weigh up to 0.9. */
  fraction: number;
  topicsDone: number;
  topicsTotal: number;
  practiceDone: number;
}

export interface SkillRollup {
  stages: StageRollup[];
  /** 0..100, average of the stage fractions. */
  pct: number;
  doneStages: number;
  /** The first stage that is not done (where "continue" should land), or null when all are. */
  nextStage: Stage | null;
}

export function isStage(s: string): s is Stage {
  return (STAGES as readonly string[]).includes(s);
}

export function stageRollup(node: SkillNode, stage: Stage, row: StageRow | undefined, skillDone = false): StageRollup {
  const topics = node.stages[stage];
  const ticked = row ? row.topicsDone.filter((t) => topics.includes(t)).length : 0;
  const practiceDone = row ? Object.values(parsePractice(row.practice)).filter((p) => p.done).length : 0;
  const done = skillDone || row?.status === "DONE";
  const fraction = done ? 1 : topics.length ? (0.9 * ticked) / topics.length : 0;
  const state: StageState = done ? "done" : row ? "active" : "todo";
  return {
    stage,
    state,
    fraction,
    topicsDone: done ? topics.length : ticked,
    topicsTotal: topics.length,
    practiceDone,
  };
}

/** Roll a skill's stage rows up. A skill marked DONE counts every stage as done (legacy/explicit). */
export function skillRollup(node: SkillNode, rows: StageRow[], skillStatus?: "LEARNING" | "DONE"): SkillRollup {
  const skillDone = skillStatus === "DONE";
  const byStage = new Map(rows.filter((r) => r.skill === node.id).map((r) => [r.stage, r]));
  const stages = STAGES.map((st) => stageRollup(node, st, byStage.get(st), skillDone));
  const pct = Math.round((stages.reduce((a, s) => a + s.fraction, 0) / stages.length) * 100);
  const doneStages = stages.filter((s) => s.state === "done").length;
  return { stages, pct, doneStages, nextStage: stages.find((s) => s.state !== "done")?.stage ?? null };
}

/** True when every stage has a DONE row — the trigger for marking the whole skill done. */
export function allStagesDone(skill: string, rows: Pick<StageRow, "skill" | "stage" | "status">[]): boolean {
  const done = new Set(rows.filter((r) => r.skill === skill && r.status === "DONE").map((r) => r.stage));
  return STAGES.every((s) => done.has(s));
}

// ── Time / streak stats (days are counted in the product's home time zone) ──

export const LEARNING_TZ = "Asia/Jerusalem";

export function dayKey(d: Date, tz = LEARNING_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    d,
  );
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function weekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}

/** Day keys of the current week (Sunday → today), Israeli week. */
export function weekKeys(now: Date, tz = LEARNING_TZ): string[] {
  const today = dayKey(now, tz);
  const n = weekday(today);
  return Array.from({ length: n + 1 }, (_, i) => shiftKey(today, i - n));
}

/** Consecutive active days ending today (or yesterday, so the streak survives until tonight). */
export function streakDays(activity: Date[], now: Date, tz = LEARNING_TZ): number {
  const days = new Set(activity.map((d) => dayKey(d, tz)));
  let cur = dayKey(now, tz);
  if (!days.has(cur)) cur = shiftKey(cur, -1);
  let n = 0;
  while (days.has(cur)) {
    n++;
    cur = shiftKey(cur, -1);
  }
  return n;
}

export interface LearningStats {
  minutesThisWeek: number;
  totalMinutes: number;
  activeDaysThisWeek: number;
  streak: number;
}

export function learningStats(
  sessions: { minutes: number; createdAt: Date }[],
  activity: Date[],
  now: Date,
  tz = LEARNING_TZ,
): LearningStats {
  const week = new Set(weekKeys(now, tz));
  const all = [...activity, ...sessions.map((s) => s.createdAt)];
  return {
    minutesThisWeek: sessions.filter((s) => week.has(dayKey(s.createdAt, tz))).reduce((a, s) => a + s.minutes, 0),
    totalMinutes: sessions.reduce((a, s) => a + s.minutes, 0),
    activeDaysThisWeek: new Set(all.map((d) => dayKey(d, tz)).filter((k) => week.has(k))).size,
    streak: streakDays(all, now, tz),
  };
}

// ── Spaced repetition lite ──

export type Rating = "KNEW" | "PARTLY" | "MISSED";
const INTERVAL_DAYS = [1, 3, 7, 16, 35];

/**
 * Next review for a Q&A card. Knew it → growing interval (1, 3, 7, 16, 35 days);
 * partly → tomorrow; didn't know → due now, so it shows up in the dashboard review right away.
 */
export function nextReview(rating: Rating, prevReps: number, now: Date): { reps: number; dueAt: Date } {
  const day = 86_400_000;
  if (rating === "MISSED") return { reps: 0, dueAt: now };
  if (rating === "PARTLY") return { reps: Math.max(0, prevReps), dueAt: new Date(now.getTime() + day) };
  const reps = prevReps + 1;
  return { reps, dueAt: new Date(now.getTime() + INTERVAL_DAYS[Math.min(reps, INTERVAL_DAYS.length) - 1] * day) };
}

const RATING_ORDER: Record<Rating, number> = { MISSED: 0, PARTLY: 1, KNEW: 2 };

/** Due cards, weakest first, then oldest due. */
export function reviewQueue<T extends { rating: Rating; dueAt: Date }>(cards: T[], now: Date, limit = 5): T[] {
  return cards
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => RATING_ORDER[a.rating] - RATING_ORDER[b.rating] || a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, limit);
}
