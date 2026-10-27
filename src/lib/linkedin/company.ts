import { cleanCompanyName } from "@/lib/outreach/links";
import { linkedinJobSearchUrl } from "./jobs";

/**
 * LinkedIn links for a company. Outbound URLs only: we never request linkedin.com.
 * A stored company page (set by an admin) wins; otherwise a LinkedIn company search.
 */

const HOST = /^(?:[a-z]{2,3}\.|www\.)?linkedin\.com$/i;
/** LinkedIn vanity names: letters (any script), digits, `-`, `_`, `.`, `&`; percent-encoded in URLs. */
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}\-_.&]{0,99}$/u;

/**
 * Accepts `https://il.linkedin.com/company/wiz-inc/about/?trk=…`, `linkedin.com/company/wiz-inc`,
 * `/showcase/…`, `/school/…`, or a bare slug (`wiz-inc`). Returns
 * `https://www.linkedin.com/company/wiz-inc/` (or `/showcase/…`, `/school/…`), else null.
 */
export function normalizeLinkedinCompanyUrl(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  let kind = "company";
  let slug: string;
  if (/^[\p{L}\p{N}][\p{L}\p{N}\-_.&%]*$/u.test(s) && !/linkedin\.com/i.test(s)) {
    slug = s;
  } else {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!HOST.test(u.hostname)) return null;
    const m = /^\/(company|showcase|school)\/([^/]+)(?:\/[a-z-]*)?\/?$/i.exec(u.pathname);
    if (!m) return null;
    kind = m[1].toLowerCase();
    slug = m[2];
  }
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (!SLUG.test(slug)) return null;
  return `https://www.linkedin.com/${kind}/${encodeURIComponent(slug).replace(/%26/g, "&")}/`;
}

/** `https://www.linkedin.com/search/results/companies/?keywords=<clean name>` */
export function linkedinCompanySearchUrl(name: string): string {
  const u = new URL("https://www.linkedin.com/search/results/companies/");
  u.searchParams.set("keywords", cleanCompanyName(name));
  return u.toString();
}

/** LinkedIn jobs search for the company in Israel (same builder as the per-job search link). */
export function linkedinCompanyJobsUrl(name: string): string {
  return linkedinJobSearchUrl({ title: "", company: name });
}

export type LinkedinCompanyLinkKind = "company_page" | "company_search";

/** What the UI shows for a company: its stored LinkedIn page if valid, else a company search. */
export function linkedinCompanyLinkFor(company: { name: string; linkedinUrl?: string | null }): {
  kind: LinkedinCompanyLinkKind;
  url: string;
} {
  const page = normalizeLinkedinCompanyUrl(company.linkedinUrl);
  if (page) return { kind: "company_page", url: page };
  return { kind: "company_search", url: linkedinCompanySearchUrl(company.name) };
}
