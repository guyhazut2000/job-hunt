import { NextResponse } from "next/server";
import { isTelegramConfigured } from "@/lib/notifications/config";
import { handleTelegramUpdate, validWebhookSecret, type TelegramUpdate } from "@/lib/notifications/telegram";

export const dynamic = "force-dynamic";

/** Telegram bot webhook (setWebhook with secret_token = TELEGRAM_WEBHOOK_SECRET). See docs/notifications.md. */
export async function POST(req: Request) {
  if (!isTelegramConfigured()) return NextResponse.json({ error: "not configured" }, { status: 404 });
  if (!validWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
  const result = await handleTelegramUpdate(update).catch(() => "error");
  // Always 200 so Telegram doesn't retry the same update forever.
  return NextResponse.json({ ok: true, result });
}
