import { getJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AtsAdapter } from "../types";

/** Public Greenhouse Job Board API: https://developers.greenhouse.io/job-board.html */
export interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string | null }[];
  content?: string;
}

const locations = (raw: GreenhouseJob) => [
  raw.location?.name,
  ...(raw.offices ?? []).flatMap((o) => [o.location ?? undefined, o.name]),
];

export const greenhouseAdapter: AtsAdapter<GreenhouseJob> = {
  provider: "GREENHOUSE",
  async fetchRaw({ boardId, fetchImpl = fetch }) {
    const body = await getJson<{ jobs?: GreenhouseJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardId)}/jobs?content=true`,
      `Greenhouse ${boardId}`,
      fetchImpl,
    );
    return body.jobs ?? [];
  },
  isInIsrael(raw) {
    // The posting's own location wins; offices are a fallback when the location is generic (e.g. "Remote").
    if (isIsraelLocation(raw.location?.name)) return true;
    return (raw.offices ?? []).some((o) => isIsraelLocation(o.location) || isIsraelLocation(o.name));
  },
  normalize(raw) {
    const israeli = locations(raw).filter((l) => isIsraelLocation(l));
    return buildJob({
      externalId: raw.id,
      source: "GREENHOUSE",
      title: raw.title,
      locations: israeli.length ? israeli : [raw.location?.name],
      descriptionHtmlOrText: raw.content ?? "",
      applyUrl: raw.absolute_url,
      postedAt: raw.first_published ?? raw.updated_at,
      workModeHint: raw.location?.name,
    });
  },
};
