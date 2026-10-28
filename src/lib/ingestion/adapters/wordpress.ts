import { htmlToText } from "../../taxonomy";
import { requestJson } from "../http";
import { buildJob } from "../normalize";
import type { AtsAdapter } from "../types";

/**
 * Careers sites built on WordPress that publish their openings as a custom post type through the
 * public WordPress REST API (`/wp-json/wp/v2/<postType>`) — e.g. ONE Technologies (one1.co.il).
 * Only used for Israeli company sites whose robots.txt allows it; the API is the same one the site's
 * own front-end reads, so no HTML scraping.
 *
 * boardId = "<host>" or "<host>/<postType>" (default post type "job"), e.g. "www.one1.co.il".
 * Region and category taxonomies are resolved once per run so jobs carry a readable location and
 * department.
 */
export interface WordPressJob {
  id: number;
  date?: string | null;
  modified?: string | null;
  link: string;
  title?: { rendered?: string | null } | null;
  content?: { rendered?: string | null } | null;
  /** Added by fetchRaw: resolved term names. */
  _regions?: string[];
  _categories?: string[];
  _scopes?: string[];
  _board?: string;
}

interface Term {
  id: number;
  name: string;
}

const MAX_PAGES = 10;
const PER_PAGE = 100;
/** Taxonomies themes commonly attach to a job post type (missing ones are ignored). */
const TAXONOMIES = {
  regions: ["region", "job-location", "job_location"],
  categories: ["job-category", "job_category"],
  scopes: ["jobscope", "job-type", "job_type"],
};

export function parseWordPressBoard(boardId: string): { host: string; postType: string } {
  const [host, postType = "job"] = boardId.split("/");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || !/^[a-z0-9_-]+$/i.test(postType)) {
    throw new Error(`WordPress boardId must be "<host>" or "<host>/<postType>", got "${boardId}"`);
  }
  return { host: host.toLowerCase(), postType };
}

const opts = (fetchImpl?: typeof fetch) => ({ fetchImpl, minIntervalMs: 1_000 });

async function terms(host: string, taxonomy: string, fetchImpl?: typeof fetch): Promise<Map<number, string>> {
  try {
    const list = await requestJson<Term[]>(
      `https://${host}/wp-json/wp/v2/${taxonomy}?per_page=100&_fields=id,name`,
      `WordPress ${host} ${taxonomy}`,
      { ...opts(fetchImpl), retries: 0 },
    );
    return new Map((Array.isArray(list) ? list : []).map((t) => [t.id, htmlToText(t.name)]));
  } catch {
    return new Map();
  }
}

export const wordpressAdapter: AtsAdapter<WordPressJob> = {
  provider: "WORDPRESS",
  async fetchRaw({ boardId, fetchImpl }) {
    const { host, postType } = parseWordPressBoard(boardId);
    const posts: (WordPressJob & Record<string, unknown>)[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await requestJson<(WordPressJob & Record<string, unknown>)[]>(
        `https://${host}/wp-json/wp/v2/${postType}?per_page=${PER_PAGE}&page=${page}`,
        `WordPress ${host}`,
        opts(fetchImpl),
      ).catch((e: Error) => {
        // WordPress answers 400 for a page past the end.
        if (page > 1 && /HTTP 400/.test(e.message)) return [];
        throw e;
      });
      if (!Array.isArray(batch)) throw new Error(`WordPress ${host}: unexpected response`);
      posts.push(...batch);
      if (batch.length < PER_PAGE) break;
    }
    const resolved: Record<keyof typeof TAXONOMIES, { key: string; names: Map<number, string> }[]> = {
      regions: [],
      categories: [],
      scopes: [],
    };
    for (const [field, taxes] of Object.entries(TAXONOMIES) as [keyof typeof TAXONOMIES, string[]][]) {
      for (const tax of taxes) {
        if (!posts.some((p) => Array.isArray(p[tax]) && (p[tax] as unknown[]).length)) continue;
        resolved[field].push({ key: tax, names: await terms(host, tax, fetchImpl) });
      }
    }
    const names = (p: Record<string, unknown>, field: keyof typeof TAXONOMIES) =>
      resolved[field].flatMap(({ key, names: m }) =>
        ((p[key] as number[] | undefined) ?? []).map((id) => m.get(id)).filter((n): n is string => !!n),
      );
    return posts.map((p) => ({
      id: p.id,
      date: p.date,
      modified: p.modified,
      link: p.link,
      title: p.title,
      content: p.content,
      _regions: names(p, "regions"),
      _categories: names(p, "categories"),
      _scopes: names(p, "scopes"),
      _board: host,
    }));
  },
  // Only Israeli company sites are configured with this provider.
  isInIsrael: () => true,
  normalize(raw) {
    const title = htmlToText(raw.title?.rendered ?? "");
    // A city in the title is the most specific; a post tagged with many regions is effectively "Israel".
    const regions = (raw._regions ?? []).length === 1 ? raw._regions! : [];
    return buildJob({
      externalId: `${raw._board ?? "wordpress"}:${raw.id}`,
      source: "WORDPRESS",
      title,
      locations: [title, ...regions, "Israel"],
      descriptionHtmlOrText:
        raw.content?.rendered || [raw._categories?.join(", "), raw._scopes?.join(", ")].filter(Boolean).join("\n"),
      applyUrl: raw.link,
      postedAt: raw.date,
      updatedAt: raw.modified ?? raw.date,
      commitmentHint: raw._scopes?.join(" "),
      department: raw._categories?.[0] ?? null,
    });
  },
};
