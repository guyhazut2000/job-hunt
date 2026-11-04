import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { assignmentReminderStage } from "@/lib/closing/assignments";
import { needsBrief } from "@/lib/closing/referees";
import { notify } from "./create";
import { formatInterviewTime } from "./interviews";

const HOUR = 3_600_000;

const STR = {
  he: {
    dayTitle: "מחר מגישים: {title}",
    hoursTitle: "בעוד כמה שעות מגישים: {title}",
    body: "מטלת הבית ל-{company} צריכה להיות מוגשת עד {when}.",
    briefTitle: "לתדרך את {name} לפני השיחה",
    briefBody: "{company} צפויים להתקשר אל {name} ב-{when}. יש טיוטת תדרוך מוכנה להעתקה.",
  },
  en: {
    dayTitle: "Due tomorrow: {title}",
    hoursTitle: "Due in a few hours: {title}",
    body: "The home assignment for {company} is due {when}.",
    briefTitle: "Brief {name} before the call",
    briefBody: "{company} are expected to call {name} on {when}. A brief draft is ready to copy.",
  },
} as const;

const fillS = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

export function buildAssignmentReminder(
  locale: Locale,
  a: { title: string; company: string; dueAt: Date },
  stage: "day" | "hours",
): { title: string; body: string } {
  const s = STR[locale];
  return {
    title: fillS(stage === "day" ? s.dayTitle : s.hoursTitle, { title: a.title.slice(0, 80) }),
    body: fillS(s.body, { company: a.company, when: formatInterviewTime(a.dueAt, locale) }),
  };
}

/**
 * Final-stage reminders (#111), hourly: home assignments ~a day and a few hours before the due time, and a
 * "brief your referee" nudge when a reference call is expected within 48h. In-app/push/Telegram only — never
 * contacts the referee.
 */
export async function runClosingReminders(now = new Date()): Promise<{ assignments: number; briefs: number }> {
  const rows = await db.homeAssignment.findMany({
    where: {
      dueAt: { gt: now, lte: new Date(now.getTime() + 27 * HOUR) },
      status: { in: ["TODO", "IN_PROGRESS"] },
      application: { archivedAt: null },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      dueAt: true,
      application: { select: { company: true } },
      user: { select: { locale: true } },
    },
    take: 1000,
  });
  let assignments = 0;
  for (const a of rows) {
    if (!a.dueAt) continue;
    const stage = assignmentReminderStage(a.dueAt, now);
    if (!stage) continue;
    const locale: Locale = a.user.locale === "en" ? "en" : "he";
    const msg = buildAssignmentReminder(locale, { title: a.title, company: a.application.company, dueAt: a.dueAt }, stage);
    const created = await notify(
      a.userId,
      {
        kind: "DEADLINE",
        ...msg,
        url: "/closing/assignments",
        data: { assignmentId: a.id, stage },
        dedupeKey: `assignment:${a.id}:${a.dueAt.toISOString()}:${stage}`,
      },
      { now, expiresAt: a.dueAt },
    );
    if (created) assignments++;
  }

  const links = await db.refereeLink.findMany({
    where: {
      expectedCallAt: { gt: now, lte: new Date(now.getTime() + 48 * HOUR) },
      briefedAt: null,
      application: { archivedAt: null },
    },
    select: {
      id: true,
      expectedCallAt: true,
      briefedAt: true,
      application: { select: { company: true } },
      referee: { select: { name: true, userId: true, user: { select: { locale: true } } } },
    },
    take: 1000,
  });
  let briefs = 0;
  for (const l of links) {
    if (!l.expectedCallAt || !needsBrief(l, now)) continue;
    const locale: Locale = l.referee.user.locale === "en" ? "en" : "he";
    const s = STR[locale];
    const vars = {
      name: l.referee.name,
      company: l.application.company,
      when: formatInterviewTime(l.expectedCallAt, locale),
    };
    const created = await notify(
      l.referee.userId,
      {
        kind: "DEADLINE",
        title: fillS(s.briefTitle, vars),
        body: fillS(s.briefBody, vars),
        url: "/closing/references",
        data: { refereeLinkId: l.id },
        dedupeKey: `referee-brief:${l.id}:${l.expectedCallAt.toISOString()}`,
      },
      { now, expiresAt: l.expectedCallAt },
    );
    if (created) briefs++;
  }
  return { assignments, briefs };
}
