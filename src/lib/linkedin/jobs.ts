import { cleanCompanyName } from "@/lib/outreach/links";
import { mentionsCompany } from "@/lib/people/match";
import { cleanText, type SearchResult } from "@/lib/people/parse";

/**
 * LinkedIn job links, built only from what Brave Search returns (title/description/url) or from
 * a public jobs-search deep link. We never request linkedin.com ourselves.
 */

/** Score needed to treat a search result as the exact posting. */
export const EXACT_MIN_CONFIDENCE = 70;

const HOST = /^(?:[a-z]{2,3}\.|www\.)?linkedin\.com$/i;

/**
 * `https://il.linkedin.com/jobs/view/senior-backend-engineer-at-wiz-4012345678?trk=…`
 *   → `{ id: "4012345678", url: "https://www.linkedin.com/jobs/view/4012345678/" }`.
 * Accepts /jobs/view/<id> and /jobs/view/<slug>-<id>, with or without a trailing slash; nothing else.
 */
export function normalizeLinkedinJobUrl(raw: string): { id: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOST.test(u.hostname)) return null;
  const m = /^\/jobs\/view\/(?:[^/]*?-)?(\d{6,15})\/?$/.exec(u.pathname);
  if (!m) return null;
  return { id: m[1], url: `https://www.linkedin.com/jobs/view/${m[1]}/` };
}

/** True for URLs we store/link as an "exact posting" (already normalized). */
export function isExactLinkedinJobUrl(url: string | null | undefined): url is string {
  return !!url && normalizeLinkedinJobUrl(url)?.url === url;
}

const STOP = new Set([
  "and",
  "the",
  "of",
  "for",
  "in",
  "at",
  "to",
  "a",
  "an",
  "with",
  "il",
  "israel",
  "ישראל",
  "-",
  "&",
]);

/** Lowercase word tokens; drops punctuation, stopwords and bracketed location/req-id suffixes. */
export function titleTokens(title: string): string[] {
  const t = cleanText(title)
    .toLowerCase()
    .replace(/\((?:[^)]*)\)|\[(?:[^\]]*)\]/g, " ")
    .replace(/\bsr\.?\b/g, "senior")
    .replace(/\bjr\.?\b/g, "junior")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ");
  return t.split(" ").filter((w) => w && !STOP.has(w));
}

/** Share of the job-title tokens present in the result title (0–1). */
export function titleCoverage(jobTitle: string, resultTitle: string): number {
  const want = [...new Set(titleTokens(jobTitle))];
  if (want.length === 0) return 0;
  const have = new Set(titleTokens(resultTitle));
  return want.filter((w) => have.has(w)).length / want.length;
}

/** Brave titles look like "Wiz hiring Senior Backend Engineer in Tel Aviv… | LinkedIn" or "Title - Company | LinkedIn". */
function stripLinkedinSuffix(title: string | undefined) {
  return cleanText(title).replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "");
}

export interface LinkedinJobMatch {
  id: string;
  url: string;
  confidence: number;
  title: string;
}

/** 0–100. Title coverage carries most weight; the company must appear in the result title for an exact match. */
export function scoreJobResult(r: SearchResult, job: { title: string; company: string }): number {
  const title = stripLinkedinSuffix(r.title);
  const desc = cleanText(r.description);
  const cov = titleCoverage(job.title, title);
  let score = 0;
  if (cov >= 0.999) score += 55;
  else if (cov >= 0.75) score += 40;
  else if (cov >= 0.5) score += 20;
  if (mentionsCompany(title, job.company)) score += 35;
  else if (mentionsCompany(desc, job.company)) score += 15;
  if (
    /israel|ישראל|tel aviv|תל אביב|herzliya|haifa|jerusalem|ramat gan|petah tikva|ra'?anana/i.test(`${title} ${desc}`)
  )
    score += 10;
  return Math.max(0, Math.min(100, score));
}

/** Best exact-posting candidate among Brave results, or null if none is confident enough. */
export function pickLinkedinJob(
  results: SearchResult[],
  job: { title: string; company: string },
  min = EXACT_MIN_CONFIDENCE,
): LinkedinJobMatch | null {
  let best: LinkedinJobMatch | null = null;
  for (const r of results) {
    const n = r.url ? normalizeLinkedinJobUrl(r.url) : null;
    if (!n) continue;
    const confidence = scoreJobResult(r, job);
    if (confidence >= min && (!best || confidence > best.confidence)) {
      best = { ...n, confidence, title: stripLinkedinSuffix(r.title) };
    }
  }
  return best;
}

const quote = (s: string) => `"${s.replace(/["״]/g, "").replace(/\s+/g, " ").trim()}"`;

/** `site:linkedin.com/jobs/view "Senior Backend Engineer" "Wiz"` — req ids / brackets removed from the title. */
export function buildLinkedinJobQuery(title: string, company: string): string {
  const t = cleanText(title)
    .replace(/\((?:[^)]*)\)|\[(?:[^\]]*)\]/g, " ")
    .replace(/\s+[-–—|]\s+.*$/, "")
    .trim();
  return `site:linkedin.com/jobs/view ${quote(t || title)} ${quote(cleanCompanyName(company))}`;
}

/**
 * Public LinkedIn jobs search deep link (no API, opened by the user in their browser).
 * `companyId` (f_C) only when we legitimately know the numeric company id; we don't store one today.
 */
export function linkedinJobSearchUrl(input: { title: string; company: string; companyId?: string | null }): string {
  const u = new URL("https://www.linkedin.com/jobs/search/");
  const t = cleanText(input.title)
    .replace(/\((?:[^)]*)\)|\[(?:[^\]]*)\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  u.searchParams.set("keywords", `${t} ${cleanCompanyName(input.company)}`.trim());
  u.searchParams.set("location", "Israel");
  if (input.companyId && /^\d{1,12}$/.test(input.companyId)) u.searchParams.set("f_C", input.companyId);
  return u.toString();
}

/** What the UI shows for a job: the exact posting if we have one, else a search link. */
export function linkedinLinkFor(job: { title: string; linkedinUrl?: string | null; company: { name: string } }): {
  kind: "exact" | "search";
  url: string;
} {
  if (isExactLinkedinJobUrl(job.linkedinUrl)) return { kind: "exact", url: job.linkedinUrl };
  return { kind: "search", url: linkedinJobSearchUrl({ title: job.title, company: job.company.name }) };
}

/** Recheck policy: found links are re-validated monthly, misses retried weekly (new postings appear late). */
export const RECHECK_FOUND_MS = 30 * 24 * 3600 * 1000;
export const RECHECK_MISS_MS = 7 * 24 * 3600 * 1000;

export function needsLinkedinCheck(
  job: { linkedinUrl?: string | null; linkedinCheckedAt?: Date | null },
  now = new Date(),
): boolean {
  if (!job.linkedinCheckedAt) return true;
  const age = now.getTime() - job.linkedinCheckedAt.getTime();
  return age > (job.linkedinUrl ? RECHECK_FOUND_MS : RECHECK_MISS_MS);
}
