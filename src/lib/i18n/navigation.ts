import type { Locale } from "./dictionaries";
import type { MoreSectionId } from "@/lib/nav/config";

/**
 * Labels for the regrouped navigation. Hebrew is the product language.
 * Keys match destination ids in `src/lib/nav/config.ts`.
 */
const he = {
  main: "ניווט ראשי",
  mobile: "ניווט תחתון",
  moreMenu: "תפריט נוסף",
  sections: {
    prep: "הכנה",
    progress: "התקדמות",
    tools: "כלים",
    admin: "ניהול",
  } satisfies Record<MoreSectionId, string>,
  items: {
    jobs: "משרות",
    companies: "חברות",
    tracker: "מעקב",
    documents: "מסמכים",
    prep: "הכנה",
    features: "יכולות",
    "jobs-search": "חיפוש",
    "jobs-map": "מפה",
    "jobs-ranking": "דירוג אישי",
    "jobs-step-up": "שדרוג",
    "companies-list": "חברות",
    "companies-outreach": "פניות",
    "companies-referrals": "הפניות",
    "tracker-board": "מועמדויות",
    "tracker-closing": "שלב סופי",
    "tracker-salary": "שכר",
    "documents-profile": "פרופיל",
    "documents-standard": "תקן",
    "documents-templates": "תבניות",
    "documents-tailor": "התאמה",
    "documents-ats": "בדיקת ATS",
    "documents-linkedin": "LinkedIn",
    "prep-learn": "מסלולים",
    "prep-me": "הלמידה שלי",
    "prep-gaps": "פערים",
    "prep-system-design": "System Design",
    "prep-problem-solving": "פתרון בעיות",
    "prep-concepts": "מושגים",
    "prep-manager": "שאלות מנהל",
    "prep-interview": "סימולציה",
    stats: "סטטיסטיקה",
    coach: "מאמן שבועי",
    digest: "סיכום יומי",
    chat: "עוזר",
    salary: "שכר",
    admin: "ניהול",
  },
};

const en: typeof he = {
  main: "Main",
  mobile: "Mobile",
  moreMenu: "More menu",
  sections: {
    prep: "Prep",
    progress: "Progress",
    tools: "Tools",
    admin: "Admin",
  },
  items: {
    jobs: "Jobs",
    companies: "Companies",
    tracker: "Tracker",
    documents: "Documents",
    prep: "Prep",
    features: "Features",
    "jobs-search": "Search",
    "jobs-map": "Map",
    "jobs-ranking": "My ranking",
    "jobs-step-up": "Step up",
    "companies-list": "Companies",
    "companies-outreach": "Outreach",
    "companies-referrals": "Referrals",
    "tracker-board": "Applications",
    "tracker-closing": "Final stage",
    "tracker-salary": "Salary",
    "documents-profile": "Profile",
    "documents-standard": "CV standard",
    "documents-templates": "Templates",
    "documents-tailor": "Tailor",
    "documents-ats": "ATS check",
    "documents-linkedin": "LinkedIn",
    "prep-learn": "Tracks",
    "prep-me": "My learning",
    "prep-gaps": "Gaps",
    "prep-system-design": "System Design",
    "prep-problem-solving": "Problem solving",
    "prep-concepts": "Concepts",
    "prep-manager": "Manager questions",
    "prep-interview": "Simulation",
    stats: "Statistics",
    coach: "Weekly coach",
    digest: "Daily digest",
    chat: "Assistant",
    salary: "Salary",
    admin: "Admin",
  },
};

export type NavigationStrings = typeof he;

export function navigationStrings(locale: Locale): NavigationStrings {
  return locale === "en" ? en : he;
}

export function navLabel(strings: NavigationStrings, id: string): string {
  return strings.items[id as keyof typeof strings.items] ?? id;
}

export function navSectionLabel(strings: NavigationStrings, id: string): string {
  return strings.sections[id as MoreSectionId] ?? id;
}
