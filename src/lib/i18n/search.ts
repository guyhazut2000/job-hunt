import type { Locale } from "./dictionaries";

/** Strings for the free-text search on /jobs and /companies. */
const en = {
  jobs: {
    label: "Search jobs",
    placeholder: "Search title, company, skill or city…",
    clear: "Clear search",
    shortcut: "Press / to search",
    submit: "Search",
    companies: "Companies",
    skills: "Skills",
  },
  companies: {
    label: "Search companies",
    placeholder: "Search company, domain, field or ATS…",
    clear: "Clear search",
    shortcut: "Press / to search",
    submit: "Search",
  },
  noResultsFor: "No jobs found for “{q}”",
  noCompaniesFor: "No companies found for “{q}”",
  noResultsHint: "Try a shorter or different word, an English term (e.g. “developer”), or fewer filters.",
  clearSearch: "Clear search",
  clearFilters: "Clear all filters",
  resultsFor: "for “{q}”",
  alsoShowing: "Also showing results for {q}",
  companiesFound: "companies",
};

export type SearchStrings = typeof en;

const he: SearchStrings = {
  jobs: {
    label: "חיפוש משרות",
    placeholder: "חיפוש לפי תפקיד, חברה, כישור או עיר…",
    clear: "ניקוי החיפוש",
    shortcut: "לחצו / כדי לחפש",
    submit: "חיפוש",
    companies: "חברות",
    skills: "כישורים",
  },
  companies: {
    label: "חיפוש חברות",
    placeholder: "חיפוש לפי שם חברה, דומיין, תחום או מערכת גיוס…",
    clear: "ניקוי החיפוש",
    shortcut: "לחצו / כדי לחפש",
    submit: "חיפוש",
  },
  noResultsFor: "לא נמצאו משרות עבור „{q}”",
  noCompaniesFor: "לא נמצאו חברות עבור „{q}”",
  noResultsHint: "נסו מילה קצרה או אחרת, מונח באנגלית (למשל developer) או פחות סינונים.",
  clearSearch: "ניקוי החיפוש",
  clearFilters: "ניקוי כל הסינונים",
  resultsFor: "עבור „{q}”",
  alsoShowing: "מציג גם תוצאות עבור {q}",
  companiesFound: "חברות",
};

export function searchStrings(locale: Locale): SearchStrings {
  return locale === "he" ? he : en;
}

export const fillQ = (s: string, q: string) => s.replace("{q}", q);
