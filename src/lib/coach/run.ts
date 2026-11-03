import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { notify } from "@/lib/notifications/create";
import { israelClock } from "@/lib/notifications/quiet";
import { coachAi } from "./ai";
import { coachIsEmpty, lastWeek } from "./build";
import { collectCoachData } from "./collect";
import { coachNotification } from "./text";

/** Users handled per hourly run (each may make one Gemini call). */
const MAX_PER_RUN = 40;
/** Weekly reports are generated from this Israel hour on (the hourly cron fires once inside each hour). */
export const COACH_HOUR = 9;

/**
 * Build (or rebuild) one user's report for the last completed week, store it, and (unless `send: false`
 * or the user has nothing at all to summarize) send it as a WEEKLY_COACH notification once per week.
 */
export async function generateCoachReport(
  userId: string,
  now = new Date(),
  opts: { send?: boolean } = {},
): Promise<{ id: string; sent: boolean; empty: boolean }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true } });
  const locale: Locale = user.locale === "en" ? "en" : "he";
  const week = lastWeek(now);
  const data = await collectCoachData(userId, now, week);
  const { ai, source } = await coachAi(userId, data, locale);
  const row = {
    data: data as unknown as Prisma.InputJsonValue,
    ai: ai ? (ai as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    aiSource: source,
  };
  const report = await db.coachReport.upsert({
    where: { userId_week: { userId, week } },
    create: { userId, week, ...row },
    update: row,
    select: { id: true },
  });
  const empty = coachIsEmpty(data);
  if (empty || opts.send === false) return { id: report.id, sent: false, empty };
  const n = coachNotification(locale, data);
  const created = await notify(
    userId,
    {
      kind: "WEEKLY_COACH",
      title: n.title,
      body: ai?.summary || n.body,
      url: "/coach",
      data: { reportId: report.id, week },
      dedupeKey: `coach:${week}`,
    },
    { now },
  );
  return { id: report.id, sent: !!created, empty };
}

/** Hourly (Sunday onward, from COACH_HOUR Israel time): last week's report for users who have none yet. */
export async function runWeeklyCoach(now = new Date()): Promise<{ due: number; generated: number; sent: number }> {
  const { hour, day } = israelClock(now);
  if (day === 0 && hour < COACH_HOUR) return { due: 0, generated: 0, sent: 0 };
  const week = lastWeek(now);
  const users = await db.user.findMany({
    where: {
      OR: [{ applications: { some: {} } }, { contacts: { some: { status: { not: "NOT_CONTACTED" } } } }],
      coachReports: { none: { week } },
    },
    select: { id: true },
    take: 1000,
  });
  let generated = 0;
  let sent = 0;
  for (const u of users.slice(0, MAX_PER_RUN)) {
    try {
      const r = await generateCoachReport(u.id, now);
      generated++;
      if (r.sent) sent++;
    } catch (e) {
      console.warn("[coach] failed for a user:", e instanceof Error ? e.message.slice(0, 200) : "error");
    }
  }
  return { due: users.length, generated, sent };
}
