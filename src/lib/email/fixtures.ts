/**
 * Synthetic emails for tests and the local demo. Entirely made up: fictional companies,
 * example addresses, no real messages or people.
 */
import type { MailMessage } from "./parse";

const d = (daysAgo: number) => new Date(Date.UTC(2026, 9, 27, 9, 0) - daysAgo * 86_400_000);

export const FIXTURE_COMPANIES = [
  { id: "c_orion", name: "Orion Payments", slug: "orion-payments", website: "https://orionpay.example" },
  { id: "c_nimbus", name: "Nimbus Data Ltd.", slug: "nimbus-data", website: "https://nimbusdata.example" },
  { id: "c_tavor", name: "תבור מערכות", slug: "tavor-systems", website: "https://tavor.example" },
  { id: "c_kestrel", name: "Kestrel AI", slug: "kestrel-ai", website: "https://kestrel.example" },
];

export const FIXTURE_JOBS = [
  { id: "j_orion_fe", title: "Senior Frontend Engineer", companyId: "c_orion", isActive: true },
  { id: "j_orion_be", title: "Backend Engineer, Payments", companyId: "c_orion", isActive: true },
  { id: "j_nimbus_ds", title: "Data Scientist", companyId: "c_nimbus", isActive: true },
  { id: "j_tavor_fs", title: "מפתח/ת Full Stack", companyId: "c_tavor", isActive: true },
  { id: "j_kestrel_ml", title: "Machine Learning Engineer", companyId: "c_kestrel", isActive: true },
];

export const FIXTURE_EMAILS: Record<string, MailMessage> = {
  greenhouse: {
    id: "fx-greenhouse-1",
    from: "Orion Payments Recruiting <no-reply@us.greenhouse-mail.io>",
    subject: "Thank you for applying to Orion Payments",
    snippet:
      "Hi Dana, Thanks for applying for the Senior Frontend Engineer position at Orion Payments. Our team will review your application.",
    date: d(1),
  },
  lever: {
    id: "fx-lever-1",
    from: "Nimbus Data <no-reply@hire.lever.co>",
    subject: "Nimbus Data - Application received",
    snippet: "Thank you for your interest in Nimbus Data! We received your application for Data Scientist.",
    date: d(2),
  },
  comeetHebrew: {
    id: "fx-comeet-he-1",
    from: "צוות הגיוס תבור מערכות <jobs@mail.comeet.co>",
    subject: "תודה על פנייתך לתפקיד מפתח/ת Full Stack",
    snippet: "שלום, קיבלנו את קורות החיים שלך למשרת מפתח/ת Full Stack בחברת תבור מערכות ונחזור אלייך בהקדם.",
    date: d(3),
  },
  linkedin: {
    id: "fx-linkedin-1",
    from: "LinkedIn <jobs-noreply@linkedin.com>",
    subject: "Dana, your application was sent to Kestrel AI",
    snippet: "Your application was sent to Kestrel AI. Machine Learning Engineer · Kestrel AI · Tel Aviv (Hybrid)",
    date: d(4),
  },
  unknownCompany: {
    id: "fx-unknown-1",
    from: "Talent Team <careers@brightfield.example>",
    subject: "We received your application",
    snippet: "Thanks for applying for the Product Designer role at Brightfield. We'll be in touch.",
    date: d(2),
  },
  weak: {
    id: "fx-weak-1",
    from: "Newsletter <news@startup-weekly.example>",
    subject: "This week in startups",
    snippet: "Hiring trends, your application tips and more — thank you for your interest in our newsletter",
    date: d(1),
  },
  rejection: {
    id: "fx-reject-1",
    from: "Nimbus Data <no-reply@hire.lever.co>",
    subject: "Your application to Nimbus Data",
    snippet:
      "Thank you for applying. Unfortunately, we have decided to move forward with other candidates for the Data Scientist role.",
    date: d(0),
  },
  interviewHebrew: {
    id: "fx-interview-he-1",
    from: "תבור מערכות <hr@tavor.example>",
    subject: "זימון לראיון - מפתח/ת Full Stack",
    snippet: "היי דנה, נשמח להזמין אותך לראיון עבודה לתפקיד מפתח/ת Full Stack. מתי נוח לך?",
    date: d(0),
  },
  offer: {
    id: "fx-offer-1",
    from: "Kestrel AI People <people@kestrel.example>",
    subject: "Your offer from Kestrel AI",
    snippet: "We are pleased to offer you the position of Machine Learning Engineer at Kestrel AI.",
    date: d(0),
  },
  marketing: {
    id: "fx-marketing-1",
    from: "Deals <promo@shop.example>",
    subject: "Unfortunately your cart expired",
    snippet: "Unfortunately the items in your cart are no longer reserved. Come back soon!",
    date: d(0),
  },
};
