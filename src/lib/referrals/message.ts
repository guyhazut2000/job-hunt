import { z } from "zod";

/**
 * Referral-request message (#92): Hebrew or English. One guarded AI call (feature "referral_request")
 * with a deterministic template fallback. Copy-only — the app never sends it.
 */

export type ReferralLang = "he" | "en";

export interface ReferralFacts {
  contactName: string;
  relationship: string | null;
  company: string;
  jobTitle: string | null;
  /** The posting on the company's own site / ATS (never a scraped LinkedIn page). */
  jobUrl: string | null;
  senderName: string | null;
  /** One true sentence about the candidate (profile headline/summary), if any. */
  highlight: string | null;
  skills: string[];
}

const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export function templateMessage(f: ReferralFacts, lang: ReferralLang): string {
  const name = first(f.contactName);
  const job = f.jobTitle;
  if (lang === "en") {
    const lines = [
      `Hi ${name},`,
      "",
      `${f.relationship ? `Hope you're doing well since ${f.relationship}. ` : "Hope you're doing well. "}I saw that ${f.company} is hiring${job ? ` for a ${job}` : ""} and I'm very interested.`,
      f.highlight || f.skills.length
        ? `${f.highlight ? f.highlight.replace(/\.?$/, ".") : ""}${f.skills.length ? ` I work a lot with ${f.skills.join(", ")}.` : ""}`.trim()
        : "",
      `Would you be comfortable referring me${job ? " for this role" : ""}? I can send my CV and a short blurb so it's easy for you.${f.jobUrl ? `\n${f.jobUrl}` : ""}`,
      "",
      "Totally fine if not, thanks either way!",
      f.senderName ? f.senderName : "",
    ];
    return lines
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n")
      .trim();
  }
  const lines = [
    `היי ${name},`,
    "",
    `${f.relationship ? `מקווה שהכול טוב מאז ${f.relationship}. ` : "מקווה שהכול טוב. "}ראיתי ש-${f.company} מגייסת${job ? ` ל-${job}` : ""} ואני מאוד מתעניין/ת.`,
    f.highlight || f.skills.length
      ? `${f.highlight ? f.highlight.replace(/\.?$/, ".") : ""}${f.skills.length ? ` אני עובד/ת הרבה עם ${f.skills.join(", ")}.` : ""}`.trim()
      : "",
    `יהיה לך נוח להגיש אותי דרך חבר מביא חבר? אשלח קורות חיים ותקציר קצר כדי שיהיה לך קל.${f.jobUrl ? `\n${f.jobUrl}` : ""}`,
    "",
    "ואם לא מתאים, הכול בסדר. תודה בכל מקרה!",
    f.senderName ? f.senderName : "",
  ];
  return lines
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
}

export const aiMessageSchema = z.object({ body: z.string().min(40).max(1200) });

export function messagePrompt(f: ReferralFacts, lang: ReferralLang) {
  return [
    {
      role: "system" as const,
      content:
        'You write a short, warm message asking an acquaintance for an employee referral ("חבר מביא חבר"). ' +
        "Use ONLY the facts given: never invent shared history, experience, numbers or names. No placeholders in brackets. " +
        "At most 90 words, plain text, 3-4 short lines, friendly and low-pressure (make it easy to say no). Mention the " +
        "company and the job title if given, offer to send a CV. If a job URL is given, include it as-is on its own line. " +
        "In Hebrew, use gender-neutral first-person phrasing where possible. Sign with the sender name if given. " +
        `Write in ${lang === "he" ? "Hebrew" : "English"}. Return JSON {"body": string} (\\n for new lines).`,
    },
    { role: "user" as const, content: JSON.stringify(f) },
  ];
}

/** Accept an AI draft only if it names the company, has no placeholders, and keeps the given URL. */
export function validateAiMessage(raw: unknown, f: ReferralFacts): string | null {
  const p = aiMessageSchema.safeParse(raw);
  if (!p.success) return null;
  const body = p.data.body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (/[[{<][^\]}>]{1,30}[\]}>]/.test(body)) return null;
  if (!body.toLowerCase().includes(f.company.toLowerCase())) return null;
  if (f.jobUrl && !body.includes(f.jobUrl)) return null;
  if (body.split(/\s+/).length > 130) return null;
  return body;
}
