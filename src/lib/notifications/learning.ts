import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { learningStrings } from "@/lib/i18n/learning";
import { fill } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { GRAPH } from "@/lib/learning/graph";
import { dayKey, streakDays } from "@/lib/learning/progress";
import type { Stage } from "@/lib/learning/types";
import { notify } from "./create";
import { toEffective, type EffectivePrefs } from "./prefs";
import { israelClock } from "./quiet";

const DAY = 86_400_000;
/** Hours after learningHour a missed run may still send today's reminder (cron jitter / outages). */
export const LEARNING_CATCHUP_H = 3;

type Schedule = Pick<EffectivePrefs, "learningEnabled" | "learningHour" | "learningDays">;

/** Is `now` inside the user's study-reminder slot (scheduled weekday, learningHour … +3h, Israel time)? */
export function inLearningSlot(p: Schedule, now: Date): boolean {
  if (!p.learningEnabled) return false;
  const { day, hour } = israelClock(now);
  return p.learningDays.includes(day) && hour >= p.learningHour && hour <= p.learningHour + LEARNING_CATCHUP_H;
}

export interface LearningSnapshot {
  /** Last study activity (session, stage progress or review); null = never. */
  lastActivity: Date | null;
  /** Current streak in days (counts yesterday, so it is "at risk" when nothing happened today). */
  streak: number;
  reviewsDue: number;
  /** Stages in progress that were not touched for `learningIdleDays`. */
  overdue: { skill: string; stage: Stage; label: string }[];
  /** Where to continue, or the next recommended skill. */
  next: { skill: string; stage?: Stage; label: string } | null;
}

export type LearningReason = "streak" | "reviews" | "overdue" | "idle";

export interface LearningReminder {
  reasons: LearningReason[];
  title: string;
  body: string;
  url: string;
}

/**
 * Decide whether to nudge and what to say. Nothing when the user already studied today; otherwise
 * nudge when a streak is at risk, reviews are due, a stage has stalled, or they've been idle for
 * `idleDays`. Pure (tests): the cron gathers the snapshot.
 */
export function planLearningReminder(
  snap: LearningSnapshot,
  idleDays: number,
  now: Date,
  locale: Locale,
): LearningReminder | null {
  if (!snap.lastActivity) return null; // never started learning — no nagging
  const today = dayKey(now);
  if (dayKey(snap.lastActivity) === today) return null;
  const idle = Math.floor((now.getTime() - snap.lastActivity.getTime()) / DAY);
  const reasons: LearningReason[] = [];
  if (snap.streak > 0) reasons.push("streak");
  if (snap.reviewsDue > 0) reasons.push("reviews");
  if (snap.overdue.length) reasons.push("overdue");
  if (idle >= idleDays) reasons.push("idle");
  if (!reasons.length) return null;

  const s = reminderStrings(locale);
  const stageName = learningStrings(locale).stage;
  const title =
    reasons[0] === "streak"
      ? fill(s.learnStreakTitle, { n: snap.streak })
      : reasons[0] === "reviews"
        ? fill(s.learnReviewsTitle, { n: snap.reviewsDue })
        : reasons.includes("idle")
          ? fill(s.learnIdleTitle, { n: idle })
          : s.learnOverdueTitle;
  const lines: string[] = [];
  if (snap.next)
    lines.push(
      fill(s.learnNext, {
        topic: snap.next.stage ? `${snap.next.label} · ${stageName[snap.next.stage]}` : snap.next.label,
      }),
    );
  if (snap.reviewsDue > 0 && reasons[0] !== "reviews") lines.push(fill(s.learnReviewsLine, { n: snap.reviewsDue }));
  if (snap.overdue.length)
    lines.push(
      fill(s.learnOverdueLine, {
        list: snap.overdue
          .slice(0, 2)
          .map((o) => `${o.label} · ${stageName[o.stage]}`)
          .join(", "),
      }),
    );
  lines.push(s.learnTip);
  const url = snap.next?.stage ? `/learn/${snap.next.skill}/${snap.next.stage}` : "/learn/me";
  return { reasons, title, body: lines.join("\n"), url };
}

const labelOf = (skill: string) => GRAPH.byId.get(skill)?.label ?? skill;

/** Gather the snapshot for one user with a few cheap queries (no demand/impact computation). */
export async function learningSnapshot(userId: string, idleDays: number, now: Date): Promise<LearningSnapshot> {
  const since60 = new Date(now.getTime() - 60 * DAY);
  const [rows, sessions, reviews, reviewsDue, skills, patternAttempts] = await Promise.all([
    db.stageProgress.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 200 }),
    db.studySession.findMany({
      where: { userId, createdAt: { gte: since60 } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.questionReview.findMany({
      where: { userId, updatedAt: { gte: since60 } },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    db.questionReview.count({ where: { userId, dueAt: { lte: now } } }),
    db.skillProgress.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 50 }),
    db.patternAttempt.findMany({
      where: { userId, createdAt: { gte: since60 } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  const activity = [
    ...rows.map((r) => r.updatedAt),
    ...sessions.map((r) => r.createdAt),
    ...reviews.map((r) => r.updatedAt),
    ...patternAttempts.map((r) => r.createdAt),
  ].filter((d) => d >= since60);
  const lastActivity = activity.length ? new Date(Math.max(...activity.map((d) => d.getTime()))) : null;
  const done = new Set(skills.filter((s) => s.status === "DONE").map((s) => s.skill));
  const open = rows.filter((r) => r.status !== "DONE" && !done.has(r.skill) && GRAPH.byId.has(r.skill));
  const overdue = open
    .filter((r) => now.getTime() - r.updatedAt.getTime() >= idleDays * DAY)
    .map((r) => ({ skill: r.skill, stage: r.stage as Stage, label: labelOf(r.skill) }));
  const resume = open[0];
  const learning = skills.find((s) => s.status === "LEARNING" && !done.has(s.skill) && GRAPH.byId.has(s.skill));
  const next = resume
    ? { skill: resume.skill, stage: resume.stage as Stage, label: labelOf(resume.skill) }
    : learning
      ? { skill: learning.skill, label: labelOf(learning.skill) }
      : null;
  return { lastActivity, streak: streakDays(activity, now), reviewsDue, overdue, next };
}

/** Study reminders for users who have started learning, once per Israel day in their slot. */
export async function runLearningReminders(now = new Date()): Promise<{ checked: number; reminded: number }> {
  const learners = await db.user.findMany({
    where: { OR: [{ stageProgress: { some: {} } }, { skillProgress: { some: {} } }] },
    select: { id: true, locale: true, notificationPrefs: true },
    take: 500,
  });
  const today = dayKey(now);
  let checked = 0;
  let reminded = 0;
  for (const u of learners) {
    const prefs = toEffective(u.notificationPrefs);
    if (!inLearningSlot(prefs, now)) continue;
    checked++;
    const locale: Locale = u.locale === "en" ? "en" : "he";
    const plan = planLearningReminder(
      await learningSnapshot(u.id, prefs.learningIdleDays, now),
      prefs.learningIdleDays,
      now,
      locale,
    );
    if (!plan) continue;
    const created = await notify(
      u.id,
      {
        kind: "LEARNING",
        title: plan.title,
        body: plan.body,
        url: plan.url,
        data: { reasons: plan.reasons },
        dedupeKey: `learning:${today}`,
      },
      { now },
    );
    if (created) reminded++;
  }
  return { checked, reminded };
}
