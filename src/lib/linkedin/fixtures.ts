import { createHash } from "node:crypto";
import type { SearchResult } from "@/lib/people/parse";

/**
 * Synthetic Brave results for the local mock provider (PEOPLE_SEARCH_MOCK=1) and tests.
 * Fake ids only. About 1 in 4 jobs gets "no exact posting" so both UI states show up.
 */
export function fixtureJobResults(title: string, company: string): { results: SearchResult[]; hasMore: boolean } {
  const h = createHash("sha256").update(`${title}|${company}`).digest("hex");
  const id = String(4000000000 + (parseInt(h.slice(0, 8), 16) % 99999999));
  const noise: SearchResult[] = [
    {
      title: `${company} jobs in Israel | LinkedIn`,
      url: `https://il.linkedin.com/jobs/${company.toLowerCase().replace(/\W+/g, "-")}-jobs`,
      description: "Today's top jobs (fixture).",
    },
    {
      title: `Unrelated Systems hiring Office Manager in Haifa, Israel | LinkedIn`,
      url: `https://il.linkedin.com/jobs/view/office-manager-at-unrelated-systems-${Number(id) + 1}`,
      description: "Fixture noise result.",
    },
  ];
  if (parseInt(h.slice(8, 10), 16) % 4 === 0) return { results: noise, hasMore: false };
  return {
    results: [
      {
        title: `${company} hiring ${title} in Tel Aviv-Yafo, Tel Aviv District, Israel | LinkedIn`,
        url: `https://il.linkedin.com/jobs/view/${title.toLowerCase().replace(/\W+/g, "-")}-at-${company.toLowerCase().replace(/\W+/g, "-")}-${id}?trk=fixture`,
        description: `Posted 3:12:00 AM. ${company} is looking for a ${title} (fixture).`,
      },
      ...noise,
    ],
    hasMore: false,
  };
}
