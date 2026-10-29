import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { dayKey } from "@/lib/learning/progress";
import { siteUrl } from "@/lib/notifications/config";
import { notify } from "@/lib/notifications/create";
import { toEffective } from "@/lib/notifications/prefs";
import { israelClock } from "@/lib/notifications/quiet";
import { digestSuggestions } from "./ai";
import { digestDue, digestIsEmpty, digestSummary, digestTelegramHtml, digestWindowStart, formatDay } from "./build";
import { collectDigestData } from "./collect";

/** Users handled per hourly run (each may make one Gemini call). */
const MAX_PER_RUN = 40;

/**
 * Build (or rebuild) today's digest for one user, store it, and send it as a DIGEST notification
 * (Telegram gets the full text; quiet hours apply). Empty days are stored but not sent.
 */
export async function generateDigest(
  userId: string,
  now = new Date(),
  opts: { send?: boolean } = {},
): Promise<{ id: string; sent: boolean; empty: boolean }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { locale: true, notificationPrefs: true },
  });
  const locale: Locale = user.locale === "en" ? "en" : "he";
  const prefs = toEffective(user.notificationPrefs);
  const day = dayKey(now);
  const last = await db.digest.findFirst({
    where: { userId, day: { not: day } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = digestWindowStart(last?.createdAt ?? null, now);
  const data = await collectDigestData(userId, prefs, day, since, now);
  const { suggestions, source } = await digestSuggestions(userId, data, locale);
  const summary = digestSummary(data, locale);
  const row = {
    summary,
    content: data as unknown as Prisma.InputJsonValue,
    suggestions: suggestions as unknown as Prisma.InputJsonValue,
    aiSource: source,
  };
  const digest = await db.digest.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, ...row },
    update: row,
    select: { id: true },
  });
  const empty = digestIsEmpty(data);
  if (empty || opts.send === false) return { id: digest.id, sent: false, empty };
  const s = reminderStrings(locale);
  const created = await notify(
    userId,
    {
      kind: "DIGEST",
      title: fill(s.dgTitle, { date: formatDay(day, locale) }),
      body: summary,
      url: `/digest/${digest.id}`,
      data: {
        digestId: digest.id,
        telegramHtml: digestTelegramHtml(data, suggestions, locale, `${siteUrl()}/digest/${digest.id}`),
      },
      dedupeKey: `digest:${day}`,
    },
    { now },
  );
  return { id: digest.id, sent: !!created, empty };
}

/** Hourly: generate today's digest for every user whose digest hour has passed and has none yet. */
export async function runDigests(now = new Date()): Promise<{ due: number; generated: number; sent: number }> {
  const day = dayKey(now);
  const { hour } = israelClock(now);
  // Users with something to report on: a tracked application, a saved search or learning activity.
  const users = await db.user.findMany({
    where: {
      OR: [{ applications: { some: {} } }, { savedSearches: { some: {} } }, { stageProgress: { some: {} } }],
      digests: { none: { day } },
    },
    select: { id: true, notificationPrefs: true },
    take: 1000,
  });
  const due = users.filter((u) => digestDue(toEffective(u.notificationPrefs), hour, false));
  let generated = 0;
  let sent = 0;
  for (const u of due.slice(0, MAX_PER_RUN)) {
    try {
      const r = await generateDigest(u.id, now);
      generated++;
      if (r.sent) sent++;
    } catch (e) {
      console.warn("[digest] failed for a user:", e instanceof Error ? e.message.slice(0, 200) : "error");
    }
  }
  return { due: due.length, generated, sent };
}
