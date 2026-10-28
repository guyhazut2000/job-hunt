/** Which external channels are configured on this deployment. Never exposes secret values. */
export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:notifications@job-hunt.local";
  return { publicKey, privateKey, subject };
}

export const isPushConfigured = () => vapidConfig() !== null;

export function telegramToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export const isTelegramConfigured = () => telegramToken() !== null;

/** Bot username (without @) for the t.me deep link; optional. */
export function telegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || null;
}

/** Absolute site URL for links in Telegram messages. */
export function siteUrl(): string {
  const explicit = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod}`;
  return "http://localhost:3000";
}
