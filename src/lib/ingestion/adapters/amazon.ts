import { requestJson } from "../http";
import { isIsraelLocation } from "../location";
import { buildJob } from "../normalize";
import type { AdapterContext, AtsAdapter } from "../types";

/**
 * amazon.jobs (Amazon, AWS, Annapurna Labs…). Its search page reads a public JSON endpoint
 * (robots.txt only disallows /internal) that already carries the description and qualifications:
 *
 *   GET https://www.amazon.jobs/en/search.json?normalized_country_code[]=ISR&result_limit=100&offset=<n>
 *
 * boardId = the ISO-3 country code to search ("ISR").
 */
export interface AmazonJob {
  id: string;
  id_icims?: string | null;
  title: string;
  company_name?: string | null;
  city?: string | null;
  country_code?: string | null;
  location?: string | null;
  normalized_location?: string | null;
  description?: string | null;
  basic_qualifications?: string | null;
  preferred_qualifications?: string | null;
  job_category?: string | null;
  job_schedule_type?: string | null;
  job_path?: string | null;
  posted_date?: string | null;
  /** Relative ("3 days"), not used. */
  updated_time?: string | null;
}

const BASE = "https://www.amazon.jobs";
const PAGE = 100;
const MAX_PAGES = 10;

export const amazonAdapter: AtsAdapter<AmazonJob> = {
  provider: "AMAZON",
  async fetchRaw(ctx: AdapterContext) {
    const country = /^[A-Z]{3}$/.test(ctx.boardId) ? ctx.boardId : "ISR";
    const out: AmazonJob[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({
        "normalized_country_code[]": country,
        result_limit: String(PAGE),
        offset: String(page * PAGE),
        sort: "recent",
      });
      const body = await requestJson<{ jobs?: AmazonJob[]; hits?: number }>(
        `${BASE}/en/search.json?${q}`,
        "amazon.jobs",
        { minIntervalMs: 1000, timeoutMs: 20_000, fetchImpl: ctx.fetchImpl },
      );
      const list = body.jobs ?? [];
      out.push(...list);
      if (list.length < PAGE || out.length >= (body.hits ?? 0)) break;
    }
    return out;
  },
  isInIsrael(raw) {
    return raw.country_code === "ISR" || isIsraelLocation(raw.normalized_location ?? raw.location);
  },
  normalize(raw) {
    const section = (title: string, body: string | null | undefined) => (body ? `<h3>${title}</h3>${body}` : "");
    return buildJob({
      externalId: raw.id_icims || raw.id,
      source: "AMAZON",
      title: raw.title,
      locations: [raw.city ? `${raw.city}, Israel` : (raw.normalized_location ?? "Israel")],
      descriptionHtmlOrText: [
        raw.description ?? "",
        section("Basic qualifications", raw.basic_qualifications),
        section("Preferred qualifications", raw.preferred_qualifications),
      ].join("\n"),
      applyUrl: raw.job_path?.startsWith("/") ? `${BASE}${raw.job_path}` : `${BASE}/en/jobs/${raw.id_icims || raw.id}`,
      postedAt: raw.posted_date,
      // updated_time is relative ("3 days"), so the posting date stands in for it.
      updatedAt: raw.posted_date,
      commitmentHint: raw.job_schedule_type,
      department: raw.job_category,
    });
  },
};
