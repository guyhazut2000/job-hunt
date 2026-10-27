import type { ApplicationStatus } from "@prisma/client";
import {
  APPLICATION_PHRASES,
  ATS_DOMAINS,
  FREEMAIL_DOMAINS,
  INTERVIEW_PHRASES,
  OFFER_PHRASES,
  REJECTION_PHRASES,
} from "./patterns";

/** Minimal message shape. Bodies are optional, transient and never persisted. */
export type MailMessage = {
  id: string;
  threadId?: string | null;
  from: string;
  subject: string;
  date: Date;
  snippet: string;
  body?: string | null;
};

export type ParsedFrom = { name: string; address: string; domain: string };

export function parseFrom(raw: string): ParsedFrom {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const address = (m ? m[2] : raw).trim().toLowerCase();
  const name = (m ? m[1] : "").trim();
  const domain = address.includes("@") ? address.split("@").pop()! : "";
  return { name, address, domain };
}

export function domainMatches(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function isAtsSender(from: ParsedFrom): boolean {
  return domainMatches(from.domain, ATS_DOMAINS);
}

/** Decode common HTML entities and squash whitespace (snippets arrive HTML-escaped). */
export function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export type DetectedKind = "APPLICATION" | "REJECTED" | "INTERVIEW" | "OFFER";

export type Classification = {
  kind: DetectedKind | null;
  /** true when the deciding phrase appeared in the subject (or was decisive anywhere) */
  strong: boolean;
  signals: string[];
};

const has = (hay: string, phrases: string[]) => phrases.filter((p) => hay.includes(p));

/**
 * Decide what an email is about. Rejection/offer/interview phrases are specific enough to win
 * even when the subject only says "Your application to X".
 */
export function classify(msg: Pick<MailMessage, "subject" | "snippet" | "body">): Classification {
  const subject = cleanText(msg.subject).toLowerCase();
  const text = cleanText(`${msg.snippet} ${msg.body ?? ""}`).toLowerCase();
  const all = `${subject} ${text}`;
  const signals: string[] = [];
  const scores: Record<DetectedKind, number> = { APPLICATION: 0, REJECTED: 0, INTERVIEW: 0, OFFER: 0 };

  const appSubject = has(subject, APPLICATION_PHRASES);
  const appText = has(text, APPLICATION_PHRASES);
  if (appSubject.length) scores.APPLICATION = 3;
  else if (appText.length) scores.APPLICATION = 2;
  signals.push(...[...appSubject, ...appText].map((p) => `phrase:${p}`));

  for (const [kind, list] of [
    ["REJECTED", REJECTION_PHRASES],
    ["INTERVIEW", INTERVIEW_PHRASES],
    ["OFFER", OFFER_PHRASES],
  ] as const) {
    const hits = has(all, list);
    if (hits.length) {
      scores[kind] = 4;
      signals.push(...hits.map((p) => `${kind.toLowerCase()}:${p}`));
    }
  }
  // "If shortlisted we'll contact you to schedule an interview" inside a confirmation is not an invite.
  if (scores.INTERVIEW && appSubject.length && !has(subject, INTERVIEW_PHRASES).length) {
    const conditional =
      /\b(?:if|should|once|may|might|in case)\b[^.]{0,80}(?:interview|call)|אם[^.]{0,80}(?:ראיון|שיחה)/;
    if (conditional.test(text)) scores.INTERVIEW = 1;
  }
  // A bare "interview"/"ראיון" in the subject (e.g. "Interview with Acme") is a good hint too.
  if (!scores.INTERVIEW && /\binterview\b|ראיון/.test(subject)) {
    scores.INTERVIEW = 3.5;
    signals.push("interview:subject");
  }

  // Priority on ties: offer > rejection > interview > application.
  const order: DetectedKind[] = ["OFFER", "REJECTED", "INTERVIEW", "APPLICATION"];
  let best: DetectedKind | null = null;
  for (const k of order) if (scores[k] >= 2 && (best === null || scores[k] > scores[best])) best = k;
  // "Unfortunately" alone (no application context at all) is too weak to be a rejection.
  if (
    best === "REJECTED" &&
    !scores.APPLICATION &&
    !/application|applying|position|role|מועמד|משרה|תפקיד|קורות/.test(all)
  )
    best = null;
  const strong = best === "APPLICATION" ? appSubject.length > 0 : best !== null;
  return { kind: best, strong, signals };
}

export function statusForKind(kind: DetectedKind): ApplicationStatus {
  return kind === "APPLICATION" ? "APPLIED" : kind;
}

// ---------------------------------------------------------------------------
// Company / title extraction
// ---------------------------------------------------------------------------

export type Extracted = {
  company: string | null;
  companySource: "text" | "sender" | "domain" | null;
  title: string | null;
};

const GENERIC_SENDER =
  /^(no-?reply|do-?not-?reply|notifications?|jobs?|careers?|recruiting|hiring|talent|hr|linkedin|greenhouse|lever|workday|comeet|smartrecruiters|ashby|workable|indeed|glassdoor|alljobs|drushim|team|support|info|משאבי אנוש|גיוס|צוות גיוס|דרושים)$/i;

const SENDER_SUFFIX =
  /\s*(?:[-–|,]\s*)?(?:(?:the\s+)?(?:recruiting|recruitment|talent acquisition|talent|hiring|careers?|jobs|people|hr|human resources)(?:\s+team)?|team|via\s+\w+|צוות\s+הגיוס|צוות\s+גיוס|גיוס|משאבי\s+אנוש)\s*$/i;

/** Strip trailing punctuation / boilerplate around a captured company or title. */
export function tidy(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’\-–:]+|[\s"'“”‘’.!,;:\-–]+$/g, "")
    .replace(/^(?:the|our)\s+/i, "")
    .trim();
  if (!t || t.length < 2 || t.length > 80) return null;
  return t;
}

export function companyFromSenderName(name: string): string | null {
  let n = name.trim();
  const careersAt = n.match(/^(?:careers|jobs|recruiting|hiring team)\s+(?:at|@)\s+(.+)$/i);
  if (careersAt) n = careersAt[1];
  for (let i = 0; i < 3; i++) n = n.replace(SENDER_SUFFIX, "").trim();
  n = n.replace(/\s+@\s+.*$/, "").trim();
  if (!n || GENERIC_SENDER.test(n) || /@/.test(n)) return null;
  return tidy(n);
}

export function companyFromDomain(from: ParsedFrom): string | null {
  if (!from.domain || isAtsSender(from) || domainMatches(from.domain, FREEMAIL_DOMAINS)) return null;
  const labels = from.domain.split(".");
  // careers.acme.co.il -> acme ; mail.acme.com -> acme
  const tld2 = labels.length >= 3 && /^(co|com|org|net|ac|gov)$/.test(labels[labels.length - 2]);
  const core = labels[labels.length - (tld2 ? 3 : 2)];
  return core && core.length > 1 ? core : null;
}

const STOP = String.raw`(?=\s*(?:[.!,;|()\n]|\s[-–]\s|$|\s(?:has|was|is|and|we|has been|in|on|located|based)\b))`;

const TITLE_PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:for|to)\s+the\s+(.+?)\s+(?:position|role|opening|job)\b`, "i"),
  new RegExp(String.raw`(?:position|role)\s+of\s+(.+?)${STOP}`, "i"),
  new RegExp(
    String.raw`(?:applying|applied|application)\s+(?:for|to)\s+(?:the\s+)?(?:position\s+of\s+)?(.+?)\s+(?:at|with|@)\s+`,
    "i",
  ),
  new RegExp(String.raw`(?:applying|applied|application)\s+for\s+(?:the\s+)?(?:position\s+of\s+)?(.+?)${STOP}`, "i"),
  // LinkedIn: "Your application was sent to Acme. Senior Engineer · Acme · Tel Aviv"
  /sent to [^.]+\.\s+(.+?)\s+·/i,
  new RegExp(String.raw`(?:לתפקיד|למשרת|למשרה|במשרת)\s*:?\s*(.+?)(?=\s+(?:ב|ל)(?:חברת\s+|-)|[.,!;\n]|\s[-–]\s|$)`),
];

const COMPANY_PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:position|role|opening|job)\s+(?:at|with)\s+(.+?)${STOP}`, "i"),
  new RegExp(
    String.raw`(?:applying|applied|application|interest)\s+(?:for\s+.+?\s+)?(?:to|at|with|in)\s+(?:join(?:ing)?\s+)?(.+?)${STOP}`,
    "i",
  ),
  new RegExp(String.raw`application\s+(?:was\s+)?sent\s+to\s+(.+?)${STOP}`, "i"),
  new RegExp(String.raw`\b(?:at|with)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})${STOP}`),
  new RegExp(String.raw`(?:בחברת|לחברת|בחברה|ב-|ל-)\s*(.+?)(?=[.,!;\n]|\s[-–]\s|\s(?:התקבל|ונחזור|נחזור|ואנו)|$)`),
];

