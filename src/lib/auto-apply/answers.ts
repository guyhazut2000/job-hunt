/**
 * Screening answers via guardedLLM (`apply_answers`). Low confidence stays flagged.
 * Any failure, the mock provider, or a prompt that looks like a secret leaves those
 * questions blank and flagged — the same non-AI fallback.
 */
import { z } from "zod";
import type { LLMMessage } from "@/lib/ai";
import { looksLikeSecret } from "@/lib/learning/tutor";
import { hasValue, type ApplyField, type ApplyProfile } from "./types";

export const answerSchema = z.object({
  answers: z
    .array(
      z.object({
        id: z.string().max(120),
        value: z.string().max(2000),
        confidence: z.enum(["high", "low"]),
      }),
    )
    .max(30),
});

export type AnswerSource = "profile" | "ai" | "fallback" | "limited" | "secret";

/** Questions the model may see: still empty, safe to transmit, not a file or a yes/no we refuse to guess. */
export function questionsForAi(fields: readonly ApplyField[]): ApplyField[] {
  return fields.filter((f) => f.transmit && !f.sensitive && !hasValue(f) && f.kind !== "file" && f.kind !== "boolean");
}

export function answerPrompt(input: {
  company: string;
  title: string;
  profile: ApplyProfile;
  questions: ApplyField[];
}): LLMMessage[] {
  const profile = {
    name: input.profile.name,
    headline: input.profile.headline,
    summary: input.profile.summary.slice(0, 500),
    skills: input.profile.skills.slice(0, 40),
    salaryMin: input.profile.salaryMin,
    salaryMax: input.profile.salaryMax,
    availability: input.profile.availability,
    location: input.profile.location,
    currentTitle: input.profile.currentTitle,
    currentCompany: input.profile.currentCompany,
    yearsExperience: input.profile.yearsExperience,
  };
  const questions = input.questions.map((q) => ({
    id: q.id,
    label: q.label,
    kind: q.kind,
    options: q.options.slice(0, 20),
  }));
  return [
    {
      role: "system",
      content:
        "You fill job-application screening answers using only the candidate profile JSON. " +
        "Answer in the language of each question. Never invent employers, degrees, visas, citizenship, " +
        "or numbers that are not in the profile. If you are not sure, set confidence to low and value to an empty string. " +
        "For select questions the value must be one of the option values. Return JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        company: input.company,
        title: input.title,
        profile,
        questions,
      }),
    },
  ];
}

export function promptHasSecret(messages: readonly LLMMessage[]): boolean {
  return looksLikeSecret(messages.map((m) => m.content).join("\n"));
}

function matchOption(field: ApplyField, value: string): string | null {
  const hit =
    field.options.find((o) => o.value === value) ??
    field.options.find((o) => o.label.toLowerCase() === value.toLowerCase());
  return hit?.value ?? null;
}

/**
 * Merge a model payload into the fields. Unknown ids, sensitive fields, and option values
 * that are not on the question are ignored. `candidateIds` are the questions we hoped to fill;
 * anything in that set still empty is flagged.
 */
export function mergeAnswers(
  fields: readonly ApplyField[],
  raw: unknown,
  candidateIds: ReadonlySet<string>,
): { fields: ApplyField[]; usedAi: boolean } {
  const parsed = answerSchema.safeParse(raw);
  const byId = new Map(parsed.success ? parsed.data.answers.map((a) => [a.id, a]) : []);
  let usedAi = false;
  const next = fields.map((field) => {
    if (!candidateIds.has(field.id) || field.sensitive || !field.transmit) return field;
    const answer = byId.get(field.id);
    if (!answer || answer.confidence !== "high" || !answer.value.trim()) {
      if (answer?.confidence === "low" && answer.value.trim()) {
        const value = field.kind === "select" ? matchOption(field, answer.value) : answer.value.slice(0, 2000);
        if (!value) return { ...field, flagged: true, flagReason: "manual" as const, confidence: "low" as const };
        usedAi = true;
        return {
          ...field,
          value,
          source: "ai" as const,
          confidence: "low" as const,
          flagged: true,
          flagReason: "low_confidence" as const,
        };
      }
      return { ...field, flagged: true, flagReason: "manual" as const, confidence: "low" as const };
    }
    if (field.kind === "select") {
      const value = matchOption(field, answer.value);
      if (!value)
        return { ...field, flagged: true, flagReason: "unmatched_option" as const, confidence: "low" as const };
      usedAi = true;
      return {
        ...field,
        value,
        source: "ai" as const,
        confidence: "high" as const,
        flagged: false,
        flagReason: undefined,
      };
    }
    if (field.kind === "multi") return field;
    usedAi = true;
    return {
      ...field,
      value: answer.value.slice(0, 2000),
      source: "ai" as const,
      confidence: "high" as const,
      flagged: false,
      flagReason: undefined,
    };
  });
  return { fields: next, usedAi: parsed.success && usedAi };
}

/** Non-AI fallback: every still-open candidate question is blank and flagged. */
export function flagUnanswered(fields: readonly ApplyField[], candidateIds: ReadonlySet<string>): ApplyField[] {
  return fields.map((field) =>
    candidateIds.has(field.id) && !hasValue(field)
      ? { ...field, flagged: true, flagReason: "manual", confidence: "low", source: "blank" }
      : field,
  );
}
