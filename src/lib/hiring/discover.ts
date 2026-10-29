/**
 * Finds a company's public hiring-process pages (docs/hiring-process.md). Discovery v2, in priority order:
 *   1. curated seed URLs (seeds.ts),
 *   2. links whose URL/text mentions the hiring/interview process — from <a> tags and from URLs embedded in
 *      the raw HTML (JSON data attributes), on the careers page and the homepage,
 *   3. URLs from the site's sitemap.xml (robots.txt `Sitemap:` lines first) that look like process pages,
 *   4. the careers page / homepage themselves,
 *   5. a few conventional paths (English and Hebrew), skipped once the site answers every path with the
 *      same page (soft-404 / single-page-app catch-all).
 * Bounded (`maxFetches` page requests + `maxSitemapFetches`), robots.txt-honouring, and it records *why*
 * nothing was found (bot wall, robots, client-rendered, unreachable, no process text…).
 */
import {
  cachedRobots,
  fetchPublicPage,
  isBlockedUrl,
  isHostDown,
  politeGet,
  robotsSitemaps,
  type FetchDeps,
} from "./fetch";
import { isDedicatedProcessSource, PROCESS_RE, processPassages, stageLineCount, type SourcePage } from "./extract";
import { HIRING_SEEDS } from "./seeds";

export type CheckedResult = "stages" | "no_info" | "blocked" | "bot_wall" | "js_rendered" | "error";

export interface CheckedSource {
  url: string;
  title: string;
  result: CheckedResult;
}

export interface CompanyTarget {
  slug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
}

/** Why discovery produced no candidate page (company level). */
export type DiscoveryFailure = "no_website" | "robots" | "bot_wall" | "js_rendered" | "unreachable" | "no_process_text";

export interface DiscoveryStats {
  fetches: number;
  ok: number;
  robots: number;
  botWall: number;
  notFound: number;
  softNotFound: number;
  network: number;
  jsShell: number;
  sitemapUrls: number;
}

export interface DiscoveryResult {
  pages: SourcePage[];
  checked: CheckedSource[];
  /** Set when `pages` is empty. */
  failure: DiscoveryFailure | null;
  stats: DiscoveryStats;
}

/** Conventional locations, tried last. Hebrew slugs are common on Israeli company sites. */
export const COMMON_PATHS = [
  "/careers/how-we-hire",
  "/careers/hiring-process",
  "/how-we-hire",
  "/hiring-process",
  "/careers/faq",
  `/${encodeURIComponent("תהליך-גיוס")}`,
  `/${encodeURIComponent("תהליך-מיון")}`,
];
/** URL or link text that points at a process page. */
export const LINK_RE =
  /how[-_ ]?we[-_ ]?hire|hiring[-_ ](process|journey|steps|faq)|interview(ing)?[-_ ](process|at|guide|tips|prep|steps)|recruit(ment|ing)[-_ ](process|journey|steps|faq)|candidate[-_ ](experience|journey|guide|faq|resources)|journey[-_ ]to[-_ ]|what[-_ ]to[-_ ]expect|our[-_ ](hiring[-_ ])?process|get[-_ ]?hired|application[-_ ](process|tips)|careers?\/faqs?\b|hiring[-_ ]faqs?|תהליך[-_ ](ה)?(גיוס|מיון)|שלבי[-_ ](ה)?(גיוס|מיון)|%d7%aa%d7%94%d7%9c%d7%99%d7%9a/i;
/** Link to the careers area (followed from the homepage when no careers URL is known). */
const CAREERS_LINK_RE =
  /\/(careers?|jobs|join[-_]?us|work[-_]with[-_]us|life[-_]at|about\/careers)(\/|$|\?)|קריירה|דרושים/i;

/** Registrable-ish site key (drops leading "www." / "careers." / "jobs." so subdomains count as same-site). */
export function siteKey(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const parts = host.split(".");
    const tail = parts.slice(-2).join(".");
    // co.il / co.uk style second-level suffixes
    return /^(co|com|org|net|ac|gov)\.[a-z]{2}$/.test(tail) ? parts.slice(-3).join(".") : tail;
  } catch {
    return null;
  }
}

export function normUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|bc$|gh_src|ref$)/i.test(k)) x.searchParams.delete(k);
    return x.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

/** A page worth sending to extraction: process wording outside boilerplate, plus a stage-like line or a dedicated URL/title. */
export function looksLikeProcessPage(text: string, url = "", title = ""): boolean {
  if (!PROCESS_RE.test(text)) return false;
  const passage = processPassages(text, 6_000);
  if (!passage) return false;
  return stageLineCount(passage) >= 1 || isDedicatedProcessSource(url, title);
}

