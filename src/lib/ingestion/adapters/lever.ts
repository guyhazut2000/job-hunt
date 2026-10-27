import { buildJob } from "../normalize";
import type { AtsAdapter } from "../types";

/** Public Lever Postings API: https://github.com/lever/postings-api */
export interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: "onsite" | "remote" | "hybrid" | "unspecified";
  categories?: { location?: string; team?: string; commitment?: string };
  descriptionPlain?: string;
  description?: string;
  lists?: { text: string; content: string }[];
}

export const leverAdapter: AtsAdapter<LeverPosting> = {
  provider: "LEVER",
  async fetchRaw({ boardId, fetchImpl = fetch }) {
    const res = await fetchImpl(`https://api.lever.co/v0/postings/${encodeURIComponent(boardId)}?mode=json`);
    if (!res.ok) throw new Error(`Lever ${boardId}: HTTP ${res.status}`);
    return (await res.json()) as LeverPosting[];
  },
  normalize(raw) {
    const lists = (raw.lists ?? []).map((l) => `${l.text}\n${l.content}`).join("\n");
    return buildJob({
      externalId: raw.id,
      source: "LEVER",
      title: raw.text,
      location: raw.categories?.location,
      descriptionHtmlOrText: `${raw.descriptionPlain ?? raw.description ?? ""}\n${lists}`,
      applyUrl: raw.hostedUrl ?? raw.applyUrl,
      postedAt: raw.createdAt,
      workModeHint: raw.workplaceType,
    });
  },
};
