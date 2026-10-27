import { loadKey } from "./crypto";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_CALLBACK_PATH = "/api/email/google/callback";

/** Feature flag: Gmail sync is only offered when OAuth credentials and the token key are configured. */
export function isGmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && loadKey(env.EMAIL_TOKEN_ENC_KEY));
}

/** Outlook (Microsoft Graph Mail.Read) is designed for but not implemented yet. */
export function isOutlookConfigured(): boolean {
  return false;
}

/** Redirect URI registered in Google Cloud Console. Override with GOOGLE_REDIRECT_URI if needed. */
export function googleRedirectUri(origin: string, env: NodeJS.ProcessEnv = process.env): string {
  return env.GOOGLE_REDIRECT_URI || new URL(GOOGLE_CALLBACK_PATH, origin).toString();
}

export function requestOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

/** Israel time for "last scan" etc. */
export const APP_TIME_ZONE = "Asia/Jerusalem";

export const OAUTH_COOKIE = "jh_gmail_oauth";
