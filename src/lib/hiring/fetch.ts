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

export type FetchFailure =
  /** Never fetched: third-party/login host or path. */
  | "blocked"
  /** robots.txt disallows our user agent. */
  | "robots"
  /** 401/403/429/503 or an anti-bot challenge page — respected, never circumvented. */
  | "bot_wall"
  /** 404 / 410. */
  | "not_found"
  /** Any other non-2xx status. */
  | "http"
  /** DNS / TLS / connection reset / timeout (after one retry). */
  | "error"
  | "not_html";

export type FetchResult =
  | {
      ok: true;
      url: string;
      title: string;
      text: string;
      links: { href: string; text: string }[];
      /** URLs found in the raw HTML outside <a> tags (JSON data attributes, embedded router data). */
      rawLinks: string[];
      /** The HTML had almost no readable text (client-rendered app shell). */
      jsShell: boolean;
    }
  | { ok: false; url: string; reason: FetchFailure; status?: number };

export interface FetchDeps {
  fetchImpl?: typeof fetch;
  /** Cache of robots.txt bodies per origin (null = none / unreachable). */
  robotsCache?: Map<string, string | null>;
  minIntervalMs?: number;
  /**
   * Consecutive network failures (timeouts / resets) per host, shared across a run. Some sites silently
   * tarpit non-browser clients (e.g. www.hpe.com hangs every request until the timeout); once a host has
   * failed `HOST_FAILURE_LIMIT` times in a row we stop sending it requests instead of waiting out every
   * timeout. We never try to get around such a wall (no browser user agent, no proxies).
   */
  hostFailures?: Map<string, number>;
}

/** After this many consecutive network failures a host is skipped for the rest of the run. */
export const HOST_FAILURE_LIMIT = 2;

function noteHost(deps: FetchDeps, host: string, failed: boolean) {
  const m = deps.hostFailures;
  if (!m) return;
  if (failed) m.set(host, (m.get(host) ?? 0) + 1);
  else m.delete(host);
}

/** True when the host has stopped answering during this run (see `FetchDeps.hostFailures`). */
export function isHostDown(deps: FetchDeps, url: string): boolean {
  try {
    return (deps.hostFailures?.get(new URL(url).host) ?? 0) >= HOST_FAILURE_LIMIT;
  } catch {
    return false;
  }
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
    noteHost(deps, new URL(origin).host, false);
  } catch {
    body = null;
    noteHost(deps, new URL(origin).host, true);
  }
  cache?.set(origin, body);
  return body;
}

/** Anti-bot interstitials (Cloudflare, Akamai, PerimeterX, Imperva…). We stop there; never bypass. */
const CHALLENGE_RE =
  /<title>\s*(just a moment|attention required|access denied|pardon our interruption|are you a robot)|cf-chl-|challenge-platform|_incapsula_resource|px-captcha|captcha-delivery\.com/i;

/** robots.txt body from the shared cache (null = none / unreachable / not fetched yet). */
export function cachedRobots(origin: string, deps: FetchDeps): string | null {
  return deps.robotsCache?.get(origin) ?? null;
}

/** robots.txt `Sitemap:` lines. */
export function robotsSitemaps(robots: string | null): string[] {
  if (!robots) return [];
  return [...robots.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 5);
}

