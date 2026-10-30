import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { notify, sentDedupeKeys } from "./create";
import { CONTENT_FIELDS, type ContentField } from "@/lib/jobs/content-hash";
import { entriesToAnnounce, entryText, WHATS_NEW_URL } from "@/lib/whats-new";
import { toEffective } from "./prefs";
import { followUpDedupeKey, followUpState } from "@/lib/followup/timing";
import { emailResponses } from "@/lib/followup/server";

const DAY = 86_400_000;

export { daysBetween, followUpDue } from "@/lib/followup/timing";

const localeOf = (l: string | null | undefined): Locale => (l === "en" ? "en" : "he");

/**
 * Follow-up reminders (docs/notifications.md#follow-up-reminders). Idempotent: every reminder has a
 * dedupe key per application + round + timer anchor, so re-running the cron never duplicates.
 * Instant vs. digest and quiet hours are applied by notify().
 */
export async function runFollowUpReminders(now = new Date()): Promise<{ reminded: number }> {
  // Upper bound with the smallest allowed setting (1 day); exact per-user rules are checked below.
  const apps = await db.application.findMany({
    where: {
      status: "APPLIED",
      followUpOff: false,
      noResponseAt: null,
      createdAt: { lte: new Date(now.getTime() - DAY) },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      company: true,
      status: true,
      appliedAt: true,
      createdAt: true,
      statusChangedAt: true,
      followUpCount: true,
      lastFollowUpAt: true,
      followUpSnoozedUntil: true,
      followUpOff: true,
      noResponseAt: true,
      jobId: true,
      user: { select: { locale: true, notificationPrefs: true } },
    },
    take: 2000,
  });
  const replied = await emailResponses(apps);
  let reminded = 0;
  for (const a of apps) {
    const prefs = toEffective(a.user.notificationPrefs);
    const state = followUpState(a, prefs, now, { emailResponse: replied.has(a.id) });
    const dedupeKey = followUpDedupeKey(a, state);
    if (!dedupeKey || (state.kind !== "due" && state.kind !== "ghost")) continue;
    const s = notificationStrings(localeOf(a.user.locale));
    const vars = { title: a.title, company: a.company, days: state.days };
    const ghost = state.kind === "ghost";
    const created = await notify(
      a.userId,
      {
        kind: "FOLLOW_UP",
        title: fill(ghost ? s.followGhostTitle : state.round === 2 ? s.followTitle2 : s.followTitle, vars),
        body: fill(ghost ? s.followGhostBody : s.followBody, vars),
        url: `/dashboard?followup=${a.id}#app-${a.id}`,
        data: { applicationId: a.id, round: ghost ? "ghost" : state.round },
        dedupeKey,
      },
      { now },
    );
    if (created) reminded++;
  }
  return { reminded };
}

/** Applications still in play — the user cares if the posting closes or changes. */
export const WATCHED_STATUSES = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW"] as const;

/** Saved or applied-to jobs that the employer closed in the last 3 days. */
export async function runSavedJobClosed(now = new Date()): Promise<{ closed: number }> {
  const apps = await db.application.findMany({
    where: {
      status: { in: [...WATCHED_STATUSES] },
      job: { isActive: false, updatedAt: { gte: new Date(now.getTime() - 3 * DAY) } },
    },
    select: {
      id: true,
      userId: true,
      jobId: true,
      title: true,
      company: true,
      status: true,
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
        body: fill(a.status === "SAVED" ? s.closedBody : s.closedAppliedBody, { company: a.company }),
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

/** Readable list of changed fields ("title, pay"); unknown keys are dropped. */
export function describeFields(fields: string[], labels: Record<ContentField, string>): string {
  return fields
    .filter((f): f is ContentField => (CONTENT_FIELDS as readonly string[]).includes(f))
    .map((f) => labels[f])
    .join(", ");
}

/**
 * Saved or applied-to jobs whose posting the employer edited in the last 3 days (title, location,
 * work mode, pay or description — see `src/lib/jobs/content-hash.ts`). One notice per edit.
 */
export async function runSavedJobUpdated(now = new Date()): Promise<{ updated: number }> {
  const apps = await db.application.findMany({
    where: {
      status: { in: [...WATCHED_STATUSES] },
      job: { isActive: true, contentChangedAt: { gte: new Date(now.getTime() - 3 * DAY) } },
    },
    select: {
      id: true,
      userId: true,
      jobId: true,
      title: true,
      company: true,
      job: { select: { contentChangedAt: true, changedFields: true } },
      user: { select: { locale: true } },
    },
    take: 2000,
  });
  const keyOf = (a: (typeof apps)[number]) => `updated:${a.id}:${a.job?.contentChangedAt?.toISOString()}`;
  const sent = await sentDedupeKeys(apps.map(keyOf));
  let updated = 0;
  for (const a of apps) {
    if (!a.job?.contentChangedAt || sent.has(`${a.userId}|${keyOf(a)}`)) continue;
    const s = notificationStrings(localeOf(a.user.locale));
    const fields = describeFields(a.job.changedFields, s.fields);
    if (!fields) continue;
    const created = await notify(
      a.userId,
      {
        kind: "SAVED_JOB_UPDATED",
        title: fill(s.updatedTitle, { title: a.title }),
        body: fill(s.updatedBody, { company: a.company, fields }),
        url: a.jobId ? `/jobs/${a.jobId}` : "/dashboard",
        data: { applicationId: a.id, fields: a.job.changedFields },
        dedupeKey: keyOf(a),
      },
      { now },
    );
    if (created) updated++;
  }
  return { updated };
}

/** "What's new" entries flagged `announce` (src/lib/whats-new.ts) → one WHATS_NEW notice per user. */
export async function runWhatsNew(now = new Date()): Promise<{ announced: number }> {
  const live = entriesToAnnounce(now, new Date(0));
  if (!live.length) return { announced: 0 };
  const users = await db.user.findMany({ select: { id: true, locale: true, createdAt: true }, take: 5000 });
  const sent = await sentDedupeKeys(live.map((e) => `whatsnew:${e.id}`));
  let announced = 0;
  for (const u of users) {
    for (const e of entriesToAnnounce(now, u.createdAt)) {
      if (sent.has(`${u.id}|whatsnew:${e.id}`)) continue;
      const locale = localeOf(u.locale);
      const s = notificationStrings(locale);
      const text = entryText(e, locale);
      const created = await notify(
        u.id,
        {
          kind: "WHATS_NEW",
          title: fill(s.whatsNewTitle, { title: text.title }),
          body: text.body,
          url: e.url ?? WHATS_NEW_URL,
          data: { entry: e.id },
          dedupeKey: `whatsnew:${e.id}`,
        },
        { now },
      );
      if (created) announced++;
    }
  }
  return { announced };
}
