/**
 * Follow-up email drafts — pure helpers: templates (the offline fallback), validation of the AI
 * version, recipient detection from the Gmail scan, and the mailto / Gmail-compose links.
 * The app never sends mail: the user copies the draft or opens it in his own mail client.
 */
import { z } from "zod";

export type DraftLang = "he" | "en";
export type DraftSource = "ai" | "template" | "limited" | "edited";

export interface FollowUpFacts {
  title: string;
  company: string;
  appliedAt: Date;
  round: 1 | 2;
  /** One true sentence from the user's tailored CV or profile (never invented). */
  highlight: string | null;
  /** Up to 3 of the user's skills the posting asks for. */
  skills: string[];
  name: string | null;
  /** Recruiter first name, when known from the email sender. */
  recipientName: string | null;
}

export interface FollowUpDraft {
  round: 1 | 2;
  lang: DraftLang;
  subject: string;
  body: string;
  source: DraftSource;
  /** Recipient email, when known. */
  to: string | null;
}

export function formatAppliedDate(d: Date, lang: DraftLang): string {
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const sentence = (s: string) => {
  const t = clean(s).replace(/[.。]+$/, "");
  return t ? `${t}.` : "";
};

/** Short, polite template (the labelled fallback when AI is off, limited or returns junk). */
export function templateDraft(f: FollowUpFacts, lang: DraftLang, to: string | null = null): FollowUpDraft {
  const date = formatAppliedDate(f.appliedAt, lang);
  const skills = f.skills.slice(0, 3);
  let subject: string;
  let lines: string[];
  if (lang === "he") {
    const hi = f.highlight
      ? `התפקיד מאוד מעניין אותי. בקצרה על הניסיון שלי: ${sentence(f.highlight)}`
      : skills.length
        ? `התפקיד מאוד מעניין אותי, במיוחד בזכות הניסיון שלי עם ${skills.join(", ")}.`
        : "התפקיד עדיין מאוד מעניין אותי.";
    const hello = f.recipientName ? `שלום ${f.recipientName},` : "שלום,";
    if (f.round === 1) {
      subject = `מעקב: מועמדות למשרת ${f.title}`;
      lines = [
        hello,
        "",
        `הגשתי מועמדות למשרת ${f.title} ב-${f.company} ב-${date}, ורציתי לבדוק אם יש עדכון לגבי התהליך.`,
        hi,
        "אשמח לשמוע מה הצעדים הבאים, ולשלוח כל מידע נוסף שיעזור.",
      ];
    } else {
      subject = `מעקב נוסף: ${f.title} ב-${f.company}`;
      lines = [
        hello,
        "",
        `רציתי לחזור בקצרה לגבי המועמדות שלי למשרת ${f.title} ב-${f.company} (הוגשה ב-${date}).`,
        "התפקיד עדיין מעניין אותי מאוד, ואשמח לדעת אם התהליך עדיין פתוח.",
        "תודה על הזמן!",
      ];
    }
    lines.push("", "תודה רבה,", f.name ?? "");
  } else {
    const hi = f.highlight
      ? `I'm still very interested in the role. A quick note on my background: ${sentence(f.highlight)}`
      : skills.length
        ? `I'm still very interested in the role, especially given my experience with ${skills.join(", ")}.`
        : "I'm still very interested in the role.";
    const hello = f.recipientName ? `Hi ${f.recipientName},` : "Hello,";
    if (f.round === 1) {
      subject = `Following up: ${f.title} application`;
      lines = [
        hello,
        "",
        `I applied for the ${f.title} position at ${f.company} on ${date} and wanted to check whether there's any update on the process.`,
        hi,
        "I'd be happy to share anything else that would help.",
      ];
    } else {
      subject = `Following up again: ${f.title} at ${f.company}`;
      lines = [
        hello,
        "",
        `Just a short note about my application for the ${f.title} role at ${f.company} (submitted on ${date}).`,
        "I'm still interested and would appreciate knowing whether the position is still open.",
        "Thanks for your time!",
      ];
    }
    lines.push("", "Best regards,", f.name ?? "");
  }
  return { round: f.round, lang, subject, body: lines.join("\n").trimEnd(), source: "template", to };
}

export const draftSchema = z.object({
  subject: z.string().min(3).max(150),
  body: z.string().min(40).max(1500),
});

/** Accept an AI draft only if it's short, names the company and has no unfilled placeholders. */
export function validateAiDraft(raw: unknown, f: FollowUpFacts): { subject: string; body: string } | null {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { subject, body } = parsed.data;
  const text = `${subject}\n${body}`;
  if (/[[{<](?:name|שם|company|date|title|recruiter|your)[^\]}>]*[\]}>]/i.test(text)) return null;
  if (!text.toLowerCase().includes(f.company.toLowerCase()) && !text.toLowerCase().includes(f.title.toLowerCase()))
    return null;
  if (body.split(/\s+/).length > 160) return null;
  return {
    subject: clean(subject),
    body: body
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

/** The prompt for the one AI call (cached by the guard on identical facts). */
export function draftPrompt(f: FollowUpFacts, lang: DraftLang) {
  const facts = {
    language: lang === "he" ? "Hebrew" : "English",
    round: f.round === 1 ? "first follow-up" : "second and last follow-up (shorter)",
    jobTitle: f.title,
    company: f.company,
    appliedOn: formatAppliedDate(f.appliedAt, lang),
    highlight: f.highlight,
    skills: f.skills.slice(0, 3),
    senderName: f.name,
    recipientName: f.recipientName,
  };
  return [
    {
      role: "system" as const,
      content:
        "You write short, polite follow-up emails for a job application the candidate already submitted. " +
        "Use ONLY the facts given — never invent experience, numbers, names or dates. No placeholders in brackets. " +
        "At most 110 words, 3 short paragraphs, warm and professional, not pushy. Mention the job title, the company " +
        "and the application date. If a highlight is given, use it in one sentence. In Hebrew, use gender-neutral " +
        "first-person phrasing. Sign with the sender name if given. " +
        'Return JSON {"subject": string, "body": string} with the body as plain text (\\n for new lines).',
    },
    { role: "user" as const, content: JSON.stringify(facts) },
  ];
}

// ───────────── recipient ─────────────

const SYSTEM_SENDER =
  /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|notifications?|mailer-daemon|postmaster|bounce[s]?|alerts?|jobs-noreply|careers-noreply|automated|system)([._+-]|@)/i;
