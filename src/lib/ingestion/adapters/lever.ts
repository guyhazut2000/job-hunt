import { getJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AtsAdapter } from "../types";

/** Public Lever Postings API: https://github.com/lever/postings-api */
export interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  updatedAt?: number;
  country?: string | null;
  workplaceType?: "onsite" | "remote" | "hybrid" | "unspecified";
  categories?: { location?: string; allLocations?: string[]; team?: string; commitment?: string };
  descriptionPlain?: string;
  description?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
}

/** boardId "acme" → global instance; "eu:acme" → Lever's EU instance. */
export function leverUrl(boardId: string): string {
  const [host, site] = boardId.startsWith("eu:") ? ["api.eu.lever.co", boardId.slice(3)] : ["api.lever.co", boardId];
  return `https://${host}/v0/postings/${encodeURIComponent(site)}?mode=json`;
}

const locations = (raw: LeverPosting) => [raw.categories?.location, ...(raw.categories?.allLocations ?? [])];

export const leverAdapter: AtsAdapter<LeverPosting> = {
  provider: "LEVER",
  async fetchRaw({ boardId, fetchImpl = fetch }) {
    return getJson<LeverPosting[]>(leverUrl(boardId), `Lever ${boardId}`, fetchImpl);
  },
  isInIsrael(raw) {
    return raw.country === "IL" || locations(raw).some((l) => isIsraelLocation(l));
  },
  normalize(raw) {
    const lists = (raw.lists ?? []).map((l) => `${l.text}\n${l.content}`).join("\n");
    const israeli = locations(raw).filter((l) => isIsraelLocation(l));
    return buildJob({
      externalId: raw.id,
      source: "LEVER",
      title: raw.text,
      locations: israeli.length ? israeli : [raw.categories?.location ?? (raw.country === "IL" ? "Israel" : null)],
      descriptionHtmlOrText: `${raw.descriptionPlain ?? raw.description ?? ""}\n${lists}\n${raw.additionalPlain ?? ""}`,
      applyUrl: raw.hostedUrl ?? raw.applyUrl,
      postedAt: raw.createdAt,
      workModeHint: raw.workplaceType === "unspecified" ? null : raw.workplaceType,
      commitmentHint: raw.categories?.commitment,
      updatedAt: raw.updatedAt ?? raw.createdAt,
    });
  },
};
