import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { notify } from "./create";
import { toEffective } from "./prefs";

const DAY = 86_400_000;

/** Whole days between two instants (floor). */
export const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY);

/**
 * Whether an application is due a follow-up reminder: status APPLIED (no reply yet), applied at least
 * `days` ago and not touched since then.
 */
export function followUpDue(
  app: { status: string; appliedAt: Date | null; updatedAt: Date; createdAt: Date },
  days: number,
  now: Date,
): boolean {
  if (app.status !== "APPLIED") return false;
  const applied = app.appliedAt ?? app.createdAt;
  const lastTouch = app.updatedAt > applied ? app.updatedAt : applied;
  return daysBetween(applied, now) >= days && daysBetween(lastTouch, now) >= days;
}

const localeOf = (l: string | null | undefined): Locale => (l === "en" ? "en" : "he");

export async function runFollowUpReminders(now = new Date()): Promise<{ reminded: number }> {
  // Upper bound with the smallest allowed setting (1 day); exact per-user days are checked below.
  const apps = await db.application.findMany({
    where: { status: "APPLIED", updatedAt: { lte: new Date(now.getTime() - DAY) } },
    select: {
      id: true,
      userId: true,
      title: true,
      company: true,
      status: true,
      appliedAt: true,
      updatedAt: true,
      createdAt: true,
      jobId: true,
      user: { select: { locale: true, notificationPrefs: true } },
    },
    take: 2000,
  });
  let reminded = 0;
  for (const a of apps) {
    const prefs = toEffective(a.user.notificationPrefs);
    if (!prefs.followUpEnabled || !followUpDue(a, prefs.followUpDays, now)) continue;
    const s = notificationStrings(localeOf(a.user.locale));
    const days = daysBetween(a.appliedAt ?? a.createdAt, now);
    const created = await notify(
      a.userId,
      {
        kind: "FOLLOW_UP",
        title: fill(s.followTitle, { title: a.title }),
        body: fill(s.followBody, { company: a.company, days }),
        url: a.jobId ? `/jobs/${a.jobId}` : "/dashboard",
        data: { applicationId: a.id },
        // One reminder per application per "applied" date.
        dedupeKey: `followup:${a.id}:${(a.appliedAt ?? a.createdAt).toISOString().slice(0, 10)}`,
      },
      { now },
    );
    if (created) reminded++;
  }
  return { reminded };
}

/** Saved (not yet applied) jobs that were closed by the employer in the last 3 days. */
export async function runSavedJobClosed(now = new Date()): Promise<{ closed: number }> {
  const apps = await db.application.findMany({
    where: {
      status: "SAVED",
      job: { isActive: false, updatedAt: { gte: new Date(now.getTime() - 3 * DAY) } },
    },
    select: {
      id: true,
      userId: true,
      jobId: true,
      title: true,
      company: true,
      user: { select: { locale: true } },
    },
    take: 2000,
  });
  let closed = 0;
  for (const a of apps) {
    const s = notificationStrings(localeOf(a.user.locale));
    const created = await notify(
      a.userId,
      {
        kind: "SAVED_JOB_CLOSED",
        title: fill(s.closedTitle, { title: a.title }),
        body: fill(s.closedBody, { company: a.company }),
        url: a.jobId ? `/jobs/${a.jobId}` : "/dashboard",
        data: { applicationId: a.id },
        dedupeKey: `closed:${a.id}`,
      },
      { now },
    );
    if (created) closed++;
  }
  return { closed };
}
