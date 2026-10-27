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
  companyPage: "דף החברה בלינקדאין",
  companySearch: "חיפוש החברה בלינקדאין",
  companyJobs: "משרות החברה בלינקדאין",
  companyPageAria: "דף החברה {name} בלינקדאין (בחלון חדש)",
  companySearchAria: "חיפוש החברה {name} בלינקדאין (בחלון חדש)",
  companyJobsAria: "משרות של {name} בישראל בלינקדאין (בחלון חדש)",
  companyIconAria: "{name} בלינקדאין (בחלון חדש)",
  adminTitle: "דף לינקדאין לחברה",
  adminHint: "הדביקו קישור לדף החברה בלינקדאין, או רק את שם הדף מתוך הקישור. שדה ריק מחזיר לחיפוש חברה.",
  adminCompany: "חברה",
  adminSave: "שמירה",
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
  companyPage: "Company on LinkedIn",
  companySearch: "Search company on LinkedIn",
  companyJobs: "Company jobs on LinkedIn",
  companyPageAria: "{name} company page on LinkedIn (new tab)",
  companySearchAria: "Search LinkedIn for the company {name} (new tab)",
  companyJobsAria: "{name} jobs in Israel on LinkedIn (new tab)",
  companyIconAria: "{name} on LinkedIn (new tab)",
  adminTitle: "Company LinkedIn page",
  adminHint: "Company page URL (linkedin.com/company/…) or just the slug. Empty = company search.",
  adminCompany: "Company",
  adminSave: "Save",
};

export type LinkedinStrings = typeof he;

export function linkedinStrings(locale: Locale): LinkedinStrings {
  return locale === "en" ? en : he;
}
