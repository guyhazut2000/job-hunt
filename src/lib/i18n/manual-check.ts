import type { Locale } from "./dictionaries";

/** Strings for the weekly "check these careers sites by hand" reminder (docs/sources.md#manual-check). */
const en = {
  title: "Weekly check: {n} careers sites to look at by hand",
  bodyYours: "From your applications: {list}.",
  bodyOthers: "Also worth a look: {list}.",
  more: "+{n} more",
  tail: "Their sites block automated scans, so new jobs there don't reach the feed.",
  bannerTitle: "Checked by hand",
  bannerBody:
    "These companies' careers sites have no public job feed or block automated scans, so their jobs aren't pulled in. Open each careers site to look for Israeli openings — you'll also get a weekly reminder listing them (bell, and Telegram if connected for the digest).",
};

const he: typeof en = {
  title: "בדיקה שבועית: {n} אתרי קריירה לבדיקה ידנית",
  bodyYours: "מהמועמדויות שלך: {list}.",
  bodyOthers: "כדאי לבדוק גם: {list}.",
  more: "ועוד {n}",
  tail: "האתרים שלהן חוסמים סריקה אוטומטית, ולכן משרות חדשות שם לא מגיעות לפיד.",
  bannerTitle: "בדיקה ידנית",
  bannerBody:
    "לחברות האלה אין פיד משרות ציבורי או שהאתר חוסם סריקה אוטומטית, ולכן המשרות שלהן לא נאספות. פתחו את אתר הקריירה של כל חברה כדי לבדוק משרות בישראל — תקבלו גם תזכורת שבועית עם הרשימה (בפעמון, ובטלגרם אם הוא מחובר לתקציר).",
};

export type ManualCheckStrings = typeof en;

export function manualCheckStrings(locale: Locale): ManualCheckStrings {
  return locale === "en" ? en : he;
}