const ATS_DOMAINS =
  /@([a-z0-9-]+\.)*(greenhouse(-mail)?\.io|greenhouse\.io|lever\.co|hire\.lever\.co|myworkday(jobs)?\.com|workday\.com|smartrecruiters\.com|comeet\.(co|com)|ashbyhq\.com|workablemail\.com|workable\.com|recruitee\.com|icims\.com|bamboohr\.com|linkedin\.com|indeed\.com|glassdoor\.com|successfactors\.com|taleo\.net|jobvite\.com)$/i;

/** Parse `"Dana Levi" <dana@acme.com>` → { email, name }. */
export function parseAddress(raw: string): { email: string; name: string | null } | null {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : raw).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = m?.[1]?.trim() || null;
  return { email, name };
}

/** A human recruiter address we can reply to — not a no-reply/ATS system sender. */
export function recruiterFrom(raw: string | null | undefined): { email: string; firstName: string | null } | null {
  if (!raw) return null;
  const a = parseAddress(raw);
  if (!a || SYSTEM_SENDER.test(a.email) || ATS_DOMAINS.test(a.email)) return null;
  const first = a.name?.split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, "") || null;
  const looksHuman =
    first && first.length > 1 && !/team|talent|hr|recruit|careers?|jobs?|צוות|גיוס/i.test(a.name ?? "");
  return { email: a.email, firstName: looksHuman ? first : null };
}

// ───────────── links ─────────────

export const isEmail = (s: string | null | undefined): s is string =>
  !!s && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s.trim());

/** mailto: link with to/subject/body prefilled (to is optional). */
export function mailtoLink(d: { to: string | null; subject: string; body: string }): string {
  const to = isEmail(d.to) ? encodeURIComponent(d.to.trim()).replace(/%40/g, "@") : "";
  return `mailto:${to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
}

/** Opens Gmail's compose window (in the user's own account) with the draft filled in. */
export function gmailComposeLink(d: { to: string | null; subject: string; body: string }): string {
  const p = new URLSearchParams({ view: "cm", fs: "1" });
  if (isEmail(d.to)) p.set("to", d.to.trim());
  p.set("su", d.subject);
  p.set("body", d.body);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

/** Hebrew when the posting is mostly Hebrew; else English. */
export function pickLanguage(text: string, detect: (t: string) => DraftLang): DraftLang {
  return text.trim() ? detect(text) : "en";
}
