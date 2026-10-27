import { getJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob, pickStatedPay } from "../normalize";
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
  departments?: { name?: string }[];
  content?: string;
  /** Present with `pay_transparency=true`; amounts in cents, annual base pay. */
  pay_input_ranges?: { min_cents?: number; max_cents?: number; currency_type?: string; title?: string }[];
}

const locations = (raw: GreenhouseJob) => [
  raw.location?.name,
  ...(raw.offices ?? []).flatMap((o) => [o.location ?? undefined, o.name]),
];

export const greenhouseAdapter: AtsAdapter<GreenhouseJob> = {
  provider: "GREENHOUSE",
  async fetchRaw({ boardId, fetchImpl = fetch }) {
    const body = await getJson<{ jobs?: GreenhouseJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardId)}/jobs?content=true&pay_transparency=true`,
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
    const all = locations(raw).filter((l): l is string => !!l?.trim());
    const israeli = all.filter((l) => isIsraelLocation(l));
    const allIsraeli =
      isIsraelLocation(raw.location?.name) &&
      (raw.offices ?? []).every((o) => isIsraelLocation(`${o.name} ${o.location ?? ""}`));
    return buildJob({
      externalId: raw.id,
      source: "GREENHOUSE",
      title: raw.title,
      locations: israeli.length ? israeli : [raw.location?.name],
      descriptionHtmlOrText: raw.content ?? "",
      applyUrl: raw.absolute_url,
      postedAt: raw.first_published ?? raw.updated_at,
      workModeHint: raw.location?.name,
      updatedAt: raw.updated_at,
      department: raw.departments?.[0]?.name,
      pay: pickStatedPay(
        (raw.pay_input_ranges ?? []).map((r) => ({
          min: (r.min_cents ?? 0) / 100,
          max: (r.max_cents ?? 0) / 100,
          currency: r.currency_type ?? "",
          period: "year" as const,
          label: r.title,
        })),
        allIsraeli,
      ),
    });
  },
};
