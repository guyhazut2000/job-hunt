import type { PeopleGroup } from "@prisma/client";
import { cleanCompanyName } from "@/lib/outreach/links";
import type { SearchResult } from "./parse";

/**
 * Synthetic search results for tests and the local mock provider (PEOPLE_SEARCH_MOCK=1).
 * Every name is invented ("Example", "Sample", …) — no real people.
 */
const FIRST = ["Dana", "Yoni", "Maya", "Avi", "Noa", "Tal", "Roni", "Eden", "Omer", "Shira", "Itai", "Lior"];
const LAST = ["Example", "Sample", "Placeholder", "Fixture", "Demo", "Testson", "Mockman", "Stubberg"];
const HE = ["נועה דוגמה", "יואב לדוגמה", "מיכל בדיקה"];

const ROLE: Record<PeopleGroup, string[]> = {
  RECRUITER: ["Senior Technical Recruiter", "Talent Acquisition Partner", "Tech Sourcer", "מגייסת טכנולוגית"],
  TEAM_LEAD: ["Backend Team Lead", "Tech Lead, Platform", "Group Lead – Data", "ראש צוות פיתוח"],
  ENGINEER: ["Senior Software Engineer", "Backend Developer", "Full Stack Engineer", "מפתח תוכנה"],
  MANAGER: ["Engineering Manager", "R&D Manager", "Director of Engineering", "מנהלת פיתוח"],
  SENIOR_MGMT: ["VP R&D", "CTO", "Head of Engineering", "סמנכ״ל טכנולוגיות"],
  FOUNDER: ["Co-Founder & CEO", "Founder", "Co-Founder & CTO", "מנכ״ל ומייסד"],
};
const CITY = ["Tel Aviv-Yafo", "Herzliya", "Haifa", "Jerusalem", "Ramat Gan"];

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

export function fixtureResults(
  company: string,
  group: PeopleGroup,
  page = 0,
): { results: SearchResult[]; hasMore: boolean } {
  const co = cleanCompanyName(company);
  const g = Object.keys(ROLE).indexOf(group);
  const results: SearchResult[] = [];
  for (let i = 0; i < 6; i++) {
    const n = page * 6 + i + g * 3;
    const name =
      i === 5 && page === 0 ? HE[g % HE.length] : `${FIRST[n % FIRST.length]} ${LAST[(n + g) % LAST.length]}`;
    const role = ROLE[group][i % ROLE[group].length];
    const city = CITY[n % CITY.length];
    results.push({
      title: `${name} - ${role} - ${co} | LinkedIn`,
      url: `https://il.linkedin.com/in/${slugify(name).replace(/[^\p{L}\p{N}-]/gu, "")}-fx${page}${i}${g}`,
      description: `${role} at ${co} · Experience: ${co} · Location: ${city}, Israel · 500+ connections on LinkedIn.`,
    });
  }
  // Noise the parser must handle: an ex-employee, another company, a non-profile URL, a duplicate.
  results.push({
    title: `Gal Formerson - Product Lead - Other Corp | LinkedIn`,
    url: `https://www.linkedin.com/in/gal-formerson-fx${page}${g}`,
    description: `Product Lead at Other Corp. Ex-${co} engineer. Location: Tel Aviv, Israel`,
  });
  results.push({
    title: `Uri Elsewhere - ${ROLE[group][0]} | LinkedIn`,
    url: `https://www.linkedin.com/in/uri-elsewhere-fx${page}${g}`,
    description: `${ROLE[group][0]} at Unrelated Systems · Location: Haifa, Israel. Worked with ${co} as a vendor.`,
  });
  results.push({
    title: `${co} is hiring | LinkedIn`,
    url: `https://www.linkedin.com/jobs/view/123${page}`,
    description: "Jobs",
  });
  results.push({ ...results[0] });
  return { results, hasMore: page < 2 };
}
