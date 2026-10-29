import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { notify } from "./create";
import { toEffective } from "./prefs";

const HOUR = 3_600_000;

/**
 * Reminder windows. The hourly cron fires once per clock hour (Vercel Hobby: anywhere inside the
 * hour), so consecutive runs can be up to ~2h apart; the windows are wide enough that each reminder
 * is caught by at least one run:
 *  - "2h":  0 < until ≤ 3h   → typically arrives 1–3h before
 *  - "24h": 3h < until ≤ 27h → arrives roughly a day before (or later the same day if added late)
 */
export const NEAR_WINDOW_H = 3;
export const DAY_WINDOW_H = 27;

export type InterviewStage = "24h" | "2h";

export function interviewReminderStage(interviewAt: Date, now: Date): InterviewStage | null {
  const until = interviewAt.getTime() - now.getTime();
  if (until <= 0) return null;
  if (until <= NEAR_WINDOW_H * HOUR) return "2h";
  if (until <= DAY_WINDOW_H * HOUR) return "24h";
  return null;
}

export const interviewDedupeKey = (appId: string, at: Date, stage: InterviewStage) =>
  `interview:${appId}:${at.toISOString()}:${stage}`;

/** "in about 2 hours" style lead, rounded to the half hour. */
export function hoursUntil(interviewAt: Date, now: Date): number {
  return Math.max(0.5, Math.round(((interviewAt.getTime() - now.getTime()) / HOUR) * 2) / 2);
}

export function formatInterviewTime(d: Date, locale: Locale): string {
  return d.toLocaleString(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildInterviewReminder(
  locale: Locale,
  app: { id: string; title: string; company: string; interviewAt: Date; interviewNote: string | null },
  stage: InterviewStage,
  now: Date,
): { title: string; body: string } {
  const s = reminderStrings(locale);
  const when = formatInterviewTime(app.interviewAt, locale);
  const title = fill(stage === "2h" ? s.interviewSoonTitle : s.interviewDayTitle, {
    company: app.company,
    hours: hoursUntil(app.interviewAt, now),
  });
  const lines = [fill(s.interviewBody, { title: app.title, company: app.company, when })];
  if (app.interviewNote) lines.push(app.interviewNote.slice(0, 300));
  lines.push(stage === "2h" ? s.interviewTipSoon : s.interviewTipDay);
  return { title, body: lines.join("\n") };
}

/** Interview reminders ~24h and ~2h before. Runs from the hourly cron. */
export async function runInterviewReminders(now = new Date()): Promise<{ reminded: number }> {
  const apps = await db.application.findMany({
    where: {
      interviewAt: { gt: now, lte: new Date(now.getTime() + DAY_WINDOW_H * HOUR) },
      status: { notIn: ["REJECTED"] },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      company: true,
      interviewAt: true,
      interviewNote: true,
      jobId: true,
      user: { select: { locale: true, notificationPrefs: true } },
    },
    take: 1000,
  });
  let reminded = 0;
  for (const a of apps) {
    if (!a.interviewAt) continue;
    if (!toEffective(a.user.notificationPrefs).interviewEnabled) continue;
    const stage = interviewReminderStage(a.interviewAt, now);
    if (!stage) continue;
    const locale: Locale = a.user.locale === "en" ? "en" : "he";
    const msg = buildInterviewReminder(locale, { ...a, interviewAt: a.interviewAt }, stage, now);
    const created = await notify(
      a.userId,
      {
        kind: "INTERVIEW",
        ...msg,
        url: a.jobId ? `/jobs/${a.jobId}` : "/dashboard",
        data: { applicationId: a.id, stage },
        dedupeKey: interviewDedupeKey(a.id, a.interviewAt, stage),
      },
      { now, expiresAt: a.interviewAt },
    );
    if (created) reminded++;
  }
  return { reminded };
}
