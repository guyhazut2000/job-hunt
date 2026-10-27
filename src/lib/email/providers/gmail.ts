import { isGmailConfigured } from "../config";
import { cleanText, type MailMessage } from "../parse";
import { buildGmailQuery } from "../patterns";
import { ProviderAuthError, type MailProvider, type SearchOptions } from "./types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const BODY_LIMIT = 4000;

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new ProviderAuthError(`gmail_${res.status}`);
  if (!res.ok) throw new Error(`gmail_http_${res.status}`);
  return (await res.json()) as T;
}

export async function exchangeGoogleCode(code: string, redirectUri: string, codeVerifier: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new ProviderAuthError(`token_exchange_${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; scope?: string };
}

export async function gmailProfileEmail(accessToken: string): Promise<string> {
  const p = await gmailGet<{ emailAddress: string }>(accessToken, "/profile");
  return p.emailAddress;
}

const header = (m: GmailMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

function decodeB64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function findPart(part: GmailPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decodeB64Url(part.body.data);
  for (const p of part.parts ?? []) {
    const hit = findPart(p, mime);
    if (hit) return hit;
  }
  return null;
}

export const gmailProvider: MailProvider = {
  id: "GMAIL",
  configured: () => isGmailConfigured(),

  async refreshAccessToken(refreshToken) {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    // invalid_grant = revoked, or expired (Testing-mode tokens expire after 7 days)
    if (res.status === 400 || res.status === 401) throw new ProviderAuthError("refresh_failed");
    if (!res.ok) throw new Error(`token_http_${res.status}`);
    return ((await res.json()) as { access_token: string }).access_token;
  },

  async search({ accessToken, lookbackDays, statusUpdates, max }: SearchOptions) {
    const q = buildGmailQuery(lookbackDays, { statusUpdates });
    const ids: { id: string; threadId?: string }[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)) });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await gmailGet<{ messages?: { id: string; threadId?: string }[]; nextPageToken?: string }>(
        accessToken,
        `/messages?${params}`,
      );
      ids.push(...(page.messages ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < max);

    const out: MailMessage[] = [];
    // Metadata only (From/Subject/Date + Gmail's snippet), a few in parallel.
    for (let i = 0; i < ids.length; i += 10) {
      const batch = await Promise.all(
        ids
          .slice(i, i + 10)
          .map((m) =>
            gmailGet<GmailMessage>(
              accessToken,
              `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            ),
          ),
      );
      for (const m of batch)
        out.push({
          id: m.id,
          threadId: m.threadId ?? null,
          from: header(m, "From"),
          subject: header(m, "Subject"),
          date: m.internalDate ? new Date(Number(m.internalDate)) : new Date(header(m, "Date") || Date.now()),
          snippet: cleanText(m.snippet ?? ""),
        });
    }
    return out;
  },

  async fetchBodyText(accessToken, messageId) {
    const m = await gmailGet<GmailMessage>(accessToken, `/messages/${messageId}?format=full`);
    const text = findPart(m.payload, "text/plain") ?? findPart(m.payload, "text/html");
    return text ? cleanText(text).slice(0, BODY_LIMIT) : null;
  },

  async revoke(refreshToken) {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    }).catch(() => undefined);
  },

  messageUrl: (id) => `https://mail.google.com/mail/u/0/#all/${id}`,
};
