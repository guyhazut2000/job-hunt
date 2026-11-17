import { createHash } from "node:crypto";

/** Request context we keep for an activity row: coarse device info, Vercel's approximate geo, a hashed IP. */
export interface ActivityContext {
  country?: string;
  region?: string;
  city?: string;
  device?: "mobile" | "tablet" | "desktop";
  browser?: string;
  os?: string;
  ipHash?: string;
}

type HeaderBag = Pick<Headers, "get">;

// Page views are only recorded for signed-in users, so this just drops obvious crawlers/link previews.
const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python-requests|httpclient|lighthouse|vercel-(screenshot|favicon)|uptime|monitor/i;

export function isBot(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_UA.test(ua);
}

export function parseUserAgent(ua: string | null | undefined): Pick<ActivityContext, "device" | "browser" | "os"> {
  if (!ua) return {};
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua)
    ? "tablet"
    : /mobi|iphone|ipod|android/i.test(ua)
      ? "mobile"
      : "desktop";
  const os = /iphone|ipad|ipod/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os x|macintosh/i.test(ua)
          ? "macOS"
          : /cros/i.test(ua)
            ? "ChromeOS"
            : /linux/i.test(ua)
              ? "Linux"
              : undefined;
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /samsungbrowser/i.test(ua)
      ? "Samsung"
      : /opr\/|opera/i.test(ua)
        ? "Opera"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /chrome|crios|chromium/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : undefined;
  return { device, ...(os && { os }), ...(browser && { browser }) };
}

function decode(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    return decodeURIComponent(v).slice(0, 80) || undefined;
  } catch {
    return v.slice(0, 80) || undefined;
  }
}

/** Approximate location from Vercel's edge headers (absent locally; nothing is looked up). */
export function geoFromHeaders(h: HeaderBag): Pick<ActivityContext, "country" | "region" | "city"> {
  const country = decode(h.get("x-vercel-ip-country"));
  const region = decode(h.get("x-vercel-ip-country-region"));
  const city = decode(h.get("x-vercel-ip-city"));
  return { ...(country && { country }), ...(region && { region }), ...(city && { city }) };
}

/** Salted, truncated hash of the client IP. The raw IP is never stored. */
export function hashIp(h: HeaderBag, secret = process.env.AUTH_SECRET ?? ""): string | undefined {
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim();
  if (!ip) return undefined;
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex").slice(0, 16);
}

export function contextFromHeaders(h: HeaderBag): ActivityContext {
  return { ...parseUserAgent(h.get("user-agent")), ...geoFromHeaders(h), ...(hashIp(h) && { ipHash: hashIp(h) }) };
}

/** A safe pathname to store: must start with "/", no query/hash, bounded length. */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 200) return null;
  if (/[\s<>"'\\]/.test(path)) return null;
  if (/^\/(_next|api)\//.test(path) || /\.[a-z0-9]{2,5}$/i.test(path)) return null;
  return path;
}
