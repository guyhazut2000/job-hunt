import { getJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AtsAdapter } from "../types";

/**
 * Comeet public Careers API (v2). boardId format: "<companyUid>:<token>".
 * The token is issued by the company (Careers Website settings), so only add Comeet sources
 * with credentials the company provided. https://developers.comeet.com/reference/careers-api-overview
 */
export interface ComeetPosition {
  uid: string;
  name: string;
  url_active_page?: string;
  url_comeet_hosted_page?: string;
  time_updated?: string;
  workplace_type?: string;
  location?: { name?: string; city?: string; country?: string; is_remote?: boolean };
  details?: { name: string; value: string }[];
}

export const comeetAdapter: AtsAdapter<ComeetPosition> = {
  provider: "COMEET",
  async fetchRaw({ boardId, fetchImpl = fetch }) {
    const [uid, token] = boardId.split(":");
    if (!uid || !token) throw new Error(`Comeet boardId must be "uid:token", got "${boardId}"`);
    return getJson<ComeetPosition[]>(
      `https://www.comeet.co/careers-api/2.0/company/${encodeURIComponent(uid)}/positions?token=${encodeURIComponent(token)}&details=true`,
      `Comeet ${uid}`,
      fetchImpl,
    );
  },
  isInIsrael(raw) {
    const l = raw.location;
    return l?.country === "IL" || isIsraelLocation(l?.city) || isIsraelLocation(l?.name);
  },
  normalize(raw) {
    const description = (raw.details ?? []).map((d) => `${d.name}\n${d.value}`).join("\n");
    return buildJob({
      externalId: raw.uid,
      source: "COMEET",
      title: raw.name,
      locations: [raw.location?.city, raw.location?.name],
      descriptionHtmlOrText: description,
      applyUrl: raw.url_active_page ?? raw.url_comeet_hosted_page ?? "",
      postedAt: raw.time_updated,
      workModeHint: `${raw.workplace_type ?? ""} ${raw.location?.is_remote ? "remote" : ""}`,
    });
  },
};
