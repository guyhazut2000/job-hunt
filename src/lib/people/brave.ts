import type { SearchResult } from "./parse";

/**
 * Minimal Brave Web Search client: https://api.search.brave.com/res/v1/web/search
 * Paced (one request per `minIntervalMs` per server instance) with retry + backoff on 429/5xx.
 * Only successful requests are billed by Brave.
 */
export const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export type BraveErrorKind = "quota" | "auth" | "rate" | "upstream" | "network";

export class BraveError extends Error {
  constructor(
    readonly kind: BraveErrorKind,
    readonly status?: number,
  ) {
    super(`brave_${kind}${status ? `_${status}` : ""}`);
  }
}

export interface BravePage {
  results: SearchResult[];
  hasMore: boolean;
}

export interface BraveDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const defaultDeps: BraveDeps = {
  fetch: (...a) => fetch(...a),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

/** Serialises request start times so we never exceed ~1 req/s from this instance. */
export function createPacer(minIntervalMs: number, deps: Pick<BraveDeps, "sleep" | "now"> = defaultDeps) {
  let next = 0;
  let chain: Promise<void> = Promise.resolve();
  return function slot(): Promise<void> {
    const run = chain.then(async () => {
      const wait = next - deps.now();
      if (wait > 0) await deps.sleep(wait);
      next = deps.now() + minIntervalMs;
    });
    chain = run.catch(() => {});
    return run;
  };
}

/** `X-RateLimit-Remaining: 1, 0` → [1, 0] (per-second, per-month). */
export function parseRateHeader(v: string | null): number[] {
  return (v ?? "")
    .split(",")
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export const MAX_ATTEMPTS = 3;

export async function braveWebSearch(
  query: string,
  opts: { apiKey: string; page: number; count?: number; pace: () => Promise<void> },
  deps: BraveDeps = defaultDeps,
): Promise<BravePage> {
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(opts.count ?? 10));
  url.searchParams.set("offset", String(Math.max(0, Math.min(9, opts.page))));
  url.searchParams.set("result_filter", "web");
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("text_decorations", "false");
  url.searchParams.set("spellcheck", "false");

  let lastErr: BraveError = new BraveError("network");
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await opts.pace();
    let res: Response;
    try {
      res = await deps.fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": opts.apiKey },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    } catch {
      lastErr = new BraveError("network");
      await deps.sleep(500 * 2 ** attempt);
      continue;
    }
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as {
        web?: { results?: SearchResult[] };
        query?: { more_results_available?: boolean };
      } | null;
      const results = (body?.web?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        description: r.description,
      }));
      return { results, hasMore: !!body?.query?.more_results_available };
    }
    if (res.status === 401 || res.status === 403) throw new BraveError("auth", res.status);
    if (res.status === 402) throw new BraveError("quota", res.status);
    if (res.status === 429) {
      const remaining = parseRateHeader(res.headers.get("x-ratelimit-remaining"));
      // Monthly window exhausted → no point retrying.
      if (remaining.length > 1 && remaining.slice(1).some((n) => n <= 0)) throw new BraveError("quota", 429);
      const reset = parseRateHeader(res.headers.get("x-ratelimit-reset"))[0];
      lastErr = new BraveError("rate", 429);
      await deps.sleep(Math.min(8000, Math.max(reset ? reset * 1000 : 0, 1000 * 2 ** attempt)));
      continue;
    }
    if (res.status >= 500) {
      lastErr = new BraveError("upstream", res.status);
      await deps.sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new BraveError("upstream", res.status);
  }
  throw lastErr;
}
