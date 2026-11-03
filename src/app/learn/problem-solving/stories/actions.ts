"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { guardedLLM } from "@/lib/ai";
import { getLocale } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { DS_BY_ID } from "@/lib/algo/data-structures";
import { PATTERN_BY_ID } from "@/lib/algo/patterns";
import type { PatternId } from "@/lib/algo/types";
import { industryFor } from "@/lib/algo/industry";
import {
  isEmptyStory,
  normalizeFields,
  polishPrompt,
  storyInputSchema,
  templateAnswer,
  validatePolish,
  type StoryInput,
  type StoryLang,
  type StoryView,
} from "@/lib/stories/story";
import { toView } from "@/lib/stories/server";

const BASE = "/learn/problem-solving";

function itemName(kind: "ds" | "pattern", id: string): string | null {
  if (!industryFor(kind, id)) return null;
  return kind === "ds" ? (DS_BY_ID.get(id)?.name ?? null) : (PATTERN_BY_ID.get(id as PatternId)?.name ?? null);
}

function revalidate(kind: "ds" | "pattern", id: string) {
  revalidatePath(`${BASE}/stories`);
  revalidatePath(kind === "ds" ? `${BASE}/data-structures` : `${BASE}/patterns/${id}`);
}

export type SaveResult = { ok: true; story: StoryView } | { ok: false; error: "invalid" | "empty" };

export async function saveWorkStory(input: StoryInput): Promise<SaveResult> {
  const user = await requireUser(BASE);
  const parsed = storyInputSchema.safeParse(input);
  if (!parsed.success || !itemName(parsed.data.kind, parsed.data.itemId)) return { ok: false, error: "invalid" };
  const { kind, itemId } = parsed.data;
  const fields = normalizeFields(parsed.data);
  if (isEmptyStory(fields)) return { ok: false, error: "empty" };
  const existing = await db.workStory.findUnique({ where: { userId_kind_itemId: { userId: user.id, kind, itemId } } });
  const changed =
    !existing ||
    existing.situation !== fields.situation ||
    existing.built !== fields.built ||
    existing.why !== fields.why ||
    existing.result !== fields.result;
  const row = await db.workStory.upsert({
    where: { userId_kind_itemId: { userId: user.id, kind, itemId } },
    create: { userId: user.id, kind, itemId, ...fields },
    // Editing the notes invalidates the old polished answer (it may no longer match the facts).
    update: {
      ...fields,
      ...(changed ? { polished: null, polishedLang: null, polishedSource: null, polishedAt: null } : {}),
    },
  });
  revalidate(kind, itemId);
  return { ok: true, story: toView(row) };
}

export type PolishResult =
  | { ok: true; story: StoryView; rejected: boolean; limited: string | null }
  | { ok: false; error: "invalid" | "empty" | "not_found" };

export async function polishWorkStory(kind: "ds" | "pattern", itemId: string, lang: StoryLang): Promise<PolishResult> {
  const user = await requireUser(BASE);
  const args = z
    .object({ kind: z.enum(["ds", "pattern"]), itemId: z.string().min(1).max(60), lang: z.enum(["he", "en"]) })
    .safeParse({ kind, itemId, lang });
  const name = args.success ? itemName(kind, itemId) : null;
  if (!args.success || !name) return { ok: false, error: "invalid" };
  const row = await db.workStory.findUnique({ where: { userId_kind_itemId: { userId: user.id, kind, itemId } } });
  if (!row) return { ok: false, error: "not_found" };
  const fields = normalizeFields(row);
  if (isEmptyStory(fields)) return { ok: false, error: "empty" };

  let text = templateAnswer(fields, name, lang);
  let source: "ai" | "template" = "template";
  let rejected = false;
  const llm = await guardedLLM("work_story", user.id);
  if (llm.name !== "mock") {
    try {
      const raw = await llm.complete(polishPrompt(fields, name, kind, lang), { maxTokens: 500 });
      const ok = validatePolish(raw, fields, name);
      if (ok) {
        text = ok;
        source = "ai";
      } else rejected = true;
    } catch {
      // Fall through to the template answer.
    }
  }
  const limited = llm.limited ? aiLimitMessage(llm.limited, await getLocale()) : null;
  const saved = await db.workStory.update({
    where: { id: row.id },
    data: { polished: text, polishedLang: lang, polishedSource: source, polishedAt: new Date() },
  });
  revalidate(kind, itemId);
  return { ok: true, story: toView(saved), rejected, limited };
}

export async function deleteWorkStory(kind: "ds" | "pattern", itemId: string): Promise<{ ok: boolean }> {
  const user = await requireUser(BASE);
  if (!itemName(kind, itemId)) return { ok: false };
  await db.workStory.deleteMany({ where: { userId: user.id, kind, itemId } });
  revalidate(kind, itemId);
  return { ok: true };
}
