import type { ContactCategory } from "@prisma/client";
import { z } from "zod";
import type { LLMProvider } from "@/lib/ai/types";
import type { FollowUpKind } from "./assistant";
import { NAME_TOKEN, type OutreachContext, type OutreachLang } from "./messages";

/** Follow-up messages (#86): after a request is accepted, or a gentle nudge when there's no answer. */

export interface FollowUpMessage {
  text: string;
  source: "template" | "ai";
}

/** Max length we allow for a follow-up (a LinkedIn message, not a connection note — but short wins). */
export const FOLLOW_UP_LIMIT = 600;

const REFERRAL_ASK = new Set<ContactCategory>(["PEER"]);

export function followUpTemplate(
  kind: FollowUpKind,
  category: ContactCategory,
  ctx: OutreachContext,
  lang: OutreachLang,
): FollowUpMessage {
  const { company, job } = ctx;
  const me = ctx.candidate.name?.trim();
  const skills = ctx.candidate.skills.slice(0, 2);
  const lines: string[] = [];
  if (lang === "he") {
    const role = job ? `משרת ${job.title}` : `המשרות ב-${company}`;
    const ask = REFERRAL_ASK.has(category)
      ? "אם הפרופיל שלי נראה לך רלוונטי, הפניה ממך תעזור לי מאוד — אשלח קו״ח וכל מה שצריך."
      : category === "RECRUITER" || category === "HR"
        ? "אשמח לשלוח קורות חיים ולשמוע מה הצעד הבא."
        : "אם מתאים לך, אשמח לשיחה קצרה של 10–15 דקות.";
    if (kind === "accepted") {
      lines.push(`היי ${NAME_TOKEN}, תודה שאישרת את הבקשה!`);
      lines.push(
        `פניתי בעקבות ${role}${skills.length ? ` — יש לי ניסיון עם ${skills.join(" ו-")}, וזה נראה לי מתאים` : ""}.`,
      );
      lines.push(ask);
    } else {
      lines.push(`היי ${NAME_TOKEN}, רק מקפיץ/ה בעדינות את ההודעה הקודמת לגבי ${role}.`);
      lines.push(ask);
      lines.push("ואם זה לא הזמן — הכול בסדר, תודה בכל מקרה!");
    }
    if (me) lines.push(me);
  } else {
    const role = job ? `the ${job.title} role` : `openings at ${company}`;
    const ask = REFERRAL_ASK.has(category)
      ? "If my background looks relevant, a referral from you would mean a lot — happy to send my CV and anything that helps."
      : category === "RECRUITER" || category === "HR"
        ? "I'd be glad to send my CV and hear about next steps."
        : "If you're open to it, I'd love a quick 10–15 minute chat.";
    if (kind === "accepted") {
      lines.push(`Hi ${NAME_TOKEN}, thanks for connecting!`);
      lines.push(
        `I reached out about ${role}${skills.length ? ` — I work with ${skills.join(" and ")} and it looks like a good fit` : ""}.`,
      );
      lines.push(ask);
    } else {
      lines.push(`Hi ${NAME_TOKEN}, just gently bumping my earlier note about ${role}.`);
      lines.push(ask);
      lines.push("And if now isn't a good time, no worries at all — thanks either way!");
    }
    if (me) lines.push(me);
  }
  return { text: lines.join("\n\n"), source: "template" };
}

const aiSchema = z.object({ text: z.string().min(30) });

/** AI follow-up; the template is the fallback (mock provider, errors, too long, no {{name}}). */
export async function generateFollowUp(
  provider: LLMProvider,
  kind: FollowUpKind,
  category: ContactCategory,
  ctx: OutreachContext,
  lang: OutreachLang,
): Promise<FollowUpMessage> {
  const fallback = followUpTemplate(kind, category, ctx, lang);
  if (provider.name === "mock") return fallback;
  try {
    const raw = await provider.complete(
      [
        {
          role: "system",
          content: [
            `You write one short LinkedIn follow-up message for a job seeker in Israel, in ${lang === "he" ? "natural modern Israeli Hebrew" : "friendly, concise English"}.`,
            kind === "accepted"
              ? "The recipient just accepted the connection request. Thank them briefly, then make the actual ask."
              : "The recipient hasn't answered the earlier request/message. Gently bump it, restate the ask, give an easy out.",
            `The recipient's role: ${category}. Return JSON {"text": string}, 40–90 words, short paragraphs, no links, no hashtags.`,
            `Start with a greeting that contains the literal placeholder ${NAME_TOKEN}. Only use facts from the profile below.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            company: ctx.company,
            job: ctx.job?.title ?? null,
            candidate: { ...ctx.candidate, skills: ctx.candidate.skills.slice(0, 6) },
          }),
        },
      ],
      { json: true, schema: aiSchema, maxTokens: 400 },
    );
    const parsed = aiSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    const text = parsed.data.text.trim();
    return text.includes(NAME_TOKEN) && text.length <= FOLLOW_UP_LIMIT ? { text, source: "ai" } : fallback;
  } catch {
    return fallback;
  }
}
