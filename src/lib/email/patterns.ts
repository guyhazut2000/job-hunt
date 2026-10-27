/**
 * Phrases and senders that identify application-related emails (English + Hebrew).
 * Used both to build the provider search query and to classify individual messages.
 */

export const APPLICATION_PHRASES = [
  "thank you for applying",
  "thanks for applying",
  "thank you for your application",
  "thanks for your application",
  "application received",
  "we received your application",
  "we have received your application",
  "we've received your application",
  "your application has been received",
  "your application was sent",
  "your application to",
  "your application for",
  "application submitted",
  "successfully applied",
  "thank you for your interest in",
  // Hebrew
  "תודה על פנייתך",
  "תודה על הגשת המועמדות",
  "תודה על מועמדותך",
  "קיבלנו את קורות החיים",
  "קיבלנו את מועמדותך",
  "קורות החיים שלך התקבלו",
  "מועמדותך התקבלה",
  "המועמדות שלך התקבלה",
  "הגשת מועמדות",
];

export const REJECTION_PHRASES = [
  "unfortunately",
  "not to move forward",
  "not be moving forward",
  "not moving forward",
  "decided to move forward with other candidates",
  "pursue other candidates",
  "decided to proceed with other candidates",
  "position has been filled",
  "we regret to inform",
  "will not be proceeding",
  // Hebrew
  "לצערנו",
  "החלטנו להתקדם עם מועמדים אחרים",
  "לא נוכל להתקדם",
  "לא להמשיך בתהליך",
  "המשרה אוישה",
];

export const INTERVIEW_PHRASES = [
  "invite you to an interview",
  "invite you to interview",
  "invitation to interview",
  "interview invitation",
  "schedule an interview",
  "schedule a call",
  "schedule a time",
  "phone screen",
  "would like to move forward with your application",
  "next step in our process",
  // Hebrew
  "להזמין אותך לראיון",
  "זימון לראיון",
  "לתאם ראיון",
  "לתאם שיחה",
  "ראיון עבודה",
];

export const OFFER_PHRASES = [
  "pleased to offer you",
  "happy to offer you",
  "offer letter",
  "job offer",
  "extend an offer",
  // Hebrew
  "הצעת עבודה",
  "שמחים להציע לך",
];

/** ATS / job-board sender domains (matched as suffix of the sender's domain). */
export const ATS_DOMAINS = [
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "hire.lever.co",
  "comeet.co",
  "comeet.com",
  "myworkday.com",
  "workday.com",
  "smartrecruiters.com",
  "ashbyhq.com",
  "ashbyhq.io",
  "linkedin.com",
  "workable.com",
  "workablemail.com",
  "breezy.hr",
  "recruitee.com",
  "bamboohr.com",
  "icims.com",
  "jobvite.com",
  "teamtailor.com",
  "teamtailor-mail.com",
  "pinpointhq.com",
  "personio.de",
  "hibob.com",
  "indeed.com",
  "indeedemail.com",
  "glassdoor.com",
  "alljobs.co.il",
  "drushim.co.il",
  "jobmaster.co.il",
  "gotfriends.co.il",
];

/** Shared mailbox providers: the sender domain says nothing about the company. */
export const FREEMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "walla.co.il",
];

const q = (s: string) => `"${s.replace(/"/g, "")}"`;

/** Gmail search query for the lookback window. */
export function buildGmailQuery(lookbackDays: number, opts: { statusUpdates: boolean }): string {
  const phrases = [...APPLICATION_PHRASES, ...(opts.statusUpdates ? [...INTERVIEW_PHRASES, ...OFFER_PHRASES] : [])];
  const from = ATS_DOMAINS.filter((d) => !d.startsWith("hire.")).join(" OR ");
  // Rejections rarely have a unique phrase on their own: require an application word next to it.
  const rejections = opts.statusUpdates
    ? [
        '("unfortunately" "application")',
        '("unfortunately" "applying")',
        '("לצערנו" "מועמדות")',
        '("לצערנו" "קורות החיים")',
      ]
    : [];
  const terms = [...phrases.map(q), ...rejections, `from:(${from})`];
  return `newer_than:${Math.max(1, Math.round(lookbackDays))}d -in:chats -in:sent {${terms.join(" ")}}`;
}
