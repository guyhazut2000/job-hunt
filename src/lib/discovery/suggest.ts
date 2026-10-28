import { domainOf, originOf } from "./domain";

/** `StartupCandidate.source` of companies suggested by users from /companies. */
export const USER_SOURCE = "USER";
/** Checked before bulk-imported candidates (TechMap etc. use 0–40). */
export const USER_PRIORITY = 60;
/** Suggestions per user per 24h. */
export const SUGGEST_DAILY_LIMIT = 5;

export type Suggestion = { name: string; website: string; domain: string };

/**
 * Validate a "suggest a company" submission: a name plus the company's own site. LinkedIn, Google,
 * social networks and non-http(s) links are rejected — discovery only ever reads the company's own site.
 */
export function parseSuggestion(rawName: unknown, rawUrl: unknown): Suggestion | null {
  const name = String(rawName ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const url = String(rawUrl ?? "").trim();
  if (name.length < 2 || name.length > 100 || !url || url.length > 500) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) return null;
  const domain = domainOf(url);
  const website = originOf(url);
  if (!domain || !website) return null;
  return { name, website, domain };
}

/** Marker stored in `sourceUrl` so suggestions can be rate-limited per user. */
export const suggestedBy = (userId: string) => `user:${userId}`;
