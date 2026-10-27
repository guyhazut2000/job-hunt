/** Hostname used to dedupe companies across sources: lower-case, without "www.", never a LinkedIn/Google URL. */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\d?\./, "");
    if (!host.includes(".") || BLOCKED_HOST.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** Hosts discovery never fetches (ToS: no LinkedIn scraping; no search-engine scraping). */
export const BLOCKED_HOST = /(^|\.)(linkedin\.com|lnkd\.in|google\.[a-z.]+|facebook\.com|x\.com|twitter\.com)$/i;

/** Normalized https origin for a website ("acme.io/" → "https://acme.io"). */
export function originOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    if (BLOCKED_HOST.test(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** "jobs.acme.co.il" → "acme.co.il"; "careers.acme.com" → "acme.com". Good enough for same-company checks. */
export function baseDomain(host: string): string {
  const parts = host
    .toLowerCase()
    .replace(/^www\d?\./, "")
    .split(".");
  const n = parts.length >= 3 && /^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join(".");
}

const CAREERS_WORD =
  /career|working|jobs?\b|jobs\.|join|work-?(with|at)|people|team|hiring|vacanc|opportunit|positions|משרות|דרושים/i;

/**
 * Whether `careersUrl` plausibly is `website`'s own careers page: same company domain (or a hosted
 * ATS page) and a careers-like host or path. Used before listing a company for manual checking.
 */
export function isPlausibleCareersPage(careersUrl: string, website: string): boolean {
  try {
    const c = new URL(careersUrl);
    const site = domainOf(website);
    if (!site || BLOCKED_HOST.test(c.hostname)) return false;
    const ats =
      /(comeet\.com|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|recruitee\.com|myworkdayjobs\.com|hibob\.com|breezy\.hr|bamboohr\.com)$/i;
    if (!ats.test(c.hostname) && baseDomain(c.hostname) !== baseDomain(site)) return false;
    return CAREERS_WORD.test(c.hostname.split(".")[0]) || CAREERS_WORD.test(decodeURIComponent(c.pathname));
  } catch {
    return false;
  }
}
