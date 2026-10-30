import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * "What's new" announcements (#41). The full changelog is the "מה חדש" section of /features (built from
 * src/features/registry.ts); an entry here with `announce: true` additionally becomes a WHATS_NEW
 * notification (in-site by default; push/Telegram only if the user turns them on), once per user,
 * within ANNOUNCE_DAYS of its date. Only for changes worth interrupting people for.
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
/** The changelog section on /features. */
export const WHATS_NEW_URL = "/features#whats-new";

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-10-30-follow-up-drafts",
    date: "2026-10-30",
    url: "/dashboard",
    announce: true,
    he: {
      title: "תזכורות פולואפ עם טיוטת מייל מוכנה",
      body: "אין תשובה אחרי 10 ימים? נזכיר לך ונכין טיוטת מייל פולואפ קצרה בעברית או באנגלית. עורכים, מעתיקים או פותחים ב-Gmail ושולחים בעצמך — האתר לא שולח מיילים. את מספר הימים משנים בהגדרות ההתראות.",
    },
    en: {
      title: "Follow-up reminders with a ready email draft",
      body: "No reply after 10 days? We'll remind you and prepare a short follow-up email in Hebrew or English. Edit, copy or open it in Gmail and send it yourself — the site never sends email. Change the number of days in notification settings.",
    },
  },
  {
    id: "2026-10-30-notifications-complete",
    date: "2026-10-30",
    url: "/settings/notifications",
    announce: true,
    he: {
      title: "התראות על שינויים במשרות ששמרת, שלבי גיוס, ומיידי או בסיכום",
      body: "התראה כשמשרה ששמרת או שהגשת אליה נסגרת או משתנה (כותרת, מיקום, שכר, תיאור), כשמועמדות עוברת לשלב סינון, ראיון או הצעה (עם השלב הבא בתהליך של החברה). בהגדרות אפשר לבחור לכל סוג התראה אם היא נשלחת מיד או נאספת לסיכום היומי.",
    },
    en: {
      title: "Alerts for saved-job changes and hiring stages, instant or in the digest",
      body: "Get notified when a job you saved or applied to closes or changes (title, location, pay, description), when an application moves to screening, interview or offer (with the next stage in the company's process). In settings, choose per alert type whether it is sent instantly or collected into the daily digest.",
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
