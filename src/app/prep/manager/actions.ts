"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { guardedLLM } from "@/lib/ai";
import { getLocale } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { requireUser } from "@/lib/session";
import { validatePolish } from "@/lib/stories/story";
import {
  QUESTION_BY_ID,
  STAR_MAX,
  isEmptyStar,
  managerPolishPrompt,
  normalizeStar,
  starAsStory,
  starTemplate,
} from "@/lib/manager/bank";

const PATH = "/prep/manager";
const field = z.string().max(STAR_MAX).default("");
const inputSchema = z.object({
  questionId: z.string().min(1).max(60),
  situation: field,
  task: field,
  action: field,
  result: field,
});

export type ManagerView = {
  questionId: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  polished: string | null;
  polishedSource: string | null;
};

export async function saveManagerAnswer(
  input: z.input<typeof inputSchema>,
): Promise<{ ok: true; view: ManagerView } | { ok: false; error: "invalid" | "empty" }> {
  const user = await requireUser(PATH);
  const p = inputSchema.safeParse(input);
  if (!p.success || !QUESTION_BY_ID.has(p.data.questionId)) return { ok: false, error: "invalid" };
  const f = normalizeStar(p.data);
  if (isEmptyStar(f)) return { ok: false, error: "empty" };
  const key = { userId_questionId: { userId: user.id, questionId: p.data.questionId } };
  const prev = await db.managerAnswer.findUnique({ where: key });
  const changed = !prev || (["situation", "task", "action", "result"] as const).some((k) => prev[k] !== f[k]);
  const row = await db.managerAnswer.upsert({
    where: key,
    create: { userId: user.id, questionId: p.data.questionId, ...f },
    // New notes invalidate an old polished answer (it may no longer match the facts).
    update: { ...f, ...(changed ? { polished: null, polishedLang: null, polishedSource: null } : {}) },
  });
  revalidatePath(PATH);
  return { ok: true, view: toView(row) };
}

export async function polishManagerAnswer(
  questionId: string,
  lang: "he" | "en",
): Promise<
  | { ok: true; view: ManagerView; rejected: boolean; limited: string | null }
  | { ok: false; error: "invalid" | "not_found" }
> {
  const user = await requireUser(PATH);
  const q = QUESTION_BY_ID.get(questionId);
  const l = lang === "en" ? "en" : "he";
  if (!q) return { ok: false, error: "invalid" };
  const key = { userId_questionId: { userId: user.id, questionId } };
  const row = await db.managerAnswer.findUnique({ where: key });
  if (!row || isEmptyStar(row)) return { ok: false, error: "not_found" };
  const f = normalizeStar(row);
  let text = starTemplate(f, l);
  let source = "template";
  let rejected = false;
  const llm = await guardedLLM("manager_answer", user.id);
  if (llm.name !== "mock") {
    try {
      const raw = await llm.complete(managerPolishPrompt(q, f, l), { maxTokens: 700 });
      const ok = validatePolish(raw, starAsStory(f), "");
      if (ok) {
        text = ok;
        source = "ai";
      } else rejected = true;
    } catch {
      // Keep the template answer.
    }
  }
  const limited = llm.limited ? aiLimitMessage(llm.limited, await getLocale()) : null;
  const saved = await db.managerAnswer.update({
    where: key,
    data: { polished: text, polishedLang: l, polishedSource: source },
  });
  revalidatePath(PATH);
  return { ok: true, view: toView(saved), rejected, limited };
}

function toView(r: {
  questionId: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  polished: string | null;
  polishedSource: string | null;
}): ManagerView {
  return {
    questionId: r.questionId,
    situation: r.situation,
    task: r.task,
    action: r.action,
    result: r.result,
    polished: r.polished,
    polishedSource: r.polishedSource,
  };
}
