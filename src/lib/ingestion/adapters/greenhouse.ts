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
  content?: string;
}

export const greenhouseAdapter: AtsAdapter<GreenhouseJob> = {
  provider: "GREENHOUSE",
  async fetchRaw({ boardId, fetchImpl = fetch }) {
    const res = await fetchImpl(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardId)}/jobs?content=true`,
    );
    if (!res.ok) throw new Error(`Greenhouse ${boardId}: HTTP ${res.status}`);
    const body = (await res.json()) as { jobs?: GreenhouseJob[] };
    return body.jobs ?? [];
  },
  normalize(raw) {
    return buildJob({
      externalId: raw.id,
      source: "GREENHOUSE",
      title: raw.title,
      location: raw.location?.name,
      descriptionHtmlOrText: raw.content ?? "",
      applyUrl: raw.absolute_url,
      postedAt: raw.first_published ?? raw.updated_at,
    });
  },
};
