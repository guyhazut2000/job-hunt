import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/format";
import { isActivityType, type ActivityType } from "./types";

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilters {
  user?: string;
  type?: ActivityType;
  /** YYYY-MM-DD, Israel time, inclusive. */
  from?: string;
  to?: string;
  page: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export function parseActivityFilters(sp: Record<string, string | string[] | undefined>): ActivityFilters {
  const user = one(sp.user)?.slice(0, 160);
  const type = one(sp.type);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = Math.min(1000, Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1));
  return {
    ...(user && { user }),
    ...(isActivityType(type) && { type }),
    ...(from && DAY.test(from) && { from }),
    ...(to && DAY.test(to) && { to }),
    page,
  };
}

/** Offset (ms) of Asia/Jerusalem from UTC at a given instant. */
function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC instant of 00:00 Israel time on a YYYY-MM-DD day. */
export function israelDayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y!, m! - 1, d!));
  return new Date(guess.getTime() - tzOffsetMs(guess));
}

/** Today's date (YYYY-MM-DD) in Israel time. */
export function israelToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

export function activityWhere(f: ActivityFilters): Prisma.ActivityEventWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (f.from) createdAt.gte = israelDayStart(f.from);
  if (f.to) createdAt.lt = new Date(israelDayStart(f.to).getTime() + 86_400_000);
  return {
    ...(f.type && { type: f.type }),
    ...(f.user && { OR: [{ userId: f.user }, { email: { contains: f.user.toLowerCase() } }] }),
    ...((f.from || f.to) && { createdAt }),
  };
}

export async function listActivity(f: ActivityFilters) {
  const where = activityWhere(f);
  const [rows, total] = await Promise.all([
    db.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        type: true,
        email: true,
        path: true,
        country: true,
        region: true,
        city: true,
        device: true,
        browser: true,
        os: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.activityEvent.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)) };
}

export type ActivityRow = Awaited<ReturnType<typeof listActivity>>["rows"][number];

export async function activitySummary(now = new Date()) {
  const todayStart = israelDayStart(israelToday(now));
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const distinctUsers = (since: Date) =>
    db.activityEvent
      .findMany({
        where: { createdAt: { gte: since }, userId: { not: null } },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((r) => r.length);
  const [activeToday, active7d, signInsToday, failedToday, topPages, users] = await Promise.all([
    distinctUsers(todayStart),
    distinctUsers(weekStart),
    db.activityEvent.count({ where: { type: "sign_in", createdAt: { gte: todayStart } } }),
    db.activityEvent.count({ where: { type: "sign_in_failed", createdAt: { gte: todayStart } } }),
    db.activityEvent.groupBy({
      by: ["path"],
      where: { type: "page_view", createdAt: { gte: weekStart }, path: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 5,
    }),
    db.activityEvent.findMany({
      where: { createdAt: { gte: weekStart }, email: { not: null } },
      distinct: ["email"],
      select: { email: true },
      orderBy: { email: "asc" },
      take: 50,
    }),
  ]);
  return {
    activeToday,
    active7d,
    signInsToday,
    failedToday,
    topPages: topPages.map((p) => ({ path: p.path ?? "", views: p._count._all })),
    recentEmails: users.map((u) => u.email!).filter(Boolean),
  };
}
