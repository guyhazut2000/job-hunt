"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { notificationStrings } from "@/lib/i18n/notifications";
import { hashLinkCode } from "@/lib/notifications/telegram";
import { processDeliveries } from "@/lib/notifications/deliver";
import { isPushConfigured, isTelegramConfigured, telegramBotUsername } from "@/lib/notifications/config";
import {
  CHANNEL_TYPES,
  EXTERNAL_CHANNELS,
  INSTANT_ONLY,
  NOTIFICATION_KINDS,
  type ChannelOverrides,
  type ModeOverrides,
} from "@/lib/notifications/kinds";
import {
  defaultSearchName,
  MAX_SAVED_SEARCHES,
  normalizeSearchQuery,
  parseStoredQuery,
} from "@/lib/notifications/saved-search";
import { activeFilterCount } from "@/lib/jobs/filters";
import { MAX_FOLLOWED_COMPANIES } from "@/lib/notifications/company-follow";
import { cleanWeekdays } from "@/lib/notifications/prefs";
import { requireUser } from "@/lib/session";

const revalidate = () => {
  revalidatePath("/notifications");
  revalidatePath("/settings/notifications");
};

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidate();
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidate();
}

export type PrefsFormState = { ok?: boolean; error?: string } | undefined;

const prefsSchema = z.object({
  quietStart: z.coerce.number().int().min(0).max(23),
  quietEnd: z.coerce.number().int().min(0).max(23),
  followUpDays: z.coerce.number().int().min(1).max(60),
  maxPerHour: z.coerce.number().int().min(1).max(30),
  learningHour: z.coerce.number().int().min(0).max(23),
  learningIdleDays: z.coerce.number().int().min(1).max(30),
  digestHour: z.coerce.number().int().min(0).max(23),
});

export async function saveNotificationPrefs(_: PrefsFormState, formData: FormData): Promise<PrefsFormState> {
  const user = await requireUser();
  const parsed = prefsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const on = (k: string) => formData.get(k) === "on";
  const channels: ChannelOverrides = {};
  for (const kind of NOTIFICATION_KINDS) {
    channels[kind] = Object.fromEntries(EXTERNAL_CHANNELS.map((ch) => [ch, on(`ch.${kind}.${ch}`)]));
  }
  const modes: ModeOverrides = {};
  for (const kind of NOTIFICATION_KINDS) {
    if (!INSTANT_ONLY.includes(kind) && formData.get(`mode.${kind}`) === "digest") modes[kind] = "digest";
  }
  const data = {
    ...parsed.data,
    quietEnabled: on("quietEnabled"),
    quietShabbat: on("quietShabbat"),
    followUpEnabled: on("followUpEnabled"),
    learningEnabled: on("learningEnabled"),
    learningDays: cleanWeekdays(formData.getAll("learningDays")),
    interviewEnabled: on("interviewEnabled"),
    digestEnabled: on("digestEnabled"),
    channels,
    modes,
  };
  await db.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  revalidate();
  return { ok: true };
}

export type SaveSearchState = { ok?: boolean; error?: string } | undefined;

export async function createSavedSearch(_: SaveSearchState, formData: FormData): Promise<SaveSearchState> {
  const user = await requireUser();
  const query = normalizeSearchQuery(String(formData.get("query") ?? "").slice(0, 2000));
  const filters = parseStoredQuery(query);
  if (!activeFilterCount(filters)) return { error: "empty" };
  const count = await db.savedSearch.count({ where: { userId: user.id } });
  if (count >= MAX_SAVED_SEARCHES) return { error: "limit" };
  const s = notificationStrings(await getLocale());
  const name =
    String(formData.get("name") ?? "")
      .trim()
      .slice(0, 80) || defaultSearchName(filters, s.allJobs);
  const existing = await db.savedSearch.findFirst({ where: { userId: user.id, query } });
  if (existing) {
    await db.savedSearch.update({ where: { id: existing.id }, data: { name, active: true } });
  } else {
    await db.savedSearch.create({ data: { userId: user.id, name, query } });
  }
  revalidate();
  revalidatePath("/jobs");
  return { ok: true };
}

