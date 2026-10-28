import type { Locale } from "./dictionaries";

const he = {
  title: "חסרה חברה?",
  hint: "הציעו חברה עם משרות הייטק בישראל. נבדוק את אתר הקריירה שלה ונוסיף אותה לרשימה.",
  name: "שם החברה",
  namePlaceholder: "למשל ONE City",
  url: "אתר החברה או עמוד הקריירה",
  urlPlaceholder: "https://…",
  submit: "שליחת הצעה",
  thanks: "תודה! החברה נוספה לתור הבדיקה.",
  invalid: "נא למלא שם ואתר של החברה עצמה (לא לינקדאין או רשת חברתית).",
  exists: "החברה כבר מופיעה ברשימה.",
  queued: "החברה כבר ממתינה בתור הבדיקה.",
  limit: "הגעתם למגבלת ההצעות היומית. נסו שוב מחר.",
};

const en: typeof he = {
  title: "Missing a company?",
  hint: "Suggest a company with hi-tech jobs in Israel. We'll check its careers site and add it to the list.",
  name: "Company name",
  namePlaceholder: "e.g. ONE City",
  url: "Company website or careers page",
  urlPlaceholder: "https://…",
  submit: "Suggest company",
  thanks: "Thanks! The company was added to the review queue.",
  invalid: "Enter a name and the company's own website (not LinkedIn or a social network).",
  exists: "This company is already listed.",
  queued: "This company is already waiting in the review queue.",
  limit: "You've reached today's suggestion limit. Try again tomorrow.",
};

export type SuggestCompanyStrings = typeof he;

export function suggestCompanyStrings(locale: Locale): SuggestCompanyStrings {
  return locale === "en" ? en : he;
}
