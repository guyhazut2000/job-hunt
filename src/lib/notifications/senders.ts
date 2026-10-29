import webpush from "web-push";
import { siteUrl, telegramToken, vapidConfig } from "./config";

export interface OutgoingMessage {
  id: string;
  title: string;
  body?: string | null;
  /** In-app path; opened through /notifications/open/<id> so it is marked read. */
  url?: string | null;
  /** Full pre-rendered Telegram HTML (the daily digest); replaces title/body/link when set. */
  telegramHtml?: string;
}

export type SendResult = { ok: true } | { ok: false; error: string; permanent: boolean };

export const openPath = (id: string) => `/notifications/open/${id}`;

export interface PushTarget {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

export async function sendWebPush(target: PushTarget, msg: OutgoingMessage): Promise<SendResult> {
  const cfg = vapidConfig();
  if (!cfg) return { ok: false, error: "push not configured", permanent: false };
  if (!target.p256dh || !target.auth) return { ok: false, error: "subscription keys missing", permanent: true };
  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? "", url: openPath(msg.id), tag: msg.id });
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      payload,
      { vapidDetails: cfg, TTL: 60 * 60 * 24, urgency: "normal" },
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404/410: the subscription is gone (unsubscribed / expired) — drop the channel.
    return { ok: false, error: `push ${status ?? "error"}`, permanent: status === 404 || status === 410 };
  }
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function telegramText(msg: OutgoingMessage, base = siteUrl()): string {
  if (msg.telegramHtml) return msg.telegramHtml;
  const lines = [`<b>${escapeHtml(msg.title)}</b>`];
  if (msg.body) lines.push(escapeHtml(msg.body));
  if (msg.url) lines.push(`${base}${openPath(msg.id)}`);
  return lines.join("\n");
}

export async function telegramApi(
  method: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; description?: string }> {
  const token = telegramToken();
  if (!token) return { ok: false, status: 0, description: "telegram not configured" };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  return { ok: res.ok && json.ok !== false, status: res.status, description: json.description };
}

export async function sendTelegram(chatId: string, msg: OutgoingMessage): Promise<SendResult> {
  if (!telegramToken()) return { ok: false, error: "telegram not configured", permanent: false };
  try {
    const r = await telegramApi("sendMessage", {
      chat_id: chatId,
      text: telegramText(msg),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    if (r.ok) return { ok: true };
    // 403: the user blocked the bot; 400 "chat not found": chat gone.
    const permanent = r.status === 403 || (r.status === 400 && /chat not found/i.test(r.description ?? ""));
    return { ok: false, error: `telegram ${r.status}`, permanent };
  } catch {
    return { ok: false, error: "telegram network", permanent: false };
  }
}
