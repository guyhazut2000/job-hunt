import type { Locale } from "./dictionaries";

const he = {
  exact: "צפייה במשרה בלינקדאין",
  exactShort: "המשרה בלינקדאין",
  exactNote: "המודעה המדויקת",
  search: "חיפוש המשרה בלינקדאין",
  searchShort: "חיפוש בלינקדאין",
  searchNote: "תוצאות חיפוש, לא בהכרח המודעה עצמה",
  exactAria: "פתיחת המודעה המדויקת בלינקדאין (בחלון חדש)",
  searchAria: "חיפוש המשרה בלינקדאין (בחלון חדש)",
};

const en: typeof he = {
  exact: "View posting on LinkedIn",
  exactShort: "On LinkedIn",
  exactNote: "Exact posting",
  search: "Search on LinkedIn",
  searchShort: "Search LinkedIn",
  searchNote: "Search results, may not be this exact posting",
  exactAria: "Open the exact LinkedIn posting (new tab)",
  searchAria: "Search for this job on LinkedIn (new tab)",
};

export type LinkedinStrings = typeof he;

export function linkedinStrings(locale: Locale): LinkedinStrings {
  return locale === "en" ? en : he;
}
