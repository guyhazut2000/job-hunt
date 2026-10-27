import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AtsAdapter } from "../types";

/** Workable public careers widget API (apply.workable.com/api/v1/widget/accounts/<account>) — boardId = account. */
export interface WorkableJob {
  title: string;
  shortcode: string;
  employment_type?: string | null;
  telecommuting?: boolean;
  department?: string | null;
  url: string;
  application_url?: string;
  published_on?: string | null;
  created_at?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  locations?: { country?: string | null; countryCode?: string | null; city?: string | null; region?: string | null }[];
  description?: string | null;
}

// The region ("Tel Aviv District") is only used when there is no city, so it doesn't read as a second city.
const place = (city?: string | null, region?: string | null, country?: string | null) =>
  [city || region, country].filter(Boolean).join(", ");
const places = (raw: WorkableJob) => [
  place(raw.city, raw.state, raw.country),
  ...(raw.locations ?? []).map((l) => place(l.city, l.region, l.country)),
];

export const workableAdapter: AtsAdapter<WorkableJob> = {
  provider: "WORKABLE",
  async fetchRaw({ boardId, fetchImpl }) {
    const body = await requestJson<{ jobs?: WorkableJob[] }>(
      `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(boardId)}?details=true`,
      `Workable ${boardId}`,
      { fetchImpl, minIntervalMs: 1_000 },
    );
    return body.jobs ?? [];
  },
  isInIsrael(raw) {
    return (raw.locations ?? []).some((l) => l.countryCode === "IL") || places(raw).some((l) => isIsraelLocation(l));
  },
  normalize(raw) {
    const israeli = places(raw).filter((l) => isIsraelLocation(l));
    return buildJob({
      externalId: raw.shortcode,
      source: "WORKABLE",
      title: raw.title,
      locations: israeli.length ? israeli : ["Israel"],
      descriptionHtmlOrText: raw.description ?? "",
      applyUrl: raw.url ?? raw.application_url ?? "",
      postedAt: raw.published_on ?? raw.created_at,
      updatedAt: raw.published_on ?? raw.created_at,
      workModeHint: raw.telecommuting ? "remote" : null,
      commitmentHint: raw.employment_type,
      department: raw.department,
    });
  },
};
