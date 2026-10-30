import { requestText } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * SAP SuccessFactors Career Site Builder sites (e.g. jobs.teradyne.com). No JSON API is public, so we
 * read the same public HTML the site serves to everyone, only on paths robots.txt allows:
 *
 *   list:   GET https://<host>/search/?q=&locationsearch=Israel&startrow=<n>   (25 rows a page)
 *   detail: GET https://<host>/<Company>/job/<slug>/<id>/                       (schema.org microdata)
 *
 * The RSS feed (/services/) and apply pages (/talentcommunity/, /applybutton/) are disallowed by
 * robots.txt and never requested. Detail pages are fetched only for postings we haven't stored yet.
 * boardId = "<host>".
 */
export interface SuccessFactorsJob {
  id: string;
  path: string;
  title: string;
  location: string;
  department: string | null;
  description?: string;
  postedAt?: string | null;
  _board?: string;
}

const PAGE = 25;
const MAX_PAGES = 8;
const OPTS = { minIntervalMs: 1_500, timeoutMs: 20_000 };

export function parseSuccessFactorsBoard(boardId: string) {
  const host = boardId.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host))
    throw new Error(`SuccessFactors boardId must be a host, got "${boardId}"`);
  return { host, base: `https://${host}` };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const decode = (t: string) =>
  t
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z#0-9]+);/gi, (m, k) => ENTITIES[k.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

/** Rows of the search results table. Pure — exported for tests. */
export function parseSearchPage(html: string): { jobs: SuccessFactorsJob[]; total: number | null } {
  const jobs: SuccessFactorsJob[] = [];
  const seen = new Set<string>();
  for (const row of html.split(/<tr class="data-row[^"]*"/).slice(1)) {
    const body = row.slice(0, row.indexOf("</tr>") >= 0 ? row.indexOf("</tr>") : undefined);
    const link =
      body.match(/<a[^>]*href="(\/[^"]+\/job\/[^"]+\/(\d+)\/)"[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/) ??
      body.match(/<a[^>]*class="jobTitle-link"[^>]*href="(\/[^"]+\/job\/[^"]+\/(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link || seen.has(link[2])) continue;
    seen.add(link[2]);
    const location = body.match(/<span class="jobLocation">([\s\S]*?)<\/span>/)?.[1];
    const department = body.match(/<span class="jobDepartment">([\s\S]*?)<\/span>/)?.[1];
    jobs.push({
      id: link[2],
      path: link[1],
      title: decode(link[3]),
      location: decode(location ?? ""),
      department: department ? decode(department) || null : null,
    });
  }
  const total = html.match(/paginationLabel[^>]*>[\s\S]*?of\s*<b>\s*(\d+)\s*<\/b>/)?.[1];
  return { jobs, total: total ? Number(total) : null };
}

/** Description and posting date from a job page's schema.org microdata. Pure — exported for tests. */
export function parseJobPage(html: string): { description: string; postedAt: string | null } {
  const start = html.search(/<span itemprop="description"[^>]*>/);
  let description = "";
  if (start >= 0) {
    const from = html.indexOf(">", start) + 1;
    const end = html.indexOf("</div>", from);
    description = html.slice(from, end > from ? end : undefined).replace(/<strong>\s*Job Segment:[\s\S]*$/i, "");
  }
  const posted = html.match(/<meta itemprop="datePosted" content="([^"]+)"/)?.[1] ?? null;
  // "Fri Oct 02 00:00:00 UTC 2026" (Java Date#toString) — reorder so the zone is honoured.
  const m = posted?.match(/^\w{3} (\w{3}) (\d{1,2}) (\d{2}:\d{2}:\d{2}) UTC (\d{4})$/);
  const ts = m ? Date.parse(`${m[2]} ${m[1]} ${m[4]} ${m[3]} GMT`) : posted ? Date.parse(posted) : NaN;
  return { description, postedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : null };
}

export const successFactorsAdapter: AtsAdapter<SuccessFactorsJob> = {
  provider: "SUCCESSFACTORS",
  async fetchRaw(ctx: AdapterContext) {
    const { base } = parseSuccessFactorsBoard(ctx.boardId);
    const out: SuccessFactorsJob[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const html = await requestText(
        `${base}/search/?q=&locationsearch=Israel&startrow=${page * PAGE}`,
        `SuccessFactors ${ctx.boardId}`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      const { jobs, total } = parseSearchPage(html);
      const fresh = jobs.filter((j) => !out.some((o) => o.id === j.id));
      out.push(...fresh.map((j) => ({ ...j, _board: ctx.boardId })));
      if (jobs.length < PAGE || !fresh.length || (total !== null && out.length >= total)) break;
    }
    return out;
  },
  isInIsrael(raw) {
    return /,\s*IL\s*$/.test(raw.location) || isIsraelLocation(raw.location);
  },
  detail: {
    externalId: (raw, ctx) => `${parseSuccessFactorsBoard(ctx.boardId).host}:${raw.id}`,
    async fetch(raw, ctx) {
      const { base } = parseSuccessFactorsBoard(ctx.boardId);
      const html = await requestText(`${base}${raw.path}`, `SuccessFactors ${ctx.boardId}/${raw.id}`, {
        ...OPTS,
        fetchImpl: ctx.fetchImpl,
      });
      return { ...raw, ...parseJobPage(html) };
    },
  },
  normalize(raw) {
    if (!raw._board) return null;
    const { host, base } = parseSuccessFactorsBoard(raw._board);
    const city = raw.location.replace(/,\s*IL\s*$/, "").trim();
    return buildJob({
      externalId: `${host}:${raw.id}`,
      source: "SUCCESSFACTORS",
      title: raw.title,
      locations: [city ? `${city}, Israel` : "Israel"],
      descriptionHtmlOrText: raw.description ?? "",
      applyUrl: `${base}${raw.path}`,
      postedAt: raw.postedAt,
      department: raw.department,
    });
  },
};
