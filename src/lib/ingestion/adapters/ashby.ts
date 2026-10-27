import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob, payPeriodOf, pickStatedPay, type PayCandidate } from "../normalize";
import type { AtsAdapter } from "../types";

/** Ashby public Job Posting API: https://developers.ashbyhq.com/docs/public-job-posting-api — boardId = org slug. */
export interface AshbyJob {
  id: string;
  title: string;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  location?: string | null;
  secondaryLocations?: { location?: string | null; address?: AshbyAddress | null }[];
  publishedAt?: string | null;
  updatedAt?: string | null;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  address?: AshbyAddress | null;
  jobUrl: string;
  applyUrl?: string;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  compensation?: {
    compensationTiers?: {
      title?: string | null;
      components?: {
        compensationType?: string;
        interval?: string;
        currencyCode?: string | null;
        minValue?: number | null;
        maxValue?: number | null;
      }[];
    }[];
  } | null;
}
interface AshbyAddress {
  postalAddress?: { addressCountry?: string | null; addressLocality?: string | null; addressRegion?: string | null };
}

const addr = (a?: AshbyAddress | null) =>
  [a?.postalAddress?.addressLocality, a?.postalAddress?.addressRegion, a?.postalAddress?.addressCountry]
    .filter(Boolean)
    .join(", ");
const locations = (raw: AshbyJob) => [
  raw.location,
  addr(raw.address),
  ...(raw.secondaryLocations ?? []).flatMap((l) => [l.location, addr(l.address)]),
];

export const ashbyAdapter: AtsAdapter<AshbyJob> = {
  provider: "ASHBY",
  async fetchRaw({ boardId, fetchImpl }) {
    const body = await requestJson<{ jobs?: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardId)}?includeCompensation=true`,
      `Ashby ${boardId}`,
      { fetchImpl, minIntervalMs: 500 },
    );
    return (body.jobs ?? []).filter((j) => j.isListed !== false);
  },
  isInIsrael(raw) {
    return locations(raw).some((l) => isIsraelLocation(l));
  },
  normalize(raw) {
    const all = locations(raw).filter((l): l is string => !!l?.trim());
    const israeli = all.filter((l) => isIsraelLocation(l));
    const primary = [raw.location, ...(raw.secondaryLocations ?? []).map((l) => l.location)].filter(
      (l): l is string => !!l?.trim(),
    );
    const pay: PayCandidate[] = (raw.compensation?.compensationTiers ?? []).flatMap((t) =>
      (t.components ?? [])
        .filter((c) => /salary/i.test(c.compensationType ?? ""))
        .map((c) => ({
          min: c.minValue ?? 0,
          max: c.maxValue ?? 0,
          currency: c.currencyCode ?? "",
          period: payPeriodOf(c.interval) ?? "year",
          label: t.title,
        })),
    );
    return buildJob({
      externalId: raw.id,
      source: "ASHBY",
      title: raw.title,
      locations: israeli.length ? israeli : [raw.location],
      descriptionHtmlOrText: raw.descriptionHtml ?? raw.descriptionPlain ?? "",
      applyUrl: raw.jobUrl ?? raw.applyUrl ?? "",
      postedAt: raw.publishedAt,
      updatedAt: raw.updatedAt ?? raw.publishedAt,
      workModeHint: `${raw.workplaceType ?? ""} ${raw.isRemote ? "remote" : ""}`,
      commitmentHint: raw.employmentType,
      department: raw.department ?? raw.team,
      pay: pickStatedPay(
        pay,
        primary.every((l) => isIsraelLocation(l)),
      ),
    });
  },
};
