import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * SmartRecruiters public Posting API (https://developers.smartrecruiters.com/docs/posting-api) —
 * boardId = company identifier (e.g. "Wix2"). The list endpoint has no description, so the runner
 * fetches `/postings/<id>` for postings it has not stored yet.
 */
export interface SmartRecruitersPosting {
  id: string;
  name: string;
  releasedDate?: string | null;
  location?: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    remote?: boolean;
    hybrid?: boolean;
    fullLocation?: string | null;
  };
  department?: { label?: string | null } | null;
  typeOfEmployment?: { label?: string | null } | null;
  company?: { identifier?: string } | null;
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string } | undefined> };
}

const API = "https://api.smartrecruiters.com/v1/companies";
const PAGE = 100;
const MAX_PAGES = 10;
const OPTS = { minIntervalMs: 400 };

const company = (ctx: AdapterContext) => encodeURIComponent(ctx.boardId);

export const smartRecruitersAdapter: AtsAdapter<SmartRecruitersPosting> = {
  provider: "SMARTRECRUITERS",
  async fetchRaw(ctx) {
    const out: SmartRecruitersPosting[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await requestJson<{ totalFound?: number; content?: SmartRecruitersPosting[] }>(
        `${API}/${company(ctx)}/postings?country=il&limit=${PAGE}&offset=${page * PAGE}`,
        `SmartRecruiters ${ctx.boardId}`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      const content = body.content ?? [];
      out.push(...content);
      if (content.length < PAGE || out.length >= (body.totalFound ?? 0)) break;
    }
    return out;
  },
  isInIsrael(raw) {
    const l = raw.location;
    return l?.country?.toLowerCase() === "il" || isIsraelLocation(l?.fullLocation) || isIsraelLocation(l?.city);
  },
  detail: {
    externalId: (raw) => raw.id,
    async fetch(raw, ctx) {
      const d = await requestJson<SmartRecruitersPosting>(
        `${API}/${company(ctx)}/postings/${encodeURIComponent(raw.id)}`,
        `SmartRecruiters ${ctx.boardId}/${raw.id}`,
        { ...OPTS, fetchImpl: ctx.fetchImpl },
      );
      return { ...raw, ...d };
    },
  },
  normalize(raw) {
    const s = raw.jobAd?.sections ?? {};
    const description = ["jobDescription", "qualifications", "additionalInformation", "companyDescription"]
      .map((k) => s[k])
      .filter((x) => x?.text)
      .map((x) => `<h3>${x?.title ?? ""}</h3>${x?.text}`)
      .join("\n");
    const l = raw.location;
    const ident = raw.company?.identifier;
    return buildJob({
      externalId: raw.id,
      source: "SMARTRECRUITERS",
      title: raw.name,
      locations: [l?.fullLocation, l?.city, l?.country?.toLowerCase() === "il" ? "Israel" : null],
      descriptionHtmlOrText: description,
      applyUrl: raw.postingUrl ?? (ident ? `https://jobs.smartrecruiters.com/${ident}/${raw.id}` : ""),
      postedAt: raw.releasedDate,
      updatedAt: raw.releasedDate,
      workModeHint: l?.remote ? "remote" : l?.hybrid ? "hybrid" : null,
      commitmentHint: raw.typeOfEmployment?.label,
      department: raw.department?.label,
    });
  },
};
