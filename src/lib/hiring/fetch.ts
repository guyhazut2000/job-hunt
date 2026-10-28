/**
 * Polite fetcher for public, company-owned pages (docs/hiring-process.md): identifies itself, honours
 * robots.txt, never touches login-walled or third-party review sites (LinkedIn, Glassdoor, Indeed…),
 * caps size and time, and converts HTML to plain text for extraction.
 */
import { isAllowedByRobots } from "@/lib/discovery/robots";
import { paceHost, USER_AGENT } from "@/lib/ingestion/http";

/** Hosts we never fetch: social networks, review sites, search engines, anything behind a login. */
const BLOCKED_HOST =
  /(^|\.)(linkedin\.com|lnkd\.in|glassdoor\.[a-z.]+|indeed\.[a-z.]+|comparably\.com|teamblind\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|reddit\.com|quora\.com|medium\.com|google\.[a-z.]+|bing\.com|duckduckgo\.com)$/i;
/** Paths that usually mean a login / application form rather than public content. */
const BLOCKED_PATH = /\/(login|signin|sign-in|signup|sign-up|account|auth|apply)(\/|$|\?)/i;

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 12_000;

export function isBlockedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return true;
    return BLOCKED_HOST.test(u.hostname) || BLOCKED_PATH.test(u.pathname);
  } catch {
    return true;
  }
}

export type FetchResult =
  | { ok: true; url: string; title: string; text: string; links: { href: string; text: string }[] }
  | { ok: false; url: string; reason: "blocked" | "robots" | "http" | "error" | "not_html" };

export interface FetchDeps {
  fetchImpl?: typeof fetch;
  /** Cache of robots.txt bodies per origin (null = none / unreachable). */
  robotsCache?: Map<string, string | null>;
  minIntervalMs?: number;
}

async function robotsFor(origin: string, deps: FetchDeps): Promise<string | null> {
  const cache = deps.robotsCache;
  if (cache?.has(origin)) return cache.get(origin) ?? null;
  let body: string | null = null;
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${origin}/robots.txt`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    body = res.ok ? (await res.text()).slice(0, 200_000) : null;
  } catch {
    body = null;
  }
  cache?.set(origin, body);
  return body;
}

export async function fetchPublicPage(url: string, deps: FetchDeps = {}): Promise<FetchResult> {
  if (isBlockedUrl(url)) return { ok: false, url, reason: "blocked" };
  const u = new URL(url);
  const robots = await robotsFor(u.origin, deps);
  if (!isAllowedByRobots(robots, u.pathname + u.search)) return { ok: false, url, reason: "robots" };
  await paceHost(u.host, deps.minIntervalMs ?? 1_000);
  try {
    const res = await (deps.fetchImpl ?? fetch)(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const finalUrl = res.url || url;
    if (isBlockedUrl(finalUrl)) return { ok: false, url, reason: "blocked" };
    if (!res.ok) return { ok: false, url, reason: "http" };
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) return { ok: false, url, reason: "not_html" };
    const html = (await res.text()).slice(0, MAX_BYTES);
    return {
      ok: true,
      url: finalUrl,
      title: pageTitle(html),
      text: htmlToText(html),
      links: pageLinks(html, finalUrl),
    };
  } catch {
    return { ok: false, url, reason: "error" };
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function pageTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

/** Readable text: drops scripts/styles/nav chrome, keeps block structure as line breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|section|article|li|ul|ol|h[1-6]|tr|table|header|main|blockquote|dd|dt)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageLinks(html: string, base: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html)) && out.length < 600;) {
    try {
      const href = new URL(decodeEntities(m[1]), base).toString();
      out.push({
        href,
        text: decodeEntities(m[2].replace(/<[^>]+>/g, " "))
          .replace(/\s+/g, " ")
          .trim(),
      });
    } catch {
      /* ignore bad hrefs */
    }
  }
  return out;
}
