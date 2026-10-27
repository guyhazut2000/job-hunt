import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob, payPeriodOf, pickStatedPay } from "../normalize";
import type { AtsAdapter } from "../types";

/** Recruitee public Careers Site API (https://<company>.recruitee.com/api/offers/) — boardId = subdomain. */
export interface RecruiteeOffer {
  id: number;
  title: string;
  description?: string | null;
  requirements?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  locations?: { city?: string | null; country?: string | null; country_code?: string | null; name?: string | null }[];
  department?: string | null;
  employment_type_code?: string | null;
  remote?: boolean;
  published_at?: string | null;
  updated_at?: string | null;
  careers_url: string;
  salary?: {
    min?: string | number | null;
    max?: string | number | null;
    period?: string | null;
    currency?: string | null;
  } | null;
  /** Added by fetchRaw: the board's subdomain (ids are only unique per company). */
  _board?: string;
}

const places = (raw: RecruiteeOffer) => [
  raw.location,
  [raw.city, raw.country].filter(Boolean).join(", "),
  ...(raw.locations ?? []).map((l) => [l.name, l.city, l.country].filter(Boolean).join(", ")),
];

export const recruiteeAdapter: AtsAdapter<RecruiteeOffer> = {
  provider: "RECRUITEE",
  async fetchRaw({ boardId, fetchImpl }) {
    if (!/^[a-z0-9-]+$/i.test(boardId)) throw new Error(`Recruitee boardId must be a subdomain, got "${boardId}"`);
    const body = await requestJson<{ offers?: RecruiteeOffer[] }>(
      `https://${boardId}.recruitee.com/api/offers/`,
      `Recruitee ${boardId}`,
      { fetchImpl, minIntervalMs: 1_000 },
    );
    return (body.offers ?? []).map((o) => ({ ...o, _board: boardId }));
  },
  isInIsrael(raw) {
    return (
      raw.country_code === "IL" ||
      (raw.locations ?? []).some((l) => l.country_code === "IL") ||
      places(raw).some((l) => isIsraelLocation(l))
    );
  },
  normalize(raw) {
    const israeli = places(raw).filter((l) => isIsraelLocation(l));
    const s = raw.salary;
    const period = payPeriodOf(s?.period);
    const allIsraeli =
      raw.country_code === "IL" && (raw.locations ?? []).every((l) => !l.country_code || l.country_code === "IL");
    return buildJob({
      externalId: `${raw._board ?? "recruitee"}:${raw.id}`,
      source: "RECRUITEE",
      title: raw.title,
      locations: israeli.length ? israeli : ["Israel"],
      descriptionHtmlOrText: `${raw.description ?? ""}\n${raw.requirements ?? ""}`,
      applyUrl: raw.careers_url,
      postedAt: raw.published_at,
      updatedAt: raw.updated_at ?? raw.published_at,
      workModeHint: raw.remote ? "remote" : null,
      commitmentHint: raw.employment_type_code,
      department: raw.department,
      pay:
        s && period
          ? pickStatedPay(
              [{ min: Number(s.min) || 0, max: Number(s.max) || 0, currency: s.currency ?? "", period }],
              allIsraeli,
            )
          : null,
    });
  },
};
