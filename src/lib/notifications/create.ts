import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { channelEnabled, channelOfType, deliveryMode, type NotificationKind } from "./kinds";
import { getPrefs } from "./prefs";
import { nextAllowedAt } from "./quiet";

export interface NewNotification {
  kind: NotificationKind;
  title: string;
  body?: string;
  url?: string;
  data?: Prisma.InputJsonValue;
  /** Same key for the same user twice = one notification. */
  dedupeKey?: string;
}

/** Marker in Notification.data for messages held for the daily digest instead of push/Telegram. */
export const HELD_FOR_DIGEST = "digest";

/**
 * Create an in-site notification and queue it for the user's push / Telegram channels (respecting
 * per-kind channels, instant/digest mode and quiet hours). Kinds set to "digest" get no send rows —
 * they are marked `data.delivery = "digest"` and listed in the next daily digest. Returns null when
 * it was a duplicate.
 */
export async function notify(
  userId: string,
  n: NewNotification,
  opts: {
    now?: Date;
    ignoreQuiet?: boolean;
    /**
     * Push/Telegram are pointless after this moment (e.g. the interview itself). If quiet hours
     * would hold the message past it, it stays in-site only; the send queue also drops it then.
     */
    expiresAt?: Date;
  } = {},
): Promise<{ id: string } | null> {
  const now = opts.now ?? new Date();
  const [prefs, channels] = await Promise.all([
    getPrefs(userId),
    db.notificationChannel.findMany({ where: { userId }, select: { id: true, type: true } }),
  ]);
  const held = deliveryMode(prefs.modes, n.kind) === "digest";
  const base = n.data && typeof n.data === "object" && !Array.isArray(n.data) ? n.data : undefined;
  const extra = {
    ...(opts.expiresAt ? { expiresAt: opts.expiresAt.toISOString() } : {}),
    ...(held ? { delivery: HELD_FOR_DIGEST } : {}),
  };
  const data = Object.keys(extra).length ? ({ ...(base ?? {}), ...extra } as Prisma.InputJsonValue) : n.data;
  let created: { id: string };
  try {
    created = await db.notification.create({
      data: {
        userId,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 1000),
        url: n.url,
        data,
        dedupeKey: n.dedupeKey,
        createdAt: now,
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
  if (held) return created;
  const at = opts.ignoreQuiet ? now : nextAllowedAt(prefs, now);
  if (opts.expiresAt && at >= opts.expiresAt) return created;
  const rows = channels
    .filter((c) => {
      const ch = channelOfType(c.type);
      return ch && channelEnabled(prefs.overrides, n.kind, ch);
    })
    .map((c) => ({ notificationId: created.id, channelId: c.id, nextAttemptAt: at }));
  if (rows.length) await db.notificationDelivery.createMany({ data: rows, skipDuplicates: true });
  return created;
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/**
 * `userId|dedupeKey` pairs that already have a notification, so a runner that re-checks the same window
 * on every cron can skip them instead of hitting (and logging) the unique constraint.
 */
export async function sentDedupeKeys(keys: string[]): Promise<Set<string>> {
  const uniq = [...new Set(keys)];
  if (!uniq.length) return new Set();
  const rows = await db.notification.findMany({
    where: { dedupeKey: { in: uniq } },
    select: { userId: true, dedupeKey: true },
  });
  return new Set(rows.map((r) => `${r.userId}|${r.dedupeKey}`));
}
