import type { Locale } from "./dictionaries";

/** Strings for the people-search cards. Plain strings only ("{n}" templates) — safe to pass to client components. */
const he = {
  title: "אנשים שמצאנו",
  intro: "תוצאות חיפוש ציבוריות של פרופילי LinkedIn, לפי קבוצה. כדאי לוודא בפרופיל שהאדם עדיין עובד בחברה.",
  groups: {
    RECRUITER: "מגייסים",
    TEAM_LEAD: "ראשי צוותים",
    ENGINEER: "מהנדסים ועובדים",
    MANAGER: "מנהלים",
    SENIOR_MGMT: "הנהלה בכירה",
    FOUNDER: "מנכ״ל ומייסדים",
  },
  openLinkedin: "פתיחה ב-LinkedIn",
  copyNote: "העתקת הודעת חיבור",
  copied: "הועתק",
  save: "שמירה",
  savedContact: "נשמר",
  saving: "שומר…",
  more: "פעולות נוספות",
  hide: "הסתרה",
  report: "דיווח / בקשת הסרה",
  hidden: "הוסתר",
  reported: "תודה — התוצאה הוסרה",
  verified: "עובד/ת ב-{company}",
  uncertain: "התאמה לא ודאית",
  showUncertain: "הצגת {n} התאמות לא ודאיות",
  hideUncertain: "הסתרת ההתאמות הלא ודאיות",
  loadMore: "טעינת עוד",
  loading: "מחפש…",
  empty: "לא מצאנו אנשים בקבוצה הזו. אפשר לנסות את כפתורי החיפוש למטה.",
  error: "החיפוש נכשל כרגע. אפשר לנסות שוב או להשתמש בכפתורי החיפוש למטה.",
  retry: "ניסיון חוזר",
  rateLimited: "יותר מדי חיפושים בדקה האחרונה — נסו שוב בעוד רגע.",
  dailyCap: "הגעת למכסת החיפושים היומית. כפתורי החיפוש למטה עדיין עובדים.",
  quota: "מכסת החיפוש האוטומטי נגמרה לעת עתה. אפשר להמשיך עם כפתורי החיפוש:",
  disabled: "חיפוש אנשים אוטומטי עוד לא מוגדר — בינתיים אפשר להשתמש בכפתורי החיפוש למטה.",
  loginHint: "התחברות מציגה כרטיסי אנשים מהחברה.",
  privacy:
    "אנחנו לא נכנסים ל-LinkedIn ולא סורקים אותו. מוצגים רק שם, כותרת וקישור מתוצאות חיפוש ציבוריות, ונשמרים זמנית במטמון. מופיע כאן ולא רוצה? ״דיווח / בקשת הסרה״ מסיר את התוצאה.",
  attribution: "POWERED BY BRAVE",
  cachedAt: "עודכן {date}",
} as const;

type Strings = {
  [K in keyof typeof he]: (typeof he)[K] extends string ? string : Record<keyof (typeof he)[K], string>;
};

const en: Strings = {
  title: "People we found",
  intro: "Public search results for LinkedIn profiles, by group. Check the profile to confirm they still work there.",
  groups: {
    RECRUITER: "Recruiters",
    TEAM_LEAD: "Team leads",
    ENGINEER: "Engineers",
    MANAGER: "Managers",
    SENIOR_MGMT: "Senior management",
    FOUNDER: "CEO & founders",
  },
  openLinkedin: "Open in LinkedIn",
  copyNote: "Copy connection note",
  copied: "Copied",
  save: "Save",
  savedContact: "Saved",
  saving: "Saving…",
  more: "More actions",
  hide: "Hide",
  report: "Report / request removal",
  hidden: "Hidden",
  reported: "Thanks — the result was removed",
  verified: "Works at {company}",
  uncertain: "Uncertain match",
  showUncertain: "Show {n} uncertain matches",
  hideUncertain: "Hide uncertain matches",
  loadMore: "Load more",
  loading: "Searching…",
  empty: "No people found in this group. Try the search buttons below.",
  error: "Search failed right now. Retry or use the search buttons below.",
  retry: "Retry",
  rateLimited: "Too many searches in the last minute — try again shortly.",
  dailyCap: "You've reached today's search limit. The search buttons below still work.",
  quota: "Automatic search is out of quota for now. Continue with the search buttons:",
  disabled: "Automatic people search isn't configured yet — use the search buttons below meanwhile.",
  loginHint: "Log in to see people cards from this company.",
  privacy:
    "We never open or scrape LinkedIn. We only show the name, headline and link from public search results, cached briefly. Listed here and don't want to be? “Report / request removal” removes it.",
  attribution: "POWERED BY BRAVE",
  cachedAt: "Updated {date}",
};

export const peopleSearchStrings: Record<Locale, Strings> = { he, en };
export type PeopleSearchStrings = Strings;
