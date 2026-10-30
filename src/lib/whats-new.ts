import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * "What's new" changelog (#41): shown on /whats-new. Entries with `announce: true` also become a
 * WHATS_NEW notification (in-site by default; push/Telegram only if the user turns them on), once per
 * user, within ANNOUNCE_DAYS of the entry date. Newest first. Add an entry in the same PR as the feature.
 */
export interface WhatsNewEntry {
  /** Stable id — the notification dedupe key. Never reuse. */
  id: string;
  /** YYYY-MM-DD (Israel). */
  date: string;
  url?: string;
  announce?: boolean;
  he: { title: string; body: string };
  en: { title: string; body: string };
}

export const ANNOUNCE_DAYS = 7;

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-10-30-notifications-complete",
    date: "2026-10-30",
    url: "/settings/notifications",
    announce: true,
    he: {
      title: "התראות על שינויים במשרות ששמרת, שלבי גיוס, ומיידי או בסיכום",
      body: 'התראה כשמשרה ששמרת או שהגשת אליה נסגרת או משתנה (כותרת, מיקום, שכר, תיאור), כשמועמדות עוברת לשלב סינון, ראיון או הצעה (עם השלב הבא בתהליך של החברה), ועמוד "מה חדש" הזה. בהגדרות אפשר לבחור לכל סוג התראה אם היא נשלחת מיד או נאספת לסיכום היומי.',
    },
    en: {
      title: "Alerts for saved-job changes and hiring stages, instant or in the digest",
      body: "Get notified when a job you saved or applied to closes or changes (title, location, pay, description), when an application moves to screening, interview or offer (with the next stage in the company's process), plus this \"What's new\" page. In settings, choose per alert type whether it is sent instantly or collected into the daily digest.",
    },
  },
  {
    id: "2026-10-30-teradyne",
    date: "2026-10-30",
    url: "/companies",
    he: {
      title: "Teradyne נסרקת אוטומטית",
      body: "המשרות של Teradyne בישראל נאספות עכשיו כל יום מאתר הקריירה הציבורי שלה, ולא רק כבדיקה ידנית.",
    },
    en: {
      title: "Teradyne is scanned automatically",
      body: "Teradyne's Israel jobs are now collected daily from its public careers site instead of a manual check.",
    },
  },
  {
    id: "2026-10-30-email-auto-apply",
    date: "2026-10-30",
    url: "/dashboard",
    he: {
      title: "עדכוני סטטוס אוטומטיים מהמייל",
      body: "מיילים ברורים מחברות (דחייה, זימון לראיון) מעדכנים את המועמדות לבד, עם היסטוריה וביטול בלחיצה.",
    },
    en: {
      title: "Automatic status updates from email",
      body: "Clear emails from companies (rejection, interview invite) update the application on their own, with a history and one-click undo.",
    },
  },
  {
    id: "2026-10-30-profile-page",
    date: "2026-10-30",
    url: "/profile",
    he: { title: "פרופיל ומסמכים בעמוד אחד", body: "הפרופיל, קורות החיים והמסמכים נמצאים עכשיו בעמוד אחד עם לשוניות." },
    en: {
      title: "Profile and documents on one page",
      body: "Your profile, CVs and documents now live on one tabbed page.",
    },
  },
  {
    id: "2026-10-29-problem-solving",
    date: "2026-10-29",
    url: "/learn/problem-solving",
    he: {
      title: "שיטת פתרון בעיות",
      body: "מדריך בחירת גישה, דפי תבניות ותרגול עם משוב AI לשאלות קוד.",
    },
    en: {
      title: "Problem-solving method",
      body: "A decision guide, pattern cheat sheets and practice with AI feedback for coding questions.",
    },
  },
  {
    id: "2026-10-29-concepts",
    date: "2026-10-29",
    url: "/learn/concepts",
    he: { title: "מילון מושגים אישי", body: "הסבר AI למושגים, עם העמקה, שיחות שמורות ומושגים לפי חברה." },
    en: {
      title: "Personal concepts glossary",
      body: "AI-explained concepts with drill-downs, saved chats and company concepts.",
    },
  },
  {
    id: "2026-10-29-follow-companies",
    date: "2026-10-29",
    url: "/companies",
    he: {
      title: "מעקב אחרי חברות וסריקה מהירה",
      body: "התראה על משרות חדשות בחברות שבחרת, ומקורות מהירים נסרקים כל רבע שעה.",
    },
    en: {
      title: "Follow companies and a faster scan",
      body: "Get alerted about new jobs at companies you follow; fast sources are scanned every 15 minutes.",
    },
  },
  {
    id: "2026-10-29-reminders-digest",
    date: "2026-10-29",
    url: "/digest",
    he: { title: "תזכורות וסיכום יומי", body: "תזכורות לראיונות ולתרגול, וסיכום יומי של מה שהשתנה בחיפוש." },
    en: {
      title: "Reminders and a daily digest",
      body: "Interview and practice reminders, and a daily digest of what changed in your search.",
    },
  },
];

export function entryText(e: WhatsNewEntry, locale: Locale) {
  return e[locale];
}

/** Entries to announce at `now`: flagged, not in the future, within ANNOUNCE_DAYS, not before the user joined. */
export function entriesToAnnounce(now: Date, joinedAt: Date, entries = WHATS_NEW): WhatsNewEntry[] {
  return entries.filter((e) => {
    if (!e.announce) return false;
    const at = new Date(`${e.date}T00:00:00+02:00`).getTime();
    return (
      at <= now.getTime() && now.getTime() - at <= ANNOUNCE_DAYS * 86_400_000 && joinedAt.getTime() <= at + 86_400_000
    );
  });
}
