import { guardedLLM } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { normalizeStageContent } from "./content";
import {
  answerFeedbackSchema,
  exerciseItem,
  feedbackPrompt,
  heuristicFeedback,
  normalizeFeedback,
  questionItem,
  verdictFor,
  type AnswerFeedback,
  type FeedbackItem,
  type FeedbackKind,
  type FeedbackSource,
  type StoredFeedback,
} from "./feedback";
import { fallbackContent } from "./hub";
import type { SkillNode, Stage } from "./types";

const FEEDBACK_MAX_TOKENS = 900;

/** The exercise / question the user answered, from the same content the stage page shows. */
export async function findFeedbackItem(
  node: SkillNode,
  stage: Stage,
  locale: Locale,
  kind: FeedbackKind,
  itemId: string,
): Promise<FeedbackItem | null> {
  const row = await db.stageContent.findUnique({
    where: { skill_stage_locale: { skill: node.id, stage, locale } },
  });
  const content = (row && normalizeStageContent(row.content)) || fallbackContent(node, stage, locale).content;
  if (kind === "exercise") {
    const ex = content.exercises.find((e) => e.id === itemId);
    return ex ? exerciseItem(ex) : null;
  }
  const q = content.questions.find((x) => x.id === itemId);
  return q ? questionItem(q) : null;
}

export interface Graded {
  feedback: AnswerFeedback;
  source: FeedbackSource;
  model: string | null;
  reason?: AiLimitReason;
}

/** Gemini (guarded: cache + free-tier limits) → offline key-term check on mock, limits or invalid output. */
export async function gradeAnswer(
  userId: string,
  node: SkillNode,
  stage: Stage,
  item: FeedbackItem,
  answer: string,
  locale: Locale,
): Promise<Graded> {
  const llm = await guardedLLM("learn_feedback", userId);
  if (llm.name === "mock") return { feedback: heuristicFeedback(item, answer, locale), source: "offline", model: null };
  try {
    const raw = await llm.complete(feedbackPrompt(node, stage, item, answer, locale), {
      schema: answerFeedbackSchema,
      maxTokens: FEEDBACK_MAX_TOKENS,
    });
    const fb = normalizeFeedback(JSON.parse(raw));
    if (fb) return { feedback: { ...fb, verdict: verdictFor(fb.score) }, source: "ai", model: llm.name };
  } catch (e) {
    if (e instanceof AiLimitError)
      return { feedback: heuristicFeedback(item, answer, locale), source: "limited", model: null, reason: e.reason };
  }
  return { feedback: heuristicFeedback(item, answer, locale), source: "offline", model: null };
}

/** Stored feedback for one stage, keyed by item id (invalid rows are skipped). */
export async function stageFeedback(userId: string, skill: string, stage: Stage) {
  const rows = await db.answerFeedback.findMany({ where: { userId, skill, stage } });
  const out: Record<string, StoredFeedback> = {};
  for (const r of rows) {
    const fb = normalizeFeedback(r.result);
    if (fb) out[r.itemId] = { answer: r.answer, feedback: fb, source: r.source as FeedbackSource };
  }
  return out;
}
