import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * Workday candidate-experience ("cxs") JSON endpoints that back every public *.myworkdayjobs.com
 * careers site. boardId = "<tenant>/<wdN>/<site>", e.g. "nvidia/wd5/NVIDIAExternalCareerSite".
 *
 * The list is filtered server-side with the site's own Israel facet (a country facet whose value is
 * "Israel", else the union of its Israeli location values), paginated 20 at a time and paced gently.
 * The list has no description, so the runner fetches `<site><externalPath>` for new postings only.
 */
export interface WorkdayPosting {
  title: string;
  externalPath: string;
  locationsText?: string | null;
  postedOn?: string | null;
  bulletFields?: string[];
  /** Added by fetchRaw: the posting matched the site's Israel facet. */
  _israel?: boolean;
  /** Added by the detail fetch. */
  jobPostingInfo?: {
    id?: string;
    title?: string;
    jobDescription?: string | null;
    location?: string | null;
    additionalLocations?: string[] | null;
    startDate?: string | null;
    postedOn?: string | null;
    timeType?: string | null;
    jobReqId?: string | null;
    country?: { descriptor?: string | null } | null;
    externalUrl?: string | null;
    remoteType?: string | null;
  };
  _board?: string;
}

interface Facet {
  facetParameter?: string;
  descriptor?: string;
  id?: string;
  count?: number;
  values?: Facet[];
}
interface ListResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
  facets?: Facet[];
}

const PAGE = 20;
const MAX_PAGES = 40; // 800 postings per site per run, far above any Israeli site today
const OPTS = { minIntervalMs: 600, timeoutMs: 25_000 };

export function parseWorkdayBoard(boardId: string) {
  const [tenant, wd, site] = boardId.split("/");
  if (!tenant || !/^wd\d+$/.test(wd ?? "") || !site) {
    throw new Error(`Workday boardId must be "tenant/wdN/site", got "${boardId}"`);
  }
  const host = `https://${tenant}.${wd}.myworkdayjobs.com`;
  return { tenant, site, host, api: `${host}/wday/cxs/${tenant}/${site}` };
}

/** Pick the facet filter that selects Israel: an exact "Israel" country value, else the Israeli location values. */
export function israelFacet(facets: Facet[] | undefined): Record<string, string[]> | null {
  const leaves: { param: string; value: Facet }[] = [];
  const walk = (list: Facet[] | undefined, param: string | undefined) => {
    for (const f of list ?? []) {
      const p = f.facetParameter ?? param;
      if (f.values?.length) walk(f.values, p);
      else if (p && f.id) leaves.push({ param: p, value: f });
    }
  };
  walk(facets, undefined);
  const exact = leaves.find((l) => /^israel$/i.test(l.value.descriptor?.trim() ?? ""));
  if (exact) return { [exact.param]: [exact.value.id!] };
  const byParam = new Map<string, string[]>();
  for (const l of leaves) {
    if (!/location/i.test(l.param) || !isIsraelLocation(l.value.descriptor)) continue;
    byParam.set(l.param, [...(byParam.get(l.param) ?? []), l.value.id!]);
  }
  const best = [...byParam.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  return best ? { [best[0]]: best[1] } : null;
}

/** "Posted Today" / "Posted Yesterday" / "Posted 5 Days Ago" / "Posted 30+ Days Ago" → a date. */
export function parsePostedOn(text: string | null | undefined, now = new Date()): Date | null {
  const t = (text ?? "").toLowerCase();
  const day = 86_400_000;
  if (/today/.test(t)) return now;
  if (/yesterday/.test(t)) return new Date(now.getTime() - day);
  const m = t.match(/(\d+)\+?\s*days?\s*ago/);
  return m ? new Date(now.getTime() - Number(m[1]) * day) : null;
}

export const workdayAdapter: AtsAdapter<WorkdayPosting> = {
  provider: "WORKDAY",
  async fetchRaw(ctx: AdapterContext) {
    const { api } = parseWorkdayBoard(ctx.boardId);
    const post = (body: object) =>
      requestJson<ListResponse>(`${api}/jobs`, `Workday ${ctx.boardId}`, {
        ...OPTS,
        method: "POST",
        body,
        fetchImpl: ctx.fetchImpl,
      });
    const probe = await post({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" });
    const appliedFacets = israelFacet(probe.facets);
    if (!appliedFacets) return []; // no Israel facet → this site has no Israeli postings we can identify
    const out: WorkdayPosting[] = [];
    let total = Infinity;
    for (let page = 0; page < MAX_PAGES && out.length < total; page++) {
      const body = await post({ appliedFacets, limit: PAGE, offset: page * PAGE, searchText: "" });
      if (page === 0) total = body.total ?? 0; // later pages may report 0
      const list = body.jobPostings ?? [];
      out.push(...list.map((p) => ({ ...p, _israel: true, _board: ctx.boardId })));
      if (list.length < PAGE) break;
    }
    return out;
  },
  isInIsrael(raw) {
    const info = raw.jobPostingInfo;
    if (info) {
      return (
        /israel/i.test(info.country?.descriptor ?? "") ||
        [info.location, ...(info.additionalLocations ?? [])].some((l) => isIsraelLocation(l))
      );
    }
    return raw._israel === true || isIsraelLocation(raw.locationsText);
  },
  detail: {
    externalId: (raw, ctx) => `${parseWorkdayBoard(ctx.boardId).tenant}:${raw.externalPath}`,
    async fetch(raw, ctx) {
      const { api } = parseWorkdayBoard(ctx.boardId);
      const d = await requestJson<{ jobPostingInfo?: WorkdayPosting["jobPostingInfo"] }>(
        `${api}${raw.externalPath}`,
        `Workday ${ctx.boardId} detail`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      return { ...raw, jobPostingInfo: d.jobPostingInfo };
    },
  },
  normalize(raw) {
    if (!raw._board) return null;
    const { tenant, site, host } = parseWorkdayBoard(raw._board);
    const info = raw.jobPostingInfo;
    const locs = [info?.location, ...(info?.additionalLocations ?? []), raw.locationsText];
    const israeli = locs.filter((l) => isIsraelLocation(l));
    return buildJob({
      externalId: `${tenant}:${raw.externalPath}`,
      source: "WORKDAY",
      title: info?.title ?? raw.title,
      locations: israeli.length ? israeli : ["Israel"],
      descriptionHtmlOrText: info?.jobDescription ?? "",
      applyUrl: info?.externalUrl ?? `${host}/${site}${raw.externalPath}`,
      postedAt: info?.startDate ?? parsePostedOn(info?.postedOn ?? raw.postedOn),
      updatedAt: info?.startDate ?? parsePostedOn(info?.postedOn ?? raw.postedOn),
      workModeHint: `${info?.remoteType ?? ""} ${locs.join(" ")}`,
      commitmentHint: info?.timeType,
    });
  },
};
