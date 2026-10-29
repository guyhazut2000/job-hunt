import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { manualCheckStrings } from "@/lib/i18n/manual-check";
import { fill } from "@/lib/i18n/notifications";
import { notify } from "@/lib/notifications/create";
import { MANUAL_COMPANIES } from "./manual";
import { ESTABLISHED_MANUAL } from "./established";

/**
 * Weekly "manual check" nudge (docs/sources.md#manual-check): companies we can't sync (no public
 * feed, or the careers site blocks bots) are listed once a week in the bell — and on Telegram when
 * the user enabled it for the digest — so they still get checked by hand. It only calls `notify()`
 * (kind DIGEST, so it follows the digest's channel settings and quiet hours); the hourly send queue
 * delivers it. One per user per ISO week (dedupe key).
 */

export interface ManualCompanyRef {
  slug: string;
  name: string;
}

/** Names shown before "+N more". */
export const MAX_LISTED = 8;
export const MANUAL_CHECK_URL = "/companies?sync=manual";

/** Core manual companies (big employers whose sites block bots) are listed first after the user's own. */
const ESTABLISHED = new Set(ESTABLISHED_MANUAL.map((c) => c.slug));
export const CORE_MANUAL_SLUGS: string[] = MANUAL_COMPANIES.filter((c) => !ESTABLISHED.has(c.slug)).map((c) => c.slug);

/** ISO-8601 week key, e.g. "2026-W44" (weeks start on Monday, in UTC). */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Pure planner: which manual companies to name for one user, theirs first (companies they applied
 * to or saved), then the core list. Returns null when nothing is manual.
 */
export function planManualCheck(
  manual: ManualCompanyRef[],
  userCompanies: { slugs: Set<string>; names: Set<string> },
  locale: Locale,
  coreOrder: string[] = CORE_MANUAL_SLUGS,
): { title: string; body: string; url: string; yours: string[] } | null {
  if (!manual.length) return null;
  const s = manualCheckStrings(locale);
  const isYours = (c: ManualCompanyRef) => userCompanies.slugs.has(c.slug) || userCompanies.names.has(norm(c.name));
  const rank = new Map(coreOrder.map((slug, i) => [slug, i]));
  const yours = manual.filter(isYours).sort((a, b) => a.name.localeCompare(b.name));
  const others = manual
    .filter((c) => !isYours(c) && rank.has(c.slug))
    .sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  const shownYours = yours.slice(0, MAX_LISTED);
  const shownOthers = others.slice(0, Math.max(0, MAX_LISTED - shownYours.length));
  const rest = manual.length - shownYours.length - shownOthers.length;
  const lines: string[] = [];
  if (shownYours.length) lines.push(fill(s.bodyYours, { list: shownYours.map((c) => c.name).join(", ") }));
  if (shownOthers.length || rest > 0) {
    const names = shownOthers.map((c) => c.name);
    if (rest > 0) names.push(fill(s.more, { n: rest }));
    lines.push(fill(s.bodyOthers, { list: names.join(", ") }));
  }
  lines.push(s.tail);
  return {
    title: fill(s.title, { n: manual.length }),
    body: lines.join("\n"),
    url: MANUAL_CHECK_URL,
    yours: yours.map((c) => c.slug),
  };
}

const localeOf = (l: string | null | undefined): Locale => (l === "en" ? "en" : "he");

/** Weekly runner (cron): one reminder per active user — anyone with an application or a channel. */
export async function runManualCheckReminders(
  now = new Date(),
): Promise<{ users: number; sent: number; manual: number }> {
  const manual = await db.company.findMany({
    where: { OR: [{ syncMode: "MANUAL" }, { atsProvider: "MANUAL" }, { atsBoardId: null }] },
    select: { slug: true, name: true },
  });
  if (!manual.length) return { users: 0, sent: 0, manual: 0 };
  const users = await db.user.findMany({
    where: { OR: [{ applications: { some: {} } }, { notificationChannels: { some: {} } }] },
    select: {
      id: true,
      locale: true,
      applications: { select: { company: true, job: { select: { company: { select: { slug: true } } } } }, take: 500 },
    },
    take: 1000,
  });
  const week = isoWeekKey(now);
  let sent = 0;
  for (const u of users) {
    const slugs = new Set(u.applications.flatMap((a) => (a.job ? [a.job.company.slug] : [])));
    const names = new Set(u.applications.map((a) => norm(a.company)));
    const plan = planManualCheck(manual, { slugs, names }, localeOf(u.locale));
    if (!plan) continue;
    const created = await notify(
      u.id,
      {
        kind: "DIGEST",
        title: plan.title,
        body: plan.body,
        url: plan.url,
        data: { manualCheck: week, yours: plan.yours },
        dedupeKey: `manual-check:${week}`,
      },
      { now },
    );
    if (created) sent++;
  }
  return { users: users.length, sent, manual: manual.length };
}
