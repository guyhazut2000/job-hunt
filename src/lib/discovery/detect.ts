import type { AtsProvider } from "@prisma/client";
import { USER_AGENT, paceHost } from "../ingestion/http";
import { getAdapter } from "../ingestion/registry";
import { BLOCKED_HOST, originOf } from "./domain";
import { isAllowedByRobots } from "./robots";
import type { AtsHints } from "./sources";

/** A public ATS board found on a company's careers page. */
export interface BoardRef {
  provider: AtsProvider;
  boardId: string;
}

const NOT_A_BOARD = /^(www|api|app|careers|jobs|embed|static|assets|cdn|boards|job-boards|support|help)$/i;
const COMEET_UID = /^[A-F0-9]{2}\.[A-F0-9]{3}$/i;

/**
 * Find ATS boards referenced by a careers page's HTML (links, iframes, embed scripts). Order = how
 * reliable the reference is for "this company's own board".
 */
export function findBoards(html: string): BoardRef[] {
  const out: BoardRef[] = [];
  const add = (provider: AtsProvider, boardId: string) => {
    if (!boardId || NOT_A_BOARD.test(boardId)) return;
    if (!out.some((b) => b.provider === provider && b.boardId.toLowerCase() === boardId.toLowerCase()))
      out.push({ provider, boardId });
  };
  const each = (rx: RegExp, fn: (m: RegExpMatchArray) => void) => {
    for (const m of html.matchAll(rx)) fn(m);
  };
  each(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9]+)/gi, (m) =>
    add("GREENHOUSE", m[1].toLowerCase()),
  );
  each(/jobs\.(eu\.)?lever\.co\/([A-Za-z0-9-]+)/g, (m) => add("LEVER", `${m[1] ? "eu:" : ""}${m[2]}`));
  each(/jobs\.ashbyhq\.com\/([A-Za-z0-9.-]+)/g, (m) => add("ASHBY", m[1]));
  each(/apply\.workable\.com\/([a-z0-9-]+)/g, (m) => add("WORKABLE", m[1]));
  each(/(?:careers|jobs)\.smartrecruiters\.com\/([A-Za-z0-9]+)/g, (m) => add("SMARTRECRUITERS", m[1]));
  each(/\b([a-z0-9-]+)\.recruitee\.com/g, (m) => add("RECRUITEE", m[1]));
  each(/\b([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/g, (m) => {
    if (!/^(wday|en|job|jobs)$/i.test(m[3])) add("WORKDAY", `${m[1]}/${m[2]}/${m[3]}`);
  });
  return out;
}

/**
 * Comeet embeds expose the company uid and a public careers-API token (upper-case hex) in the page
 * source. Lower-case hex "tokens" belong to other widgets and are ignored.
 */
export function findComeet(html: string): {
  uids: string[];
  tokens: string[];
  hosted: { slug: string; uid: string }[];
} {
  const uniq = (xs: string[]) => [...new Set(xs)];
  const hosted = [...html.matchAll(/comeet\.com\/jobs\/([A-Za-z0-9_.-]+)\/([A-F0-9]{2}\.[A-F0-9]{3})/gi)].map((m) => ({
    slug: m[1],
    uid: m[2].toUpperCase(),
  }));
  const uids = uniq([
    ...[...html.matchAll(/company[-_]?uid["']?\s*[:=]\s*["']([A-F0-9]{2}\.[A-F0-9]{3})["']/gi)].map((m) => m[1]),
    ...hosted.map((h) => h.uid),
  ]).map((u) => u.toUpperCase());
  const tokens = uniq([...html.matchAll(/[Tt]oken["']?\s*[:=]\s*["']([A-F0-9]{16,})["']/g)].map((m) => m[1]));
  return { uids, tokens, hosted };
}

/** Links on a homepage that look like the careers page (same site or a hosted ATS page). */
export function careersLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const [, href, text] = m;
    if (
      !/career|jobs?\b|join[-_ ]?(us|the[-_ ]team)|work[-_ ](with|at)[-_ ]us|hiring|דרושים|משרות|קריירה/i.test(
        `${href} ${text}`,
      )
    )
      continue;
    try {
      const u = new URL(href, base);
      if ((u.protocol === "https:" || u.protocol === "http:") && !BLOCKED_HOST.test(u.hostname)) out.push(u.href);
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)].slice(0, 3);
}

export const CAREERS_PATHS = ["/careers", "/jobs", "/company/careers", "/about/careers", "/join-us"];

const MAX_HTML = 1_500_000;

interface Page {
  url: string;
  html: string;
}

/** Polite HTML fetcher: robots.txt-aware per host, paced, time-limited, never LinkedIn/Google. */
export class PoliteFetcher {
  private robots = new Map<string, Promise<string | null>>();
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  private async raw(url: string): Promise<Response | null> {
    const u = new URL(url);
    if (BLOCKED_HOST.test(u.hostname)) return null;
    await paceHost(u.host, 500);
    try {
      const res = await this.fetchImpl(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.url && BLOCKED_HOST.test(new URL(res.url).hostname)) return null;
      return res;
    } catch {
      return null;
    }
  }

  async allowed(url: string): Promise<boolean> {
    const u = new URL(url);
    let robots = this.robots.get(u.origin);
    if (!robots) {
      robots = this.raw(`${u.origin}/robots.txt`).then(async (r) =>
        r && r.ok ? (await r.text()).slice(0, 200_000) : null,
      );
      this.robots.set(u.origin, robots);
    }
    return isAllowedByRobots(await robots, u.pathname + u.search);
  }