/** Cheap fingerprint to spot catch-all pages (same body for every path). */
function fingerprint(title: string, text: string): string {
  const t = text.replace(/\s+/g, " ").slice(0, 1_500);
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${title.slice(0, 80)}|${t.length}|${h}`;
}

/** <loc> entries of a sitemap or sitemap index. */
export function sitemapLocs(xml: string): { index: boolean; locs: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/<!\[CDATA\[|\]\]>/g, ""),
  );
  return { index: /<sitemapindex\b/i.test(xml), locs: locs.slice(0, 50_000) };
}

type Tier = 0 | 1 | 2 | 3;
interface QItem {
  url: string;
  tier: Tier;
  guessed: boolean;
}

export async function discoverProcessPages(
  target: CompanyTarget,
  deps: FetchDeps & {
    maxFetches?: number;
    maxSitemapFetches?: number;
    maxPages?: number;
    /** Wall-clock budget for one company's discovery (default 60 s); `now` is injectable for tests. */
    maxMs?: number;
    now?: () => number;
  } = {},
): Promise<DiscoveryResult> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const maxMs = deps.maxMs ?? 60_000;
  const outOfTime = () => now() - startedAt > maxMs;
  // Per-company host health unless the caller shares one across the run.
  deps = { ...deps, hostFailures: deps.hostFailures ?? new Map() };
  const maxFetches = deps.maxFetches ?? 12;
  const maxSitemapFetches = deps.maxSitemapFetches ?? 3;
  const maxPages = deps.maxPages ?? 4;
  const seeds = HIRING_SEEDS[target.slug] ?? [];
  const stats: DiscoveryStats = {
    fetches: 0,
    ok: 0,
    robots: 0,
    botWall: 0,
    notFound: 0,
    softNotFound: 0,
    network: 0,
    jsShell: 0,
    sitemapUrls: 0,
  };
  const allowedSites = new Set(
    [target.website, target.careersUrl, ...seeds]
      .filter((u): u is string => !!u && !isBlockedUrl(u))
      .map(siteKey)
      .filter((k): k is string => !!k),
  );
  if (allowedSites.size === 0) return { pages: [], checked: [], failure: "no_website", stats };

  const queue: QItem[] = [];
  const seen = new Set<string>();
  const push = (u: string | null | undefined, tier: Tier, guessed = false) => {
    if (!u || isBlockedUrl(u)) return;
    const n = normUrl(u);
    if (seen.has(n)) return;
    const key = siteKey(n);
    if (!key || !allowedSites.has(key)) return;
    seen.add(n);
    queue.push({ url: n, tier, guessed });
  };
  const next = (): QItem | undefined => {
    let best = -1;
    for (let i = 0; i < queue.length; i++) if (best < 0 || queue[i].tier < queue[best].tier) best = i;
    return best < 0 ? undefined : queue.splice(best, 1)[0];
  };

  for (const s of seeds) push(s, 0);
  push(target.careersUrl, 2);
  let origin: string | null = null;
  try {
    origin = target.website
      ? new URL(target.website).origin
      : target.careersUrl
        ? new URL(target.careersUrl).origin
        : null;
  } catch {
    origin = null;
  }
  if (origin) {
    if (!target.careersUrl) push(`${origin}/careers`, 2);
    push(origin, 2);
    for (const p of COMMON_PATHS) push(origin + p, 3, true);
  }

  const pages: SourcePage[] = [];
  const checked: CheckedSource[] = [];
  const prints = new Set<string>();
  let guessesDisabled = false;
  let sitemapDone = false;
  const careersUrl = target.careersUrl ? normUrl(target.careersUrl) : null;

  const readSitemaps = async () => {
    sitemapDone = true;
    const origins = new Set<string>();
    for (const u of [careersUrl, origin]) {
      try {
        if (u) origins.add(new URL(u).origin);
      } catch {
        /* skip */
      }
    }
    const candidates: string[] = [];
    for (const o of origins) {
      const listed = robotsSitemaps(cachedRobots(o, deps));
      candidates.push(...(listed.length ? listed : [`${o}/sitemap.xml`]));
    }
    let sitemapFetches = 0;
    const todo = [...new Set(candidates)];
    while (todo.length && sitemapFetches < maxSitemapFetches && !outOfTime()) {
      const sm = todo.shift()!;
      if (/\.gz(\?|$)/i.test(sm) || !allowedSites.has(siteKey(sm) ?? "")) continue;
      sitemapFetches++;
      const got = await politeGet(sm, deps, "application/xml,text/xml");
      if (!got.ok) continue;
      const { index, locs } = sitemapLocs(got.body);
      if (index) {
        // Prefer child sitemaps for pages/careers over blog posts / products.
        const ranked = locs
          .filter((l) => !/\.gz(\?|$)/i.test(l))
          .sort((a, b) => childRank(a) - childRank(b))
          .slice(0, 2);
        todo.unshift(...ranked);
        continue;
      }
      for (const l of locs) {
        if (LINK_RE.test(safeDecode(l))) {
          stats.sitemapUrls++;
          push(l, 1);
        }
      }
    }
  };

  while (stats.fetches < maxFetches && !outOfTime()) {
    // Sitemaps once the high-priority queue (seeds + process links) is exhausted.
    if (!sitemapDone && !queue.some((q) => q.tier <= 1) && stats.fetches > 0) await readSitemaps();
    const item = next();
    if (!item) {
      if (!sitemapDone) {
        await readSitemaps();
        if (queue.length) continue;
      }
      break;
    }
    if (item.guessed && guessesDisabled) continue;
    const { url } = item;
    // An unresponsive host: count it as a network failure without sending (or waiting on) the request.
    if (isHostDown(deps, url)) {
      stats.network++;
      if (!item.guessed) checked.push({ url, title: "", result: "error" });
      continue;
    }
    stats.fetches++;
    const res = await fetchPublicPage(url, deps);
    if (!res.ok) {
      if (res.reason === "robots" || res.reason === "blocked") {
        stats.robots++;
        checked.push({ url, title: "", result: "blocked" });
      } else if (res.reason === "bot_wall") {
        stats.botWall++;
        if (!item.guessed) checked.push({ url, title: "", result: "bot_wall" });
      } else if (res.reason === "not_found") {
        stats.notFound++;
        // 404 on a guessed path is noise; a 404 on a seed / careers URL is worth showing.
        if (!item.guessed && item.tier !== 1) checked.push({ url, title: "", result: "error" });
      } else {
        stats.network++;
        if (!item.guessed) checked.push({ url, title: "", result: "error" });
      }
      continue;
    }
    stats.ok++;
    const finalUrl = normUrl(res.url);
    seen.add(finalUrl);
    const fp = fingerprint(res.title, res.text);
    if (item.guessed) {
      let path = "/";
      try {
        path = new URL(finalUrl).pathname;
      } catch {
        /* keep */
      }
      // Same body as a page we already saw, or redirected to the homepage → catch-all; stop guessing.
      if (prints.has(fp) || path === "/" || path === "") {
        stats.softNotFound++;
        guessesDisabled = true;
        continue;
      }
    }
    prints.add(fp);
    if (res.jsShell) {
      stats.jsShell++;
      checked.push({ url: finalUrl, title: res.title, result: "js_rendered" });
    } else {
      const isProcess = looksLikeProcessPage(res.text, finalUrl, res.title);
      if (isProcess && !pages.some((p) => p.url === finalUrl)) {
        pages.push({ url: finalUrl, title: res.title, text: res.text, origin: "page" });
      }
      checked.push({ url: finalUrl, title: res.title, result: "no_info" });
    }
    for (const l of res.links) {
      if (LINK_RE.test(safeDecode(l.href)) || LINK_RE.test(l.text)) push(l.href, 1);
      else if (item.tier >= 2 && !careersUrl && CAREERS_LINK_RE.test(safeDecode(l.href))) push(l.href, 2);
    }
    for (const l of res.rawLinks) if (LINK_RE.test(safeDecode(l))) push(l, 1);
    if (pages.length >= maxPages) break;
  }

  // de-duplicate checked entries by url (redirects can repeat); a later "no_info" wins over an error.
  const uniq = new Map<string, CheckedSource>();
  for (const c of checked) if (!uniq.has(c.url) || c.result === "no_info") uniq.set(c.url, c);
  return { pages, checked: [...uniq.values()], failure: pages.length ? null : failureOf(stats), stats };
}

function childRank(u: string): number {
  const s = u.toLowerCase();
  if (/career|job|hiring|recruit/.test(s)) return 0;
  if (/page|static|main|en[-_.]|\/en\/|default/.test(s)) return 1;
  if (/post|blog|news|article|product|image|video|tag|categor|author/.test(s)) return 3;
  return 2;
}

function safeDecode(u: string): string {
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
}

/** Company-level reason when no candidate page was found. */
export function failureOf(s: DiscoveryStats): DiscoveryFailure {
  if (s.ok > 0) return s.jsShell >= s.ok ? "js_rendered" : "no_process_text";
  if (s.botWall > 0 && s.botWall >= s.robots && s.botWall >= s.network) return "bot_wall";
  if (s.robots > 0 && s.robots >= s.network) return "robots";
  if (s.fetches === 0) return "no_website";
  return "unreachable";
}