const BAD_TITLE = /^(?:your|our|this|a|an|the)?\s*(?:application|position|role|job|interest)$/i;

function firstMatch(patterns: RegExp[], texts: string[], reject?: (s: string) => boolean): string | null {
  for (const text of texts)
    for (const re of patterns) {
      const v = tidy(text.match(re)?.[1]);
      if (v && !(reject && reject(v))) return v;
    }
  return null;
}

export function extract(msg: Pick<MailMessage, "from" | "subject" | "snippet" | "body">): Extracted {
  const from = parseFrom(msg.from);
  const texts = [cleanText(msg.subject), cleanText(msg.snippet), cleanText(msg.body ?? "").slice(0, 2000)].filter(
    Boolean,
  );
  const rawTitle = firstMatch(TITLE_PATTERNS, texts, (v) => BAD_TITLE.test(v) || v.split(" ").length > 9);
  // "Senior Engineer at Acme" / "מפתח/ת ב-Acme" → keep only the role.
  const title = rawTitle ? rawTitle.replace(/\s+(?:at|@|with|ב-|בחברת)\s*[^,]+$/i, "").trim() || rawTitle : null;
  const isBadCompany = (v: string) =>
    BAD_TITLE.test(v) ||
    /^(?:us|you|our team|the team|this time|the position|this role|newsletter|our newsletter|webinar|event|updates|community|product|products|הצוות|אותנו)$/i.test(
      v,
    ) ||
    v.split(" ").length > 6;
  const textCompany = firstMatch(COMPANY_PATTERNS, texts, isBadCompany);
  if (textCompany) return { company: textCompany, companySource: "text", title };
  const sender = companyFromSenderName(from.name);
  if (sender) return { company: sender, companySource: "sender", title };
  const dom = companyFromDomain(from);
  return { company: dom, companySource: dom ? "domain" : null, title };
}
