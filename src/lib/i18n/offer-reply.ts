import type { Locale } from "@/lib/i18n";

const he = {
  title: "מייל תשובה להצעה – קבלה או הצעה נגדית",
  lead: "טיוטה להעתקה, מבוססת על נתוני ההצעה ששמרתם. שום דבר לא נשלח מכאן. בשני המצבים המייל מבקש את התנאים הסופיים בכתב.",
  accept: "קבלה",
  counter: "הצעה נגדית",
  recruiter: "שם המגייס/ת",
  startDate: "תאריך התחלה מבוקש",
  asks: "מה לבקש (עד {n})",
  asksLead: "רק מה שבאמת חשוב לכם. הנימוק הוא שלכם – הצעה מתחרה, נתוני שכר, היקף התפקיד.",
  kind: "נושא",
  target: "מה מבקשים",
  targetPh: "לדוגמה: 32,000 ₪ ברוטו",
  why: "למה (אופציונלי)",
  whyPh: "לדוגמה: הצעה אחרת בטווח הזה",
  addAsk: "הוספת בקשה",
  remove: "הסרה",
  noAsks: "בלי בקשות – המייל ייצא כמייל קבלה.",
  noOffer: "לא הוזנו נתוני הצעה, אז המייל לא מפרט תנאים. אפשר להוסיף אותם בהשוואת ההצעות.",
  toOffers: "להשוואת ההצעות",
  draft: "הטיוטה",
  copy: "העתקה",
  copied: "הועתק",
  sources: "מקורות",
};
export type OfferReplyStrings = typeof he;

const en: OfferReplyStrings = {
  title: "Offer reply email — accept or counter",
  lead: "A copy-ready draft built from the offer you saved. Nothing is sent from here. Both modes ask for the final terms in writing.",
  accept: "Accept",
  counter: "Counter-offer",
  recruiter: "Recruiter's name",
  startDate: "Preferred start date",
  asks: "What to ask for (up to {n})",
  asksLead: "Only what really matters to you. The reason is yours — a competing offer, salary data, the scope of the role.",
  kind: "Topic",
  target: "What you ask for",
  targetPh: "e.g. ₪32,000 gross",
  why: "Why (optional)",
  whyPh: "e.g. another offer in this range",
  addAsk: "Add an ask",
  remove: "Remove",
  noAsks: "No asks — the email goes out as an acceptance.",
  noOffer: "No offer figures were entered, so the email lists no terms. You can add them in the offer comparison.",
  toOffers: "Offer comparison",
  draft: "Draft",
  copy: "Copy",
  copied: "Copied",
  sources: "Sources",
};

export const offerReplyStrings = (locale: Locale | string): OfferReplyStrings => (locale === "he" ? he : en);
