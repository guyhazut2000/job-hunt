import { db } from "@/lib/db";
import { CHANNEL_TYPES } from "./kinds";
import { toEffective } from "./prefs";
import { isQuiet, nextAllowedAt } from "./quiet";
import { sendTelegram, sendWebPush, type SendResult } from "./senders";

export const MAX_ATTEMPTS = 5;

/** Exponential backoff after a failed attempt: 5 min, 10, 20, 40… */
export function backoffMs(attempts: number): number {
  return 5 * 60_000 * 2 ** Math.max(0, attempts - 1);
}

export interface DeliverySummary {
  sent: number;
  failed: number;
  deferred: number;
  skipped: number;
  removedChannels: number;
}

/**
 * Process due rows of the delivery queue. Quiet hours are re-checked at send time (settings may have
 * changed), the per-user hourly cap turns extra messages into in-site only, and failures retry with
 * backoff until MAX_ATTEMPTS. Dead push subscriptions / blocked Telegram chats are removed.
 */
export async function processDeliveries(
  opts: { now?: Date; limit?: number; userId?: string; ignoreQuiet?: boolean } = {},
): Promise<DeliverySummary> {
  const now = opts.now ?? new Date();
  const summary: DeliverySummary = { sent: 0, failed: 0, deferred: 0, skipped: 0, removedChannels: 0 };
  const due = await db.notificationDelivery.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      ...(opts.userId ? { notification: { userId: opts.userId } } : {}),
    },
    orderBy: { nextAttemptAt: "asc" },
    take: opts.limit ?? 200,
    include: {
      channel: true,
      notification: { select: { id: true, userId: true, title: true, body: true, url: true, createdAt: true } },
    },
  });
  if (!due.length) return summary;
  const userIds = [...new Set(due.map((d) => d.notification.userId))];
  const prefsRows = await db.notificationPreference.findMany({ where: { userId: { in: userIds } } });
  const prefsBy = new Map(prefsRows.map((p) => [p.userId, toEffective(p)]));
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const sentCounts = new Map<string, number>();
  for (const uid of userIds) {
    sentCounts.set(
      uid,
      await db.notificationDelivery.count({
        where: { status: "SENT", sentAt: { gte: hourAgo }, notification: { userId: uid } },
      }),
    );
  }
  const removed = new Set<string>();

  for (const d of due) {
    if (removed.has(d.channelId)) continue;
    const uid = d.notification.userId;
    const prefs = prefsBy.get(uid) ?? toEffective(null);
    if (!opts.ignoreQuiet && isQuiet(prefs, now)) {
      await db.notificationDelivery.update({ where: { id: d.id }, data: { nextAttemptAt: nextAllowedAt(prefs, now) } });
      summary.deferred++;
      continue;
    }
    // Stale (> 2 days) or over the hourly cap: keep it in-site only.
    const stale = now.getTime() - d.notification.createdAt.getTime() > 2 * 86_400_000;
    if (stale || (sentCounts.get(uid) ?? 0) >= prefs.maxPerHour) {
      await db.notificationDelivery.update({
        where: { id: d.id },
        data: { status: "SKIPPED", lastError: stale ? "stale" : "rate limit" },
      });
      summary.skipped++;
      continue;
    }
    const msg = d.notification;
    let res: SendResult;
    if (d.channel.type === CHANNEL_TYPES.push) res = await sendWebPush(d.channel, msg);
    else if (d.channel.type === CHANNEL_TYPES.telegram) res = await sendTelegram(d.channel.endpoint, msg);
    else res = { ok: false, error: "unknown channel", permanent: true };

    if (res.ok) {
      await db.$transaction([
        db.notificationDelivery.update({
          where: { id: d.id },
          data: { status: "SENT", sentAt: now, attempts: { increment: 1 }, lastError: null },
        }),
        db.notificationChannel.update({ where: { id: d.channelId }, data: { lastUsedAt: now, failures: 0 } }),
      ]);
      sentCounts.set(uid, (sentCounts.get(uid) ?? 0) + 1);
      summary.sent++;
      continue;
    }
    if (res.permanent) {
      await db.notificationChannel.delete({ where: { id: d.channelId } }).catch(() => undefined);
      removed.add(d.channelId);
      summary.removedChannels++;
      summary.failed++;
      continue;
    }
    const attempts = d.attempts + 1;
    await db.notificationDelivery.update({
      where: { id: d.id },
      data: {
        attempts,
        lastError: res.error.slice(0, 200),
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
      },
    });
    await db.notificationChannel.update({ where: { id: d.channelId }, data: { failures: { increment: 1 } } });
    summary.failed++;
  }
  return summary;
}
