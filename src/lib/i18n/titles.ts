import type { Metadata } from "next";
import { getLocale, type Locale } from ".";

/** Browser-tab titles per page, in both UI languages (the layout appends "· job-hunt"). */
export const PAGE_TITLES = {
  admin: { he: "ניהול", en: "Admin" },
  chat: { he: "העוזר", en: "Assistant" },
  companies: { he: "חברות", en: "Companies" },
  cv: { he: "קורות חיים", en: "CV" },
  cvTailor: { he: "קורות חיים מותאמים", en: "Tailored CV" },
  cvTemplates: { he: "תבניות קורות חיים", en: "CV templates" },
  dashboard: { he: "לוח הבקרה", en: "Dashboard" },
  digest: { he: "סיכום יומי", en: "Daily digest" },
  emailSync: { he: "סנכרון מייל", en: "Email sync" },
  interview: { he: "סימולציית ראיון", en: "Interview simulation" },
  jobs: { he: "משרות", en: "Jobs" },
  learn: { he: "למידה", en: "Learn" },
  learnMe: { he: "הלמידה שלי", en: "My learning" },
  login: { he: "התחברות", en: "Log in" },
  notifications: { he: "התראות", en: "Notifications" },
  notificationSettings: { he: "הגדרות התראות", en: "Notification settings" },
  onboarding: { he: "מתחילים", en: "Get started" },
  places: { he: "מקומות שמורים", en: "Saved places" },
  privacy: { he: "פרטיות", en: "Privacy" },
  profile: { he: "פרופיל ומסמכים", en: "Profile & documents" },
  register: { he: "הרשמה", en: "Sign up" },
  reviewCv: { he: "סקירת קורות חיים", en: "Review CV" },
  stats: { he: "סטטיסטיקות חיפוש", en: "Search statistics" },
  terms: { he: "תנאי שימוש", en: "Terms" },
  concepts: { he: "מושגים", en: "Concepts" },
  problemSolving: { he: "פתרון בעיות", en: "Problem solving" },
  psAnalyze: { he: "ניתוח בעיה", en: "Analyze a problem" },
  psChecklist: { he: "צ'קליסט לפתרון בעיות", en: "Problem-solving checklist" },
  psDataStructures: { he: "מבני נתונים", en: "Data structures" },
  psInterview: { he: "שיטת הראיון", en: "Interview method" },
  psPatterns: { he: "תבניות", en: "Patterns" },
  psPractice: { he: "תרגול", en: "Practice" },
} satisfies Record<string, Record<Locale, string>>;

export type PageTitleKey = keyof typeof PAGE_TITLES;

export function pageTitle(key: PageTitleKey, locale: Locale): string {
  return PAGE_TITLES[key][locale];
}

/** `export const generateMetadata = localizedTitle("jobs")` — the tab title in the visitor's UI language. */
export function localizedTitle(key: PageTitleKey) {
  return async function generateMetadata(): Promise<Metadata> {
    return { title: pageTitle(key, await getLocale()) };
  };
}
