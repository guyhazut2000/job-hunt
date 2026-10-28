/**
 * Finds a company's public hiring-process pages (docs/hiring-process.md): curated seed URLs, the
 * company's careers page and website, a few conventional paths, and same-site links whose text/URL
 * mentions the hiring or interview process. Bounded: at most `maxFetches` requests per company.
 */
import { fetchPublicPage, isBlockedUrl, type FetchDeps } from "./fetch";
import { PROCESS_RE, type SourcePage } from "./extract";
import { HIRING_SEEDS } from "./seeds";

export interface CheckedSource {
  url: string;
  title: string;
  result: "stages" | "no_info" | "blocked" | "error";
}

export interface CompanyTarget {
  slug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
}

const COMMON_PATHS = [
  "/careers/how-we-hire",
  "/careers/hiring-process",
  "/careers/interview-process",
  "/how-we-hire",
  "/hiring-process",
  "/careers",
];
const LINK_RE =
  /how[- ]we[- ]hire|hiring[- ]process|interview(ing)?[- ](process|at|guide|tips|prep)|recruit(ment|ing)[- ]process|candidate[- ](experience|journey|guide)|what[- ]to[- ]expect|our[- ]process|תהליך[- ](ה)?(גיוס|מיון)/i;

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

function normUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|bc$|gh_src|ref$)/i.test(k)) x.searchParams.delete(k);
    return x.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

export function looksLikeProcessPage(text: string): boolean {
  return PROCESS_RE.test(text);
}

export async function discoverProcessPages(
  target: CompanyTarget,
  deps: FetchDeps & { maxFetches?: number } = {},
): Promise<{ pages: SourcePage[]; checked: CheckedSource[] }> {
  const maxFetches = deps.maxFetches ?? 8;
  const allowedSites = new Set(
    [target.website, target.careersUrl, ...(HIRING_SEEDS[target.slug] ?? [])]
      .filter((u): u is string => !!u && !isBlockedUrl(u))
      .map(siteKey)
      .filter((k): k is string => !!k),
  );
  const queue: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | null | undefined, front = false) => {
    if (!u || isBlockedUrl(u)) return;
    const n = normUrl(u);
    if (seen.has(n)) return;
    const key = siteKey(n);
    if (!key || !allowedSites.has(key)) return;
    seen.add(n);
    if (front) queue.unshift(n);
    else queue.push(n);
  };
  for (const s of HIRING_SEEDS[target.slug] ?? []) push(s);
  push(target.careersUrl);
  if (target.website) {
    try {
      const origin = new URL(target.website).origin;
      for (const p of COMMON_PATHS) push(origin + p);
      const key = siteKey(origin);
      if (key && !target.careersUrl) push(`https://careers.${key}`);
    } catch {
      /* bad website url */
    }
  }

  const pages: SourcePage[] = [];
  const checked: CheckedSource[] = [];
  let fetches = 0;
  while (queue.length && fetches < maxFetches) {
    const url = queue.shift()!;
    fetches++;
    const res = await fetchPublicPage(url, deps);
    if (!res.ok) {
      // 404s on guessed paths are noise, not "sources checked"; robots/blocked are worth showing.
      if (res.reason === "robots" || res.reason === "blocked") checked.push({ url, title: "", result: "blocked" });
      else if (HIRING_SEEDS[target.slug]?.some((s) => normUrl(s) === url) || url === normUrl(target.careersUrl ?? ""))
        checked.push({ url, title: "", result: "error" });
      continue;
    }
    const finalUrl = normUrl(res.url);
    seen.add(finalUrl);
    if (looksLikeProcessPage(res.text) && !pages.some((p) => p.url === finalUrl)) {
      pages.push({ url: finalUrl, title: res.title, text: res.text, origin: "page" });
    }
    checked.push({ url: finalUrl, title: res.title, result: "no_info" });
    for (const l of res.links) if (LINK_RE.test(l.href) || LINK_RE.test(l.text)) push(l.href, true);
    if (pages.length >= 3) break;
  }
  // de-duplicate checked entries by url (redirects can repeat)
  const uniq = new Map(checked.map((c) => [c.url, c]));
  return { pages, checked: [...uniq.values()] };
}