  /** The page's HTML, or null when it is disallowed by robots.txt, blocked, or not a 2xx page. */
  async page(url: string): Promise<Page | null> {
    if (!(await this.allowed(url))) return null;
    const res = await this.raw(url);
    if (!res || !res.ok) return null;
    if (!/html|text\/plain/i.test(res.headers.get("content-type") ?? "text/html")) return null;
    const html = (await res.text()).slice(0, MAX_HTML);
    return { url: res.url || url, html };
  }
}

export interface DetectionInput {
  website: string;
  careersUrl?: string | null;
  hints?: AtsHints | null;
}

export interface DetectionResult {
  /** The careers page that loaded (or the website when none did). */
  careersUrl: string | null;
  /** A careers page (not just the homepage) loaded. */
  pageLoaded: boolean;
  board: BoardRef | null;
  totalJobs: number;
  israelJobs: number;
  /** Boards that were referenced but returned no jobs / failed verification. */
  rejected: string[];
}

export interface DetectOptions {
  fetcher?: PoliteFetcher;
  /** Verify a board against its ATS: total postings and Israeli postings. Injected in tests. */
  verify?: (board: BoardRef) => Promise<{ total: number; israel: number } | null>;
  fetchImpl?: typeof fetch;
}

export async function verifyBoard(
  board: BoardRef,
  fetchImpl?: typeof fetch,
): Promise<{ total: number; israel: number } | null> {
  const adapter = getAdapter(board.provider);
  if (!adapter) return null;
  try {
    const raws = await adapter.fetchRaw({ boardId: board.boardId, fetchImpl });
    return { total: raws.length, israel: raws.filter((r) => adapter.isInIsrael(r)).length };
  } catch {
    return null;
  }
}

/**
 * Find a company's public ATS board: known source hints first, then its careers page (or homepage →
 * careers link → common careers paths), then verify against the ATS's public API.
 */
export async function detectAts(input: DetectionInput, options: DetectOptions = {}): Promise<DetectionResult> {
  const fetcher = options.fetcher ?? new PoliteFetcher(options.fetchImpl);
  const verify = options.verify ?? ((b: BoardRef) => verifyBoard(b, options.fetchImpl));
  const result: DetectionResult = {
    careersUrl: null,
    pageLoaded: false,
    board: null,
    totalJobs: 0,
    israelJobs: 0,
    rejected: [],
  };
  const boards: BoardRef[] = [];
  const pushBoard = (b: BoardRef) => {
    if (!boards.some((x) => x.provider === b.provider && x.boardId.toLowerCase() === b.boardId.toLowerCase()))
      boards.push(b);
  };
  const hints = input.hints ?? {};
  if (hints.greenhouse) pushBoard({ provider: "GREENHOUSE", boardId: hints.greenhouse.toLowerCase() });
  if (hints.lever) pushBoard({ provider: "LEVER", boardId: hints.lever });

  const comeet = { uids: new Set<string>(), tokens: new Set<string>(), hosted: [] as { slug: string; uid: string }[] };
  if (hints.comeet) {
    const [slug, uid] = hints.comeet.split("/");
    comeet.hosted.push({ slug, uid: uid.toUpperCase() });
    comeet.uids.add(uid.toUpperCase());
  }
  const scan = (p: Page) => {
    findBoards(p.html).forEach(pushBoard);
    const c = findComeet(p.html);
    c.uids.forEach((u) => comeet.uids.add(u));
    c.tokens.forEach((t) => comeet.tokens.add(t));
    comeet.hosted.push(...c.hosted);
  };
  const found = () => boards.length > 0 || (comeet.uids.size > 0 && comeet.tokens.size > 0);

  const origin = originOf(input.website);
  const visited = new Set<string>();
  const visit = async (url: string) => {
    const key = url.replace(/\/$/, "");
    if (visited.has(key) || visited.size >= 6) return null;
    visited.add(key);
    const p = await fetcher.page(url);
    if (p) scan(p);
    return p;
  };

  if (input.careersUrl) {
    const p = await visit(input.careersUrl);
    if (p) {
      result.careersUrl = p.url;
      result.pageLoaded = true;
    }
  }
  if (!found() && origin) {
    const home = await visit(origin);
    if (home) {
      for (const link of careersLinks(home.html, home.url)) {
        if (found()) break;
        const p = await visit(link);
        if (p && !result.careersUrl) {
          result.careersUrl = p.url;
          result.pageLoaded = true;
        }
      }
    }
    for (const path of CAREERS_PATHS) {
      if (found() || visited.size >= 6) break;
      const p = await visit(origin + path);
      if (p && !result.careersUrl) {
        result.careersUrl = p.url;
        result.pageLoaded = true;
      }
    }
  }
  // Comeet: the uid alone isn't enough — the public positions API needs the token that the
  // company's careers widget (or its Comeet-hosted careers page) publishes.
  if (comeet.uids.size && !comeet.tokens.size && comeet.hosted.length) {
    const h = comeet.hosted[0];
    const p = await fetcher.page(`https://www.comeet.com/jobs/${h.slug}/${h.uid}`);
    if (p) findComeet(p.html).tokens.forEach((t) => comeet.tokens.add(t));
  }
  for (const uid of comeet.uids) {
    if (!COMEET_UID.test(uid)) continue;
    for (const token of comeet.tokens) pushBoard({ provider: "COMEET", boardId: `${uid}:${token}` });
  }

  for (const board of boards.slice(0, 6)) {
    const v = await verify(board);
    if (v && v.total > 0) {
      result.board = board;
      result.totalJobs = v.total;
      result.israelJobs = v.israel;
      break;
    }
    result.rejected.push(
      `${board.provider}:${board.provider === "COMEET" ? board.boardId.split(":")[0] : board.boardId}`,
    );
  }
  if (!result.careersUrl) result.careersUrl = input.careersUrl ?? origin;
  return result;
}
