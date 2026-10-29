import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * Eightfold "PCSX" careers sites (e.g. jobs.amdocs.com, careers.qualcomm.com,
 * apply.careers.microsoft.com). Their robots.txt disallows the HTML site but explicitly allows
 * `/api/pcsx`, the JSON API the site's own search page reads, so only that is used:
 *
 *  - list:   GET https://<host>/api/pcsx/search?domain=<domain>&location=Israel&start=<n>  (10 per page)
 *  - detail: GET https://<host>/api/pcsx/position_details?position_id=<id>&domain=<domain>&hl=en
 *
 * boardId = "<host>/<domain>", e.g. "jobs.amdocs.com/amdocs.com". The location search includes
 * remote roles elsewhere, so postings are kept only when one of their locations is Israeli.
 */
export interface EightfoldPosition {
  id: number | string;
  displayJobId?: string | null;
  name: string;
  locations?: string[] | null;
  standardizedLocations?: string[] | null;
  postedTs?: number | null;
  creationTs?: number | null;
  department?: string | null;
  workLocationOption?: string | null;
  positionUrl?: string | null;
  /** From the detail call. */
  jobDescription?: string | null;
  publicUrl?: string | null;
  _board?: string;
}

const PAGE = 10;
const MAX_PAGES = 30; // 300 Israeli postings per site per run
const OPTS = { minIntervalMs: 800, timeoutMs: 20_000 };

export function parseEightfoldBoard(boardId: string) {
  const i = boardId.indexOf("/");
  const host = i > 0 ? boardId.slice(0, i) : "";
  const domain = i > 0 ? boardId.slice(i + 1) : "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new Error(`Eightfold boardId must be "<host>/<domain>", got "${boardId}"`);
  }
  return { host, domain, base: `https://${host}` };
}

/** "Ra'anana, Center District, IL" / "Israel- RAANANA (Amdocs Site)" / "IL" → Israeli? */
export function isEightfoldIsrael(loc: string | null | undefined): boolean {
  const l = (loc ?? "").trim();
  if (!l) return false;
  return /(^|,\s*)IL$/.test(l) || /^israel\b/i.test(l) || isIsraelLocation(l);
}

const toDate = (ts: number | null | undefined) => (ts ? new Date(ts * 1000) : null);

export const eightfoldAdapter: AtsAdapter<EightfoldPosition> = {
  provider: "EIGHTFOLD",
  async fetchRaw(ctx: AdapterContext) {
    const { base, domain } = parseEightfoldBoard(ctx.boardId);
    const out: EightfoldPosition[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ domain, query: "", location: "Israel", start: String(page * PAGE) });
      const body = await requestJson<{ data?: { positions?: EightfoldPosition[]; count?: number } }>(
        `${base}/api/pcsx/search?${q}`,
        `Eightfold ${ctx.boardId}`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      const list = body.data?.positions ?? [];
      out.push(...list.map((p) => ({ ...p, _board: ctx.boardId })));
      if (list.length < PAGE || out.length >= (body.data?.count ?? 0)) break;
    }
    return out;
  },
  isInIsrael(raw) {
    return [...(raw.standardizedLocations ?? []), ...(raw.locations ?? [])].some(isEightfoldIsrael);
  },
  detail: {
    externalId: (raw, ctx) => `${parseEightfoldBoard(ctx.boardId).domain}:${raw.id}`,
    async fetch(raw, ctx) {
      const { base, domain } = parseEightfoldBoard(ctx.boardId);
      const q = new URLSearchParams({ position_id: String(raw.id), domain, hl: "en" });
      const d = await requestJson<{ data?: Partial<EightfoldPosition> }>(
        `${base}/api/pcsx/position_details?${q}`,
        `Eightfold ${ctx.boardId} detail`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      return { ...raw, jobDescription: d.data?.jobDescription ?? null, publicUrl: d.data?.publicUrl ?? null };
    },
  },
  normalize(raw) {
    if (!raw._board) return null;
    const { base, domain } = parseEightfoldBoard(raw._board);
    const israeli = [...(raw.standardizedLocations ?? []), ...(raw.locations ?? [])].filter(isEightfoldIsrael);
    const path = raw.positionUrl?.startsWith("/") ? raw.positionUrl : `/careers/job/${raw.id}`;
    return buildJob({
      externalId: `${domain}:${raw.id}`,
      source: "EIGHTFOLD",
      title: raw.name,
      locations: israeli.length ? israeli.map((l) => l.replace(/,\s*IL$/, ", Israel")) : ["Israel"],
      descriptionHtmlOrText: raw.jobDescription ?? "",
      applyUrl: raw.publicUrl ?? `${base}${path}`,
      postedAt: toDate(raw.postedTs ?? raw.creationTs),
      updatedAt: toDate(raw.postedTs ?? raw.creationTs),
      workModeHint: raw.workLocationOption,
      department: raw.department,
    });
  },
};
