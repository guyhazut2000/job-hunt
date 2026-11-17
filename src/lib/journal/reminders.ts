/** Hourly-cron step: work-journal reminders for users who turned them on (off by default). */
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { journalStrings } from "@/lib/i18n/journal";
import { fill } from "@/lib/i18n/notifications";
import { notify } from "@/lib/notifications/create";
import { israelClock } from "@/lib/notifications/quiet";
import { israelDayOf, reminderDue } from "./core";

export async function runJournalReminders(now: Date): Promise<{ sent: number }> {
  const clock = { ...israelClock(now), date: israelDayOf(now) };
  const rows = await db.workJournalSettings.findMany({
    where: { reminderOn: true },
    include: { user: { select: { locale: true } } },
    take: 500,
  });
  let sent = 0;
  for (const s of rows) {
    const last = await db.workJournalEntry.findFirst({
      where: { userId: s.userId },
      orderBy: { day: "desc" },
      select: { day: true },
    });
    if (!reminderDue(s, clock, last?.day ?? null, now)) continue;
    const locale: Locale = s.user.locale === "en" ? "en" : "he";
    const t = journalStrings(locale);
    const weekly = s.frequency !== "daily";
    const r = await notify(
      s.userId,
      {
        kind: "JOURNAL",
        title: fill(t.notifyTitle, { when: weekly ? t.nudgeWeek : t.nudgeDay }),
        body: t.notifyBody,
        url: "/cv/journal",
        dedupeKey: `journal:${clock.date}`,
      },
      { now },
    );
    await db.workJournalSettings.update({ where: { id: s.id }, data: { lastRemindedAt: now } });
    if (r) sent++;
  }
  return { sent };
}
