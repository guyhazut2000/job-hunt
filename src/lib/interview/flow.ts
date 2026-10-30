/** Conversation flow: one question at a time, planned follow-ups, no AI call per answer. */
import { SHORT_FOLLOWUP, STAR_FOLLOWUPS, t } from "./bank";
import { mentionsComplexity, mentionsEdges, starParts, words } from "./analyze";
import type { InterviewMode, Lang, PlannedQuestion } from "./types";

export const MAX_FOLLOWUPS: Record<InterviewMode, number> = { HR: 2, TECH: 1, PROBLEM: 2 };
export const SHORT_ANSWER_WORDS = 12;
export const MAX_ANSWER_CHARS = 4000;

export type Step = { kind: "followup"; text: string } | { kind: "next"; index: number } | { kind: "done" };

/** Decide what the interviewer says after `answer` to question `index`; `asked` = follow-ups already asked for it. */
export function nextStep(
  plan: PlannedQuestion[],
  mode: InterviewMode,
  lang: Lang,
  index: number,
  asked: string[],
  answer: string,
  answersSoFar = "",
): Step {
  const q = plan[index];
  const advance = (): Step => (index + 1 < plan.length ? { kind: "next", index: index + 1 } : { kind: "done" });
  if (!q || asked.length >= MAX_FOLLOWUPS[mode]) return advance();
  const all = `${answersSoFar}\n${answer}`;
  const ask = (text: string | undefined): Step =>
    text && !asked.includes(text) ? { kind: "followup", text } : advance();
  if (words(answer) < SHORT_ANSWER_WORDS && asked.length === 0) return ask(t(SHORT_FOLLOWUP, lang));
  if (mode === "HR") {
    const parts = starParts(all);
    const missing = (["r", "a", "s", "t"] as const).find(
      (k) => !parts[k] && !asked.includes(t(STAR_FOLLOWUPS[k], lang)),
    );
    if (missing) return ask(t(STAR_FOLLOWUPS[missing], lang));
    return ask(q.followUps.find((f) => !asked.includes(f)));
  }
  if (mode === "PROBLEM") {
    // followUps: [complexity, edges]; skip the ones the answers already cover.
    const covered = [mentionsComplexity(all), mentionsEdges(all)];
    return ask(q.followUps.find((f, i) => !covered[i] && !asked.includes(f)));
  }
  return ask(q.followUps.find((f) => !asked.includes(f)));
}
