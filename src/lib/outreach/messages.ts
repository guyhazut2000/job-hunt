import type { ContactCategory } from "@prisma/client";
import { z } from "zod";
import type { LLMProvider } from "@/lib/ai/types";

export type OutreachLang = "he" | "en";

/** LinkedIn's connection-note limit. */
export const SHORT_LIMIT = 300;
/** Room reserved for the recipient's name, which replaces {{name}} on the client. */
export const NAME_BUDGET = 24;
export const NAME_TOKEN = "{{name}}";

export interface OutreachContext {
  company: string;
  job?: { title: string; url: string } | null;
  candidate: {
    name?: string | null;
    headline?: string | null;
    years?: number | null;
    skills: string[];
    desiredRole?: string | null;
  };
}

export interface OutreachMessage {
  short: string;
  long: string;
  subject: string;
  source: "template" | "ai";
  /** Friendly note when AI was skipped because of usage limits (template shown instead). */
  notice?: string;
}

/** Length the short note will have once a name of up to NAME_BUDGET chars is filled in. */
export const budgetLength = (s: string) => s.replace(NAME_TOKEN, "x".repeat(NAME_BUDGET)).length;

/** Replace {{name}} with the recipient name, or drop it cleanly ("Hi {{name}}," → "Hi,"). */
export function personalize(text: string, name?: string | null): string {
  const n = name?.trim();
  return n ? text.replaceAll(NAME_TOKEN, n) : text.replaceAll(` ${NAME_TOKEN}`, "").replaceAll(NAME_TOKEN, "");
}

const join = (xs: (string | null | undefined | false)[], sep = " ") => xs.filter(Boolean).join(sep);

function list(items: string[], lang: OutreachLang) {
  if (items.length <= 1) return items[0] ?? "";
  const and = lang === "he" ? " ו-" : " and ";
  return `${items.slice(0, -1).join(", ")}${and}${items.at(-1)}`;
}

function yearsPhrase(y: number, lang: OutreachLang) {
  if (lang === "en") return `${y} year${y === 1 ? "" : "s"} of experience`;
  if (y === 1) return "שנת ניסיון";
  if (y === 2) return "שנתיים ניסיון";
  return `${y} שנות ניסיון`;
}

/** "Backend Engineer · 6 years of experience with Node.js, Go and PostgreSQL" at decreasing detail levels. */
function aboutVariants(c: OutreachContext["candidate"], lang: OutreachLang): string[] {
  const headline = (c.headline || c.desiredRole || "").trim();
  const yrs = c.years && c.years > 0 ? yearsPhrase(Math.round(c.years), lang) : "";
  const withSkills = (n: number) => {
    const sk = c.skills.slice(0, n);
    if (!sk.length) return "";
    return lang === "he" ? `עם ${list(sk, lang)}` : `with ${list(sk, lang)}`;
  };
  const build = (n: number, withHeadline = true) => {
    const exp = join([yrs, withSkills(n)]);
    return join([withHeadline && headline, exp], ", ");
  };
  const out = [build(3), build(2), build(1), build(0), build(0, false)].filter(Boolean);
  return [...new Set(out), ""];
}

/** Hebrew prefix "ב-" before Latin names, plain "ב" before Hebrew ones. */
const be = (name: string) => (/^[\u0590-\u05FF]/.test(name) ? `ב${name}` : `ב-${name}`);

interface Parts {
  greet: string;
  hook: (titleMax?: number) => string;
  ask: string;
  longBody: (about: string) => string[];
  subject: string;
}