export async function toggleSavedSearch(id: string) {
  const user = await requireUser();
  const s = await db.savedSearch.findFirst({ where: { id, userId: user.id } });
  if (!s) return;
  // Resuming starts from now, so a paused search doesn't flood with everything it missed.
  await db.savedSearch.update({
    where: { id },
    data: { active: !s.active, ...(s.active ? {} : { lastCheckedAt: new Date() }) },
  });
  revalidate();
}

export async function deleteSavedSearch(id: string) {
  const user = await requireUser();
  await db.savedSearch.deleteMany({ where: { id, userId: user.id } });
  revalidate();
}

const pushSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export async function savePushSubscription(sub: unknown, label?: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isPushConfigured()) return { ok: false };
  const parsed = pushSchema.safeParse(sub);
  if (!parsed.success) return { ok: false };
  const { endpoint, keys } = parsed.data;
  const data = { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, label: label?.slice(0, 80), failures: 0 };
  await db.notificationChannel.upsert({
    where: { type_endpoint: { type: CHANNEL_TYPES.push, endpoint } },
    create: { type: CHANNEL_TYPES.push, endpoint, ...data },
    update: data,
  });
  revalidate();
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db.notificationChannel.deleteMany({ where: { userId: user.id, type: CHANNEL_TYPES.push, endpoint } });
  revalidate();
}

/** In-site + immediate push/Telegram test (ignores quiet hours and per-kind settings on purpose). */
export async function sendTestNotification(): Promise<{ ok: boolean; sent: number }> {
  const user = await requireUser();
  const s = notificationStrings(await getLocale());
  const now = new Date();
  const n = await db.notification.create({
    data: { userId: user.id, kind: "SYSTEM", title: s.testTitle, body: s.testBody, url: "/notifications" },
  });
  const channels = await db.notificationChannel.findMany({ where: { userId: user.id }, select: { id: true } });
  if (channels.length) {
    await db.notificationDelivery.createMany({
      data: channels.map((c) => ({ notificationId: n.id, channelId: c.id, nextAttemptAt: now })),
      skipDuplicates: true,
    });
  }
  const r = await processDeliveries({ now, userId: user.id, ignoreQuiet: true, limit: 20 });
  revalidate();
  return { ok: true, sent: r.sent };
}

export async function createTelegramLink(): Promise<{ code: string; link: string | null } | { error: string }> {
  const user = await requireUser();
  if (!isTelegramConfigured()) return { error: "not_configured" };
  // 8 chars from an unambiguous alphabet; only the hash is stored.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");
  const hashed = hashLinkCode(code);
  const expires = new Date(Date.now() + 15 * 60_000);
  await db.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, telegramLinkCode: hashed, telegramLinkExpires: expires },
    update: { telegramLinkCode: hashed, telegramLinkExpires: expires },
  });
  const bot = telegramBotUsername();
  return { code, link: bot ? `https://t.me/${bot}?start=${code}` : null };
}

export async function disconnectTelegram() {
  const user = await requireUser();
  await db.notificationChannel.deleteMany({ where: { userId: user.id, type: CHANNEL_TYPES.telegram } });
  revalidate();
}

// ── follow company (COMPANY_JOBS / SCAN_FAILED alerts) ──

export type FollowState = { following: boolean; error?: "limit" | "not_found" };

/** Follow / unfollow a company. Following starts now: only jobs published after this are alerted. */
export async function setCompanyFollow(companyId: string, follow: boolean): Promise<FollowState> {
  const user = await requireUser();
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, slug: true } });
  if (!company) return { following: false, error: "not_found" };
  if (follow) {
    const existing = await db.companyFollow.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
      select: { id: true },
    });
    if (!existing) {
      if ((await db.companyFollow.count({ where: { userId: user.id } })) >= MAX_FOLLOWED_COMPANIES)
        return { following: false, error: "limit" };
      await db.companyFollow.create({ data: { userId: user.id, companyId } }).catch((e: unknown) => {
        // Double click: the unique key already holds it.
        if (!(e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002")) throw e;
      });
    }
  } else {
    await db.companyFollow.deleteMany({ where: { userId: user.id, companyId } });
  }
  revalidate();
  revalidatePath(`/companies/${company.slug}`);
  return { following: follow };
}

/** Unfollow from the settings list (form action). */
export async function unfollowCompany(companyId: string) {
  await setCompanyFollow(companyId, false);
}
