import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { channelEnabled, channelOfType, type NotificationKind } from "./kinds";
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

/**
 * Create an in-site notification and queue it for the user's push / Telegram channels (respecting
 * per-kind settings and quiet hours). Returns null when it was a duplicate.
 */
export async function notify(
  userId: string,
  n: NewNotification,
  opts: { now?: Date; ignoreQuiet?: boolean } = {},
): Promise<{ id: string } | null> {
  const now = opts.now ?? new Date();
  let created: { id: string };
  try {
    created = await db.notification.create({
      data: {
        userId,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 1000),
        url: n.url,
        data: n.data,
        dedupeKey: n.dedupeKey,
        createdAt: now,
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
  const [prefs, channels] = await Promise.all([
    getPrefs(userId),
    db.notificationChannel.findMany({ where: { userId }, select: { id: true, type: true } }),
  ]);
  const at = opts.ignoreQuiet ? now : nextAllowedAt(prefs, now);
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