function truncTitle(t: string, max?: number) {
  return max && t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function parts(category: ContactCategory, ctx: OutreachContext, lang: OutreachLang): Parts {
  const { company, job } = ctx;
  const role = (m?: number) => (job ? truncTitle(job.title, m) : "");
  const link = job?.url ?? "";
  const me = ctx.candidate.name?.trim();
  if (lang === "he") {
    const greet = `היי ${NAME_TOKEN},`;
    const sawJob = (m?: number) => (job ? `ראיתי שנפתחה משרת ${role(m)} ${be(company)}` : `ראיתי ש-${company} מגייסת`);
    const sign = me ? ["תודה מראש,", me] : ["תודה מראש!"];
    const aboutLine = (a: string) => (a ? `קצת עליי: ${a}.` : "");
    switch (category) {
      case "RECRUITER":
        return {
          greet,
          hook: (m) => `${sawJob(m)} ואשמח להגיש מועמדות.`,
          ask: "אשמח להתחבר ולשמוע על התהליך!",
          subject: job ? `מועמדות למשרת ${job.title}` : `מועמדות ${be(company)}`,
          longBody: (a) => [
            greet,
            `${sawJob()}, והתפקיד נראה לי התאמה מצוינת.${link ? `\n${link}` : ""}`,
            aboutLine(a),
            "אשמח לשלוח קורות חיים ולשמוע מה הצעדים הבאים בתהליך. אם נוח לך, אשמח גם לשיחה קצרה.",
            sign.join("\n"),
          ],
        };
      case "PEER":
        return {
          greet,
          hook: (m) => `${sawJob(m)}, ונראה שזה בצוות שלך.`,
          ask: "אשמח לשמוע ממך איך זה לעבוד שם, ואם זה נראה מתאים — גם להפניה 🙏",
          subject: job ? `שאלה על משרת ${job.title}` : `שאלה על העבודה ${be(company)}`,
          longBody: (a) => [
            greet,
            `${sawJob()}, ונראה לי שזה בצוות שלך או קרוב אליו.${link ? `\n${link}` : ""}`,
            aboutLine(a),
            "אשמח לשמוע ממך בכמה מילים איך זה לעבוד שם ומה באמת חשוב בצוות. אם אחרי זה הפרופיל שלי נראה לך רלוונטי, הפניה ממך תעזור לי מאוד — אשלח קו״ח וכל מה שצריך כדי שיהיה לך קל.",
            "ואם לא מתאים, הכול טוב לגמרי.",
            sign.join("\n"),
          ],
        };
      case "TEAM_LEAD":
        return {
          greet,
          hook: (m) => `${sawJob(m)}.`,
          ask: "אשמח להתחבר ולשמוע מה חשוב לך בצוות, ואם יש התאמה — לדבר על התפקיד.",
          subject: job ? `לגבי משרת ${job.title} בצוות שלך` : `לגבי הצוות שלך ${be(company)}`,
          longBody: (a) => [
            greet,
            `${sawJob()}, ונראה לי שזה בצוות שלך.${link ? `\n${link}` : ""}`,
            aboutLine(a),
            "אשמח לשיחה קצרה של 15 דקות כדי להבין את האתגרים של הצוות ולספר איך אוכל לתרום. אם עדיף לך, אשמח גם להגיש דרך התהליך הרגיל ולציין שדיברנו.",
            sign.join("\n"),
          ],
        };
      case "SENIOR_MGMT":
        return {
          greet,
          hook: (m) => `${sawJob(m)}, והכיוון של החברה מאוד מתחבר לי.`,
          ask: "אשמח להתחבר, ואם אפשר — לקבל הכוונה לאדם הנכון בצוות.",
          subject: job ? `${job.title} — פנייה קצרה` : `פנייה קצרה לגבי ${company}`,
          longBody: (a) => [
            greet,
            `כדי לא לגזול ממך זמן, בקצרה: ${sawJob()}, והכיוון של ${company} מאוד מתחבר לי.${link ? `\n${link}` : ""}`,
            aboutLine(a),
            "אשמח אם אפשר להפנות אותי לראש הצוות או לגורם הגיוס הרלוונטי. כמובן שאגיש גם בתהליך הרגיל.",
            sign.join("\n"),
          ],
        };
      case "FOUNDER":
        return {
          greet,
          hook: (m) => `מה שאתם בונים ${be(company)} מאוד מעניין אותי${job ? `, וראיתי שנפתחה משרת ${role(m)}` : ""}.`,
          ask: "אשמח להתחבר ולשמוע לאן החברה הולכת.",
          subject: job ? `${job.title} ${be(company)}` : `${company} — רוצה להצטרף`,
          longBody: (a) => [
            greet,
            `מה שאתם בונים ${be(company)} מאוד מעניין אותי${job ? `, וראיתי שנפתחה משרת ${job.title}` : ""}.${link ? `\n${link}` : ""}`,
            aboutLine(a),
            "ברור לי שהזמן שלך יקר — אם זה רלוונטי, אשמח להפניה לאדם הנכון, או לשיחה קצרה כשנוח לך.",
            sign.join("\n"),
          ],
        };
      case "HR":
        return {
          greet,
          hook: (m) => `${sawJob(m)} ואשמח לדעת למי כדאי לפנות.`,
          ask: "תודה מראש!",
          subject: job ? `פנייה לגבי משרת ${job.title}` : `פנייה לגבי משרות ${be(company)}`,
          longBody: (a) => [
            greet,
            `${sawJob()} ואשמח לדעת למי כדאי לפנות לגביה, או מה הדרך הכי טובה להגיש.${link ? `\n${link}` : ""}`,
            aboutLine(a),
            "אשמח לשלוח קורות חיים בכל דרך שנוחה לכם.",
            sign.join("\n"),
          ],
        };
    }
  }
  // English
  const greet = `Hi ${NAME_TOKEN},`;
  const sawJob = (m?: number) => (job ? `I saw the ${role(m)} opening at ${company}` : `I saw ${company} is hiring`);
  const sign = me ? ["Thanks,", me] : ["Thanks!"];
  const aboutLine = (a: string) => (a ? `A bit about me: ${a}.` : "");
  switch (category) {
    case "RECRUITER":
      return {
        greet,
        hook: (m) => `${sawJob(m)} and I'd love to apply.`,
        ask: "Happy to connect and hear about the process!",
        subject: job ? `Application: ${job.title}` : `Applying at ${company}`,
        longBody: (a) => [
          greet,
          `${sawJob()} and it looks like a strong fit.${link ? `\n${link}` : ""}`,
          aboutLine(a),
          "I'd be glad to send my CV and hear about next steps. Happy to jump on a short call whenever suits you.",
          sign.join("\n"),
        ],
      };
    case "PEER":
      return {
        greet,
        hook: (m) => `${sawJob(m)} — looks like it's on your team.`,
        ask: "Would love to hear what it's like there and, if it seems a fit, a referral 🙏",
        subject: job ? `Quick question about the ${job.title} role` : `Quick question about ${company}`,
        longBody: (a) => [
          greet,
          `${sawJob()}, and it looks like it's on (or near) your team.${link ? `\n${link}` : ""}`,
          aboutLine(a),
          "I'd love a few words on what it's like there and what really matters on the team. If my background then looks relevant, a referral from you would mean a lot — I'll send my CV and anything that makes it easy.",
          "And if it's not a fit, no worries at all.",
          sign.join("\n"),
        ],
      };
    case "TEAM_LEAD":
      return {
        greet,
        hook: (m) => `${sawJob(m)}.`,
        ask: "I'd love to connect, hear what matters most on your team and, if there's a fit, talk about the role.",
        subject: job ? `About the ${job.title} role on your team` : `About your team at ${company}`,
        longBody: (a) => [
          greet,
          `${sawJob()}, which looks like it's on your team.${link ? `\n${link}` : ""}`,
          aboutLine(a),
          "Would you be open to a 15-minute chat? I'd like to understand the team's challenges and share how I could contribute. Happy to apply through the regular process too and mention we spoke.",
          sign.join("\n"),
        ],
      };
    case "SENIOR_MGMT":
      return {
        greet,
        hook: (m) => `${sawJob(m)} — the direction ${company} is taking really resonates with me.`,
        ask: "I'd love to connect, or be pointed to the right person on the team.",
        subject: job ? `${job.title} — a short note` : `A short note about ${company}`,
        longBody: (a) => [
          greet,
          `I'll keep this short: ${sawJob()}, and the direction ${company} is taking really resonates with me.${link ? `\n${link}` : ""}`,
          aboutLine(a),
          "Could you point me to the hiring manager or recruiter for this role? I'll of course apply through the regular process as well.",
          sign.join("\n"),
        ],
      };
    case "FOUNDER":
      return {
        greet,
        hook: (m) =>
          `I'm genuinely excited by what you're building at ${company}${job ? ` and saw the ${role(m)} opening` : ""}.`,
        ask: "Would love to connect and hear where the company is heading.",
        subject: job ? `${job.title} at ${company}` : `Joining ${company}`,
        longBody: (a) => [
          greet,
          `I'm genuinely excited by what you're building at ${company}${job ? ` and saw the ${job.title} opening` : ""}.${link ? `\n${link}` : ""}`,
          aboutLine(a),
          "I know your time is precious — if it's relevant, I'd appreciate an intro to the right person, or a short chat whenever it suits you.",
          sign.join("\n"),
        ],
      };
    case "HR":
      return {
        greet,
        hook: (m) => `${sawJob(m)} and wanted to ask who's the best person to reach out to.`,
        ask: "Thanks in advance!",
        subject: job ? `About the ${job.title} opening` : `About openings at ${company}`,
        longBody: (a) => [
          greet,
          `${sawJob()} and wanted to ask who's the best person to reach out to, or the best way to apply.${link ? `\n${link}` : ""}`,
          aboutLine(a),
          "Happy to send my CV in whatever way is easiest for you.",
          sign.join("\n"),
        ],
      };
  }
}

/** Pick the richest short note that still fits SHORT_LIMIT once a name is filled in. */
function fitShort(p: Parts, abouts: string[]): string {
  const make = (about: string, titleMax?: number, withAsk = true) =>
    join([p.greet, p.hook(titleMax), about && `${about}.`, withAsk && p.ask]);
  for (const titleMax of [undefined, 60, 40]) {
    for (const about of abouts) {
      const s = make(about, titleMax);
      if (budgetLength(s) <= SHORT_LIMIT) return s;
    }
  }
  const bare = make("", 30, false);
  if (budgetLength(bare) <= SHORT_LIMIT) return bare;
  return `${bare.slice(0, SHORT_LIMIT - NAME_BUDGET - 1).trimEnd()}…`;
}

export function templateMessage(category: ContactCategory, ctx: OutreachContext, lang: OutreachLang): OutreachMessage {
  const p = parts(category, ctx, lang);
  const abouts = aboutVariants(ctx.candidate, lang);
  return {
    short: fitShort(p, abouts),
    long: p
      .longBody(abouts[0] ?? "")
      .filter(Boolean)
      .join("\n\n"),
    subject: p.subject,
    source: "template",
  };
}

const AUDIENCE: Record<ContactCategory, string> = {
  RECRUITER: "a recruiter / talent acquisition partner. Be direct: you want to apply, ask about the process.",
  PEER: "a peer engineer on the relevant team. Warm and humble; ask what it's like, then gently ask for a referral, give an easy out.",
  TEAM_LEAD: "the likely hiring manager / team lead. Show fit with the team's work, ask for a 15-minute chat.",
  SENIOR_MGMT: "a VP R&D / CTO. Very brief and respectful of their time; ask to be pointed to the right person.",
  FOUNDER: "the CEO / a founder. Show genuine interest in the company's mission; ask for an intro or a short chat.",
  HR: "an HR / people partner. Ask who to contact and the best way to apply.",
};

const aiSchema = z.object({ short: z.string().min(20), long: z.string().min(60), subject: z.string().min(3).max(140) });

/**
 * AI-personalised draft. Falls back to the template on the mock provider, on any provider error,
 * or when the model ignores the constraints (too long, missing {{name}}).
 */
export async function generateOutreach(
  provider: LLMProvider,
  category: ContactCategory,
  ctx: OutreachContext,
  lang: OutreachLang,
): Promise<OutreachMessage> {
  const fallback = templateMessage(category, ctx, lang);
  if (provider.name === "mock") return fallback;
  try {
    const raw = await provider.complete(
      [
        {
          role: "system",
          content: [
            `You write LinkedIn outreach messages for a job seeker in Israel. Write in ${lang === "he" ? "natural, modern Israeli Hebrew (gender-neutral wording toward the recipient where possible)" : "concise, friendly English"}.`,
            `The recipient is ${AUDIENCE[category]}`,
            `Return JSON {"short": string, "long": string, "subject": string}.`,
            `"short" is a connection note: at most ${SHORT_LIMIT - NAME_BUDGET} characters, 2–3 sentences, no links.`,
            `"long" is an InMail of 80–160 words in short paragraphs; include the job link once if given.`,
            `Start both with a greeting that contains the literal placeholder ${NAME_TOKEN} for the recipient's first name.`,
            "Only use facts from the profile below — never invent employers, numbers or skills. No hashtags, at most one emoji.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            company: ctx.company,
            job: ctx.job ?? null,
            candidate: { ...ctx.candidate, skills: ctx.candidate.skills.slice(0, 8) },
          }),
        },
      ],
      { json: true, schema: aiSchema, maxTokens: 700 },
    );
    const parsed = aiSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    const { short, long, subject } = parsed.data;
    const ok = short.includes(NAME_TOKEN) && long.includes(NAME_TOKEN) && budgetLength(short) <= SHORT_LIMIT;
    return ok ? { short: short.trim(), long: long.trim(), subject: subject.trim(), source: "ai" } : fallback;
  } catch {
    return fallback;
  }
}