async function getOnce(url: string, accept: string, deps: FetchDeps): Promise<Response> {
  return (deps.fetchImpl ?? fetch)(url, {
    headers: { "user-agent": USER_AGENT, accept, "accept-language": "en,he;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Robots-checked GET with one retry on network errors/timeouts (a slow 400 KB careers page used to
 * fail once and the company was marked "no info"). Returns the raw body for HTML/XML/text responses.
 */
export async function politeGet(
  url: string,
  deps: FetchDeps,
  accept = "text/html,application/xhtml+xml",
): Promise<
  { ok: true; url: string; body: string } | { ok: false; url: string; reason: FetchFailure; status?: number }
> {
  if (isBlockedUrl(url)) return { ok: false, url, reason: "blocked" };
  const u = new URL(url);
  if (isHostDown(deps, url)) return { ok: false, url, reason: "error" };
  const robots = await robotsFor(u.origin, deps);
  if (!isAllowedByRobots(robots, u.pathname + u.search)) return { ok: false, url, reason: "robots" };
  if (isHostDown(deps, url)) return { ok: false, url, reason: "error" };
  // A host that already failed once this run gets a single attempt (no retry).
  const attempts = (deps.hostFailures?.get(u.host) ?? 0) > 0 ? 1 : 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await paceHost(u.host, deps.minIntervalMs ?? 1_000);
    try {
      const res = await getOnce(url, accept, deps);
      noteHost(deps, u.host, false);
      const finalUrl = res.url || url;
      if (isBlockedUrl(finalUrl)) return { ok: false, url, reason: "blocked" };
      if (!res.ok) {
        const s = res.status;
        const reason: FetchFailure =
          s === 401 || s === 403 || s === 429 || s === 503 ? "bot_wall" : s === 404 || s === 410 ? "not_found" : "http";
        return { ok: false, url, reason, status: s };
      }
      const type = res.headers.get("content-type") ?? "";
      if (type && !/html|xml|text\/plain/i.test(type)) return { ok: false, url, reason: "not_html" };
      const body = (await res.text()).slice(0, MAX_BYTES);
      if (CHALLENGE_RE.test(body.slice(0, 20_000)) && htmlToText(body).length < 1_500) {
        return { ok: false, url, reason: "bot_wall", status: res.status };
      }
      return { ok: true, url: finalUrl, body };
    } catch {
      if (attempt === attempts - 1) {
        noteHost(deps, u.host, true);
        return { ok: false, url, reason: "error" };
      }
    }
  }
  return { ok: false, url, reason: "error" };
}

/** Pages with less readable text than this are treated as client-rendered shells. */
export const JS_SHELL_CHARS = 300;

export async function fetchPublicPage(url: string, deps: FetchDeps = {}): Promise<FetchResult> {
  const got = await politeGet(url, deps);
  if (!got.ok) return got;
  const html = got.body;
  let text = htmlToText(html);
  const jsShell = text.length < JS_SHELL_CHARS;
  if (text.length < 1_500) {
    // Client-rendered pages often ship their content as JSON (Next.js __NEXT_DATA__, ld+json).
    const embedded = embeddedText(html);
    if (embedded.length > text.length) text = `${text}\n${embedded}`.trim();
  }
  return {
    ok: true,
    url: got.url,
    title: pageTitle(html),
    text,
    links: pageLinks(html, got.url),
    rawLinks: rawLinks(html, got.url),
    jsShell: jsShell && text.length < JS_SHELL_CHARS,
  };
}

/** Human-readable strings inside embedded JSON (__NEXT_DATA__, application/ld+json, Nuxt state). */
export function embeddedText(html: string, maxChars = 60_000): string {
  const out: string[] = [];
  let total = 0;
  const walk = (v: unknown, depth: number) => {
    if (total >= maxChars || depth > 40) return;
    if (typeof v === "string") {
      const t = htmlToText(v).replace(/\s+/g, " ").trim();
      if (t.length >= 25 && /\s/.test(t) && !/^(https?:|\/|[{[])/.test(t)) {
        out.push(t);
        total += t.length;
      }
    } else if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, depth + 1);
  };
  const re =
    /<script\b[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/(?:ld\+)?json["'])[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)) && total < maxChars;) {
    try {
      walk(JSON.parse(m[1]), 0);
    } catch {
      /* not JSON */
    }
  }
  return [...new Set(out)].join("\n").slice(0, maxChars);
}

/**
 * URLs that appear in the raw HTML outside <a> tags — menus rendered from JSON data attributes
 * (`data-model="{&quot;href&quot;:&quot;\/careers\/journey&quot;}"`) or router payloads. Same origin only;
 * absolute URLs and root-relative paths that look like pages.
 */
export function rawLinks(html: string, base: string, max = 400): string[] {
  let origin: string;
  try {
    origin = new URL(base).origin;
  } catch {
    return [];
  }
  const src = decodeEntities(html.slice(0, MAX_BYTES))
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/");
  const out = new Set<string>();
  const re = /(?:["'(]|\s)((?:https?:\/\/[a-z0-9.-]+)?\/[a-z0-9\u0590-\u05ff%][^"'()\s<>{}\\]{2,200})/gi;
  for (let m; (m = re.exec(src)) && out.size < max;) {
    const raw = m[1];
    if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|json|woff2?|ttf|mp4|webm|pdf|zip|xml)(\?|$)/i.test(raw)) continue;
    if (raw.startsWith("//")) continue;
    try {
      const u = new URL(raw, origin);
      if (u.origin !== origin && !raw.startsWith("http")) continue;
      u.hash = "";
      out.add(u.toString());
    } catch {
      /* ignore */
    }
  }
  return [...out];
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
