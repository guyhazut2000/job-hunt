import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * Oracle Recruiting Cloud ("Candidate Experience") careers sites, e.g. Oracle
 * (careers.oracle.com → eeho.fa.us2.oraclecloud.com, site CX_45001), Verint and Dell. The site's own
 * search page reads the public, unauthenticated REST resources used here:
 *
 *  - list:   /hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber=<site>,…
 *  - detail: /hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?finder=ById;Id="<id>",siteNumber=<site>
 *
 * boardId = "<host>/<siteNumber>", e.g. "eeho.fa.us2.oraclecloud.com/CX_45001". A first call reads the
 * site's location facets and picks the "Israel" country value; the list is then filtered server-side
 * with that location id, 25 at a time.
 */
export interface OracleRequisition {
  Id: string;
  Title: string;
  PostedDate?: string | null;
  PrimaryLocation?: string | null;
  PrimaryLocationCountry?: string | null;
  WorkplaceType?: string | null;
  secondaryLocations?: { Name?: string | null; CountryCode?: string | null }[] | null;
  /** Detail fields. */
  ExternalPostedStartDate?: string | null;
  ExternalDescriptionStr?: string | null;
  ExternalResponsibilitiesStr?: string | null;
  ExternalQualificationsStr?: string | null;
  JobSchedule?: string | null;
  JobFamily?: string | null;
  Organization?: string | null;
  _board?: string;
  _detail?: boolean;
}

interface ListResponse {
  items?: {
    TotalJobsCount?: number;
    requisitionList?: OracleRequisition[];
    locationsFacet?: { Id: number | string; Name: string; TotalCount?: number }[];
  }[];
}

const PAGE = 25;
const MAX_PAGES = 20;
const OPTS = { minIntervalMs: 800, timeoutMs: 25_000 };
const API = "/hcmRestApi/resources/latest";

export function parseOracleBoard(boardId: string) {
  const [host, site] = boardId.split("/");
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || !site || !/^[A-Za-z0-9_]+$/.test(site)) {
    throw new Error(`Oracle HCM boardId must be "<host>/<siteNumber>", got "${boardId}"`);
  }
  return { host, site, base: `https://${host}` };
}

const listUrl = (base: string, site: string, finder: string) =>
  `${base}${API}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations` +
  `&finder=findReqs;siteNumber=${site},${finder}`;

export const oracleHcmAdapter: AtsAdapter<OracleRequisition> = {
  provider: "ORACLE_HCM",
  async fetchRaw(ctx: AdapterContext) {
    const { base, site } = parseOracleBoard(ctx.boardId);
    const get = (finder: string) =>
      requestJson<ListResponse>(listUrl(base, site, finder), `Oracle HCM ${ctx.boardId}`, {
        ...OPTS,
        fetchImpl: ctx.fetchImpl,
      });
    const probe = await get("facetsList=LOCATIONS,limit=1,offset=0,location=Israel");
    const israel = probe.items?.[0]?.locationsFacet?.find((f) => /^israel$/i.test(f.Name.trim()));
    if (!israel) return []; // the site lists no Israeli location
    const out: OracleRequisition[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await get(`limit=${PAGE},offset=${page * PAGE},locationId=${israel.Id}`);
      const item = body.items?.[0];
      const list = item?.requisitionList ?? [];
      out.push(...list.map((r) => ({ ...r, _board: ctx.boardId })));
      if (list.length < PAGE || out.length >= (item?.TotalJobsCount ?? 0)) break;
    }
    return out;
  },
  isInIsrael(raw) {
    return (
      raw.PrimaryLocationCountry === "IL" ||
      isIsraelLocation(raw.PrimaryLocation) ||
      (raw.secondaryLocations ?? []).some((l) => l.CountryCode === "IL" || isIsraelLocation(l.Name))
    );
  },
  detail: {
    externalId: (raw, ctx) => `${parseOracleBoard(ctx.boardId).host}:${raw.Id}`,
    async fetch(raw, ctx) {
      const { base, site } = parseOracleBoard(ctx.boardId);
      const d = await requestJson<{ items?: Partial<OracleRequisition>[] }>(
        `${base}${API}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true` +
          `&finder=ById;Id=%22${encodeURIComponent(raw.Id)}%22,siteNumber=${site}`,
        `Oracle HCM ${ctx.boardId} detail`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      const item = d.items?.[0];
      // Keep the list's location fields: the detail's secondaryLocations has another shape.
      return item ? { ...raw, ...item, secondaryLocations: raw.secondaryLocations, _detail: true } : raw;
    },
  },
  normalize(raw) {
    if (!raw._board) return null;
    const { host, site, base } = parseOracleBoard(raw._board);
    const locs = [raw.PrimaryLocation, ...(raw.secondaryLocations ?? []).map((l) => l.Name)];
    const israeli = locs.filter((l) => isIsraelLocation(l));
    const description = [raw.ExternalDescriptionStr, raw.ExternalResponsibilitiesStr, raw.ExternalQualificationsStr]
      .filter(Boolean)
      .join("\n");
    const posted = raw.ExternalPostedStartDate ?? raw.PostedDate;
    return buildJob({
      externalId: `${host}:${raw.Id}`,
      source: "ORACLE_HCM",
      title: raw.Title,
      locations: israeli.length ? israeli : ["Israel"],
      descriptionHtmlOrText: description,
      applyUrl: `${base}/hcmUI/CandidateExperience/en/sites/${site}/job/${encodeURIComponent(raw.Id)}`,
      postedAt: posted,
      updatedAt: posted,
      workModeHint: raw.WorkplaceType,
      commitmentHint: raw.JobSchedule,
      department: raw.Organization ?? raw.JobFamily,
    });
  },
};
