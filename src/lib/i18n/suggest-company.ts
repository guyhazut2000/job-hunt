import type { Locale } from "./dictionaries";

const he = {
  title: "חסרה חברה?",
  hint: "הציעו חברה עם משרות הייטק בישראל. המערכת בודקת מיד את אתר הקריירה שלה. אם יש לה לוח משרות ציבורי עם משרות בישראל, היא נוספת אוטומטית. אחרת מנהל בודק אותה. את המצב רואים ב״ההצעות שלי״.",
  name: "שם החברה",
  namePlaceholder: "למשל ONE City",
  url: "אתר החברה או עמוד הקריירה",
  urlPlaceholder: "https://…",
  submit: "שליחת הצעה",
  thanks:
    "תודה! אנחנו בודקים עכשיו את אתר החברה, וזה לוקח עד דקה. התוצאה תופיע ב״ההצעות שלי״ למטה, ותקבלו התראה כשהחברה תתווסף.",
  invalid: "נא למלא שם ואתר של החברה עצמה (לא לינקדאין או רשת חברתית).",
  exists: "החברה כבר מופיעה ברשימה.",
  queued:
    "החברה הזאת כבר נמצאת בתור הבדיקה של המערכת, ממקור אחר. היא תיבדק בבדיקה הלילית ותופיע ברשימה אם יימצאו לה משרות.",
  limit: "הגעתם למגבלת ההצעות היומית. נסו שוב מחר.",
  jump: "הצעת חברה וההצעות שלי",
  mineTitle: "ההצעות שלי",
  mineCount: "{n} הצעות",
  mineMore: "מוצגות {shown} ההצעות האחרונות מתוך {total}.",
  checking: "נבדקת עכשיו",
  checkingHint: "בודקים את אתר הקריירה. העמוד יתעדכן לבד.",
  nightly: "ממתינה לבדיקה הלילית",
  nightlyHint: "הבדיקה המיידית לא הספיקה. הבדיקה הבאה ב-{time} שעון ישראל.",
  added: "נוספה",
  addedJobs: "{n} משרות פתוחות",
  addedNoJobs: "המשרות ייטענו בסריקה הקרובה",
  openCompany: "לעמוד החברה",
  review: "ממתינה לאישור מנהל",
  reviewHint: "מנהל יבדוק אותה ידנית. תקבלו התראה כשיוחלט.",
  rejected: "נדחתה",
  rejectedHint: "מנהל בדק ולא הוסיף אותה לרשימה.",
  duplicate: "כבר קיימת",
  reason_noCareersPage: "לא מצאנו באתר עמוד קריירה.",
  reason_noBoard: "מצאנו עמוד קריירה, אבל בלי לוח משרות ציבורי שאנחנו יודעים לקרוא.",
  reason_noIsraelJobs: "מצאנו לוח משרות, אבל אין בו כרגע משרות בישראל.",
  reason_siteError: "לא הצלחנו לקרוא את האתר. ייתכן שהוא חוסם בדיקות אוטומטיות או שלא ענה בזמן.",
};

const en: typeof he = {
  title: "Missing a company?",
  hint: "Suggest a company with hi-tech jobs in Israel. We check its careers site right away: with a public job board that has Israeli openings it's added automatically, otherwise an admin reviews it. Track it under “My suggestions”.",
  name: "Company name",
  namePlaceholder: "e.g. ONE City",
  url: "Company website or careers page",
  urlPlaceholder: "https://…",
  submit: "Suggest company",
  thanks:
    "Thanks! We're checking the company's site now (up to a minute). The result shows under “My suggestions” below, and you'll get a notification when it's added.",
  invalid: "Enter a name and the company's own website (not LinkedIn or a social network).",
  exists: "This company is already listed.",
  queued:
    "This company is already in the discovery queue from another source. The nightly check will add it if it has jobs.",
  limit: "You've reached today's suggestion limit. Try again tomorrow.",
  jump: "Suggest a company · my suggestions",
  mineTitle: "My suggestions",
  mineCount: "{n} suggestions",
  mineMore: "Showing the latest {shown} of {total} suggestions.",
  checking: "Being checked now",
  checkingHint: "Checking the careers site. This page updates by itself.",
  nightly: "Waiting for the nightly check",
  nightlyHint: "The instant check didn't finish. Next check at {time} Israel time.",
  added: "Added",
  addedJobs: "{n} open jobs",
  addedNoJobs: "Jobs load in the next scan",
  openCompany: "Company page",
  review: "Waiting for admin approval",
  reviewHint: "An admin will review it manually. You'll be notified of the decision.",
  rejected: "Rejected",
  rejectedHint: "An admin reviewed it and didn't add it.",
  duplicate: "Already listed",
  reason_noCareersPage: "We couldn't find a careers page on the site.",
  reason_noBoard: "We found a careers page, but no public job board we can read.",
  reason_noIsraelJobs: "We found a job board, but it has no openings in Israel right now.",
  reason_siteError: "We couldn't read the site. It may block automated checks or didn't respond in time.",
};

export type SuggestCompanyStrings = typeof he;

export function suggestCompanyStrings(locale: Locale): SuggestCompanyStrings {
  return locale === "en" ? en : he;
}
