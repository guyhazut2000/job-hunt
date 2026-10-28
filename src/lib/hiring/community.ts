/**
 * Community interview reports (docs/hiring-process.md → "Community reports").
 *
 * Decision: OUTBOUND LINKS ONLY. We never fetch, scrape or call APIs of these sites — their terms forbid
 * automated access (Glassdoor, Blind, Indeed), require OAuth (Reddit API) or disallow crawling the
 * search pages in robots.txt (Geektime). The links open the site's own search for the company in the
 * user's browser; nothing from them is stored, summarized or shown as a stage. That is also why no stage
 * in the UI is ever labeled "community report" — community data is only reachable through these links.
 */
export type CommunitySourceId = "glassdoor" | "blind" | "reddit" | "indeed" | "geektime";

export interface CommunityLink {
  id: CommunitySourceId;
  /** Display name of the site (not translated). */
  site: string;
  url: string;
  /** Hebrew-language source (shown with a language hint in the UI). */
  hebrew?: boolean;
}

const enc = encodeURIComponent;

/** Search links for the company's interview reports on community sites. Pure (no network). */
export function communityLinks(companyName: string): CommunityLink[] {
  const name = companyName.replace(/\s+/g, " ").trim();
  if (!name) return [];
  return [
    { id: "glassdoor", site: "Glassdoor", url: `https://www.glassdoor.com/Search/results.htm?keyword=${enc(name)}` },
    { id: "blind", site: "Blind", url: `https://www.teamblind.com/search/${enc(`${name} interview`)}` },
    { id: "reddit", site: "Reddit", url: `https://www.reddit.com/search/?q=${enc(`"${name}" interview process`)}` },
    { id: "indeed", site: "Indeed", url: `https://www.indeed.com/companies/search?q=${enc(name)}` },
    { id: "geektime", site: "Geektime", url: `https://www.geektime.co.il/search/${enc(name)}`, hebrew: true },
  ];
}
