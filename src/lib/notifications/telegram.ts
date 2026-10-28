import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { CHANNEL_TYPES } from "./kinds";
import { telegramApi } from "./senders";

export const hashLinkCode = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

/** Constant-time check of Telegram's X-Telegram-Bot-Api-Secret-Token header. */
export function validWebhookSecret(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface TelegramUpdate {
  message?: { chat?: { id?: number | string; type?: string }; text?: string; from?: { first_name?: string } };
}

/** "/start CODE" | "/start@bot CODE" → CODE */
export function parseStartCode(text: string | undefined): string | null {
  const m = /^\/start(?:@\w+)?\s+([A-Za-z0-9]{6,16})\s*$/.exec(text?.trim() ?? "");
  return m ? m[1].toUpperCase() : null;
}

const MSG = {
  linked: "✅ חובר! מעכשיו תקבל כאן התראות מ-job-hunt.\nConnected — you'll get job-hunt alerts here.",
  bad: "הקוד לא תקין או שפג תוקפו. צור קוד חדש בהגדרות ההתראות באתר.\nInvalid or expired code — create a new one in notification settings.",
  hello:
    "שלום! כדי לחבר, פתח באתר: הגדרות התראות ← חבר טלגרם.\nHi! To connect, open Notification settings → Connect Telegram on the site.",
  stopped: "🔕 נותקת. לא תקבל יותר התראות כאן.\nDisconnected — no more alerts here.",
};

/** Handle one webhook update. Returns what happened (for tests / logs); never throws on bad input. */
export async function handleTelegramUpdate(update: TelegramUpdate, now = new Date()): Promise<string> {
  const chatId = update.message?.chat?.id;
  if (chatId === undefined || update.message?.chat?.type !== "private") return "ignored";
  const chat = String(chatId);
  const text = update.message?.text?.trim() ?? "";
  const reply = (t: string) => telegramApi("sendMessage", { chat_id: chat, text: t }).catch(() => undefined);

  if (/^\/stop\b/.test(text)) {
    await db.notificationChannel.deleteMany({ where: { type: CHANNEL_TYPES.telegram, endpoint: chat } });
    await reply(MSG.stopped);
    return "stopped";
  }
  const code = parseStartCode(text);
  if (!code) {
    await reply(MSG.hello);
    return "hello";
  }
  const prefs = await db.notificationPreference.findUnique({ where: { telegramLinkCode: hashLinkCode(code) } });
  if (!prefs || !prefs.telegramLinkExpires || prefs.telegramLinkExpires < now) {
    await reply(MSG.bad);
    return "bad-code";
  }
  await db.$transaction([
    db.notificationChannel.upsert({
      where: { type_endpoint: { type: CHANNEL_TYPES.telegram, endpoint: chat } },
      create: {
        userId: prefs.userId,
        type: CHANNEL_TYPES.telegram,
        endpoint: chat,
        label: update.message?.from?.first_name?.slice(0, 80),
      },
      update: { userId: prefs.userId, failures: 0 },
    }),
    db.notificationPreference.update({
      where: { id: prefs.id },
      data: { telegramLinkCode: null, telegramLinkExpires: null },
    }),
  ]);
  await reply(MSG.linked);
  return "linked";
}
