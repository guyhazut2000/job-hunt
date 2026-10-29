import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * iCIMS "Jibe" careers sites (e.g. jobs.booking.com). The site's search page reads a public JSON
 * endpoint that already includes the full description:
 *
 *   GET https://<host>/api/jobs?location=Israel&page=<n>&limit=100
 *
 * boardId = "<host>", e.g. "jobs.booking.com". Only postings whose country is IL are kept.
 */
export interface JibeJob {
  slug: string;
  req_id?: string | null;
  title: string;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  country_code?: string | null;
  full_location?: string | null;
  categories?: { name?: string | null }[] | null;
  employment_type?: string | null;
  posted_date?: string | null;
  update_date?: string | null;
  apply_url?: string | null;
  meta_data?: { canonical_url?: string | null } | null;
  _board?: string;
}

const PAGE = 100;
const MAX_PAGES = 10;

export function parseJibeBoard(boardId: string) {
  const host = boardId.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw new Error(`Jibe boardId must be a host, got "${boardId}"`);
  return { host, base: `https://${host}` };
}

export const jibeAdapter: AtsAdapter<JibeJob> = {
  provider: "JIBE",
  async fetchRaw(ctx: AdapterContext) {
    const { base } = parseJibeBoard(ctx.boardId);
    const out: JibeJob[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await requestJson<{ jobs?: { data: JibeJob }[]; totalCount?: number }>(
        `${base}/api/jobs?location=Israel&page=${page}&limit=${PAGE}`,
        `Jibe ${ctx.boardId}`,
        { minIntervalMs: 800, timeoutMs: 20_000, fetchImpl: ctx.fetchImpl },
      );
      const list = (body.jobs ?? []).map((j) => ({ ...j.data, _board: ctx.boardId }));
      out.push(...list);
      if (list.length < PAGE || out.length >= (body.totalCount ?? 0)) break;
    }
    return out;
  },
  isInIsrael(raw) {
    return raw.country_code === "IL" || isIsraelLocation(raw.full_location ?? raw.country);
  },
  normalize(raw) {
    if (!raw._board) return null;
    const { host, base } = parseJibeBoard(raw._board);
    const canonical = raw.meta_data?.canonical_url?.replace(/\?.*$/, "");
    return buildJob({
      externalId: `${host}:${raw.req_id || raw.slug}`,
      source: "JIBE",
      title: raw.title,
      locations: [raw.city ? `${raw.city}, Israel` : (raw.full_location ?? "Israel")],
      descriptionHtmlOrText: raw.description ?? "",
      applyUrl: canonical?.startsWith(base) ? canonical : `${base}/jobs/${encodeURIComponent(raw.slug)}`,
      postedAt: raw.posted_date,
      updatedAt: raw.update_date ?? raw.posted_date,
      commitmentHint: raw.employment_type,
      department: raw.categories?.[0]?.name ?? null,
    });
  },
};
