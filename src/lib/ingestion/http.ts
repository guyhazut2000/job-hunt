/**
 * Polite HTTP for public job-board APIs: identifies itself, paces requests per host, times out, and
 * retries transient failures (429 / 5xx / network) with backoff, honouring `Retry-After`.
 */
export const USER_AGENT =
  "job-hunt-bot/1.0 (+https://job-hunt-nine-orcin.vercel.app; aggregates public job-board APIs)";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  fetchImpl?: typeof fetch;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Retries after the first attempt for 429 / 5xx / network errors. */
  retries?: number;
  /** Minimum gap between two requests to the same host (per-source rate limit). */
  minIntervalMs?: number;
}

const DEFAULTS = { timeoutMs: 20_000, retries: 2, minIntervalMs: 250 };
const BACKOFF_MS = [1_500, 4_000, 8_000];
const MAX_RETRY_AFTER_MS = 15_000;

/** host → earliest time the next request may start. Shared across concurrent callers. */
const nextSlot = new Map<string, number>();

/** Reserve the next request slot for `host`, waiting if the previous request was too recent. */
export async function paceHost(host: string, minIntervalMs: number, now = Date.now): Promise<void> {
  const at = Math.max(now(), nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + minIntervalMs);
  const wait = at - now();
  if (wait > 0) await sleep(wait);
}

function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const s = Number(h);
  const ms = Number.isFinite(s) ? s * 1000 : new Date(h).getTime() - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : null;
}

export async function requestJson<T>(url: string, label: string, options: RequestOptions = {}): Promise<T> {
  return request(url, label, options, "application/json", async (res) => (await res.json()) as T);
}

/** Same politeness as `requestJson`, for public HTML pages (career sites without a JSON API). */
export async function requestText(url: string, label: string, options: RequestOptions = {}): Promise<string> {
  return request(url, label, options, "text/html,application/xhtml+xml", (res) => res.text());
}

async function request<T>(
  url: string,
  label: string,
  options: RequestOptions,
  accept: string,
  parse: (res: Response) => Promise<T>,
): Promise<T> {
  const { method = "GET", body, fetchImpl = fetch } = options;
  const { timeoutMs, retries, minIntervalMs } = { ...DEFAULTS, ...stripUndefined(options) };
  const host = new URL(url).host;
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
    await paceHost(host, minIntervalMs);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          "user-agent": USER_AGENT,
          accept,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      lastError = e instanceof Error ? e.name : "network error";
      continue;
    }
    if (res.ok) return parse(res);
    lastError = `HTTP ${res.status}`;
    if (res.status !== 429 && res.status < 500) break;
    const ra = retryAfterMs(res);
    if (ra && attempt < retries) await sleep(ra);
  }
  throw new Error(`${label}: ${lastError}`);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Back-compat helper used by the original adapters. */
export function getJson<T>(url: string, label: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  return requestJson<T>(url, label, { fetchImpl });
}
