/**
 * "שפר ניסוח" — reword one CV bullet into the X-Y-Z shape WITHOUT inventing anything.
 * The model may only reuse facts present in the bullet, the role/company, the user's CV corpus
 * and a metric the user typed in. Any rewrite that introduces a new number or technology is
 * rejected (same check as tailoring, src/lib/cv-tailor/tailor.ts). When the bullet has no
 * metric, we ask the user for the real one instead of guessing.
 */
import { z } from "zod";
import { guardedLLM, type LLMMessage } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { introducesFacts } from "@/lib/cv-tailor/tailor";
import { extractTech } from "@/lib/taxonomy";
import { LIMITS } from "./rules";
import { hasFirstPersonPronoun, hasMetric, startsWithActionVerb } from "./verbs";

export interface ImproveInput {
  text: string;
  lang: "he" | "en";
  role?: string;
  company?: string;
  /** A number/result the user typed after we asked. */
  metric?: string;
  /** All of the user's CV text (allowed facts). */
  corpus: string;
}

export type ImproveStatus = "ok" | "rejected" | "off" | "limited" | "error" | "same";
export interface ImproveResult {
  status: ImproveStatus;
  rewrite: string | null;
  /** What we need from the user to make it stronger (no metric / no verb). */
  ask: ("metric" | "verb")[];
  /** Model's own follow-up question, when it gave one (already checked to carry no facts). */
  question: string | null;
}

const NUM_RE = /\d+(?:[.,]\d+)?/g;

export const improveSchema = z.object({
  rewrite: z.string().max(600),
  missingMetricQuestion: z.string().max(300).nullable().optional(),
});

/** What the bullet is missing, computed locally (also the mock / offline answer). */
export function missingParts(text: string, metric?: string): ("metric" | "verb")[] {
  const out: ("metric" | "verb")[] = [];
  if (!hasMetric(`${text} ${metric ?? ""}`)) out.push("metric");
  if (!startsWithActionVerb(text)) out.push("verb");
  return out;
}

export function improvePrompt(i: ImproveInput): LLMMessage[] {
  const lang = i.lang === "en" ? "English" : "Hebrew";
  return [
    {
      role: "system",
      content:
        `You edit ONE CV bullet in ${lang}. Rewrite it as: strong past-tense action verb + what was done + the measurable result (Google's X-Y-Z formula). ` +
        "HARD RULES: use ONLY facts present in the bullet, the role context, or the metric the user supplied. " +
        "Never add a number, percentage, duration, team size, technology, company, product or achievement that is not given. " +
        "If no metric is given, do NOT make one up — keep the result qualitative and set missingMetricQuestion to one short question asking the user for the real number. " +
        `No first person ("I"/"אני"), no trailing period, at most ${LIMITS.bulletIdealMax} characters. ` +
        (i.lang === "he"
          ? "Write natural Israeli-CV Hebrew in past first-person verb form (הובלתי, פיתחתי, קיצרתי); keep tech names in English. "
          : "Use concise professional CV English. ") +
        'Return JSON {"rewrite": string, "missingMetricQuestion": string | null}.',
    },
    {
      role: "user",
      content: JSON.stringify({
        bullet: i.text,
        role: i.role ?? "",
        company: i.company ?? "",
        userSuppliedMetric: i.metric ?? "",
      }),
    },
  ];
}

/** Accept a rewrite only if it adds no facts and is a sane CV bullet. */
export function acceptRewrite(i: ImproveInput, out: string): string | null {
  const r = out.trim().replace(/[.。]+$/, "");
  if (!r || r.length > LIMITS.bulletMaxChars) return null;
  const allowedSrc = `${i.text}\n${i.metric ?? ""}\n${i.role ?? ""}\n${i.company ?? ""}\n${i.corpus}`;
  const allowedTech = new Set(extractTech(allowedSrc));
  // Numbers must come from the bullet itself or the user's metric — not from elsewhere in the CV.
  const allowedNums = new Set(
    (`${i.text} ${i.metric ?? ""}`.match(NUM_RE) ?? []).map((n) => n.replace(",", ".")),
  );
  if (introducesFacts(r, allowedTech, allowedNums)) return null;
  if (hasFirstPersonPronoun(r) && !hasFirstPersonPronoun(i.text)) return null;
  const ratio = r.length / Math.max(1, i.text.length + (i.metric?.length ?? 0));
  if (ratio > 3 || ratio < 0.3) return null;
  return r;
}

export async function improveBullet(i: ImproveInput, userId: string): Promise<ImproveResult> {
  const ask = missingParts(i.text, i.metric);
  const llm = await guardedLLM("cv_improve", userId);
  if (llm.name === "mock") return { status: "off", rewrite: null, ask, question: null };
  try {
    const raw = await llm.complete(improvePrompt(i), { schema: improveSchema, maxTokens: 600 });
    const parsed = improveSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { status: "error", rewrite: null, ask, question: null };
    const rewrite = acceptRewrite(i, parsed.data.rewrite);
    const q = parsed.data.missingMetricQuestion?.trim() || null;
    // The model's question must not smuggle in invented numbers either.
    const question = q && !/\d/.test(q) ? q : null;
    if (!rewrite) return { status: "rejected", rewrite: null, ask, question };
    if (rewrite === i.text.trim()) return { status: "same", rewrite: null, ask, question };
    return { status: "ok", rewrite, ask: missingParts(rewrite, i.metric), question };
  } catch (e) {
    if (e instanceof AiLimitError) return { status: "limited", rewrite: null, ask, question: null };
    return { status: "error", rewrite: null, ask, question: null };
  }
}
