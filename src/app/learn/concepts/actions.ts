"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import {
  CHAT_MAX,
  clampConfidence,
  cleanTags,
  CONCEPT_CATEGORIES,
  CONCEPT_STATUSES,
  DRILL_ACTIONS,
  NOTES_MAX,
  type ConceptAction,
  type ConceptKind,
  type ConceptOverview,
  type OverviewSource,
} from "@/lib/concepts/core";
import { actionQuestion } from "@/lib/concepts/prompts";
import { answerConcept, generateOverview, loadOverview } from "@/lib/concepts/server";
import { ensureConcept } from "@/lib/concepts/store";
import { looksLikeSecret } from "@/lib/learning/tutor";
import { requireUser } from "@/lib/session";

const addInput = z.object({
  name: z.string().max(200),
  kind: z.enum(["TECH", "COMPANY"]).default("TECH"),
  companyId: z.string().max(40).nullish(),
  parentId: z.string().max(40).nullish(),
  skill: z.string().max(60).nullish(),
  source: z.string().max(40).nullish(),
  category: z.string().max(30).nullish(),
});

export type AddConceptResult = { ok: true; id: string } | { ok: false; error: "name" | "company" | "invalid" };

export async function addConcept(raw: z.input<typeof addInput>): Promise<AddConceptResult> {
  const user = await requireUser();
  const p = addInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const r = await ensureConcept(user.id, p.data);
  if (!r.ok) return r;
  if (r.created) revalidatePath("/learn/concepts");
  return { ok: true, id: r.id };
}

const updateInput = z.object({
  id: z.string().max(40),
  status: z.enum(CONCEPT_STATUSES).optional(),
  confidence: z.number().optional(),
  notes: z
    .string()
    .max(NOTES_MAX * 2)
    .optional(),
  tags: z.array(z.string().max(100)).max(40).optional(),
  category: z.enum(CONCEPT_CATEGORIES).nullable().optional(),
});

export async function updateConcept(raw: z.input<typeof updateInput>): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const p = updateInput.safeParse(raw);
  if (!p.success) return { ok: false };
  const { id, status, confidence, notes, tags, category } = p.data;
  const res = await db.concept.updateMany({
    where: { id, userId: user.id },
    data: {
      ...(status ? { status } : {}),
      ...(confidence !== undefined ? { confidence: clampConfidence(confidence) } : {}),
      ...(notes !== undefined ? { notes: notes.slice(0, NOTES_MAX) || null } : {}),
      ...(tags ? { tags: cleanTags(tags) } : {}),
      ...(category !== undefined ? { category } : {}),
    },
  });
  revalidatePath("/learn/concepts");
  return { ok: res.count > 0 };
}

export async function deleteConcept(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const res = await db.concept.deleteMany({ where: { id: String(id).slice(0, 40), userId: user.id } });
  revalidatePath("/learn/concepts");
  return { ok: res.count > 0 };
}

async function ownConcept(userId: string, id: string) {
  return db.concept.findFirst({
    where: { id: String(id).slice(0, 40), userId },
    select: { id: true, slug: true, name: true, kind: true, skill: true, company: { select: { name: true } } },
  });
}

export type OverviewResult = {
  overview: ConceptOverview;
  source: OverviewSource;
  /** Set when AI could not produce one (limit message, or offline). */
  notice?: string;
  offline?: boolean;
} | null;

/** Called by the concept page when no stored overview exists yet (client shows a skeleton meanwhile). */
export async function requestOverview(id: string): Promise<OverviewResult> {
  const user = await requireUser();
  const c = await ownConcept(user.id, id);
  if (!c) return null;
  const locale = await getLocale();
  const r = await generateOverview(user.id, { ...c, kind: c.kind as ConceptKind }, locale);
  if (r.ok) return { overview: r.overview, source: r.source };
  const limited = r.reason !== "offline" && r.reason !== "invalid";
  return {
    overview: r.overview,
    source: r.source,
    notice: limited ? aiLimitMessage(r.reason as Parameters<typeof aiLimitMessage>[0], locale) : undefined,
    offline: !limited,
  };
}

export interface ConceptMessageDTO {
  id: string;
  role: "user" | "assistant";
  action: ConceptAction;
  content: string;
  source: string | null;
  createdAt: string;
}

export type AskResult =
  | { ok: true; messages: ConceptMessageDTO[]; notice?: string }
  | { ok: false; error: "invalid" | "secret" | "notfound" };

const askInput = z.object({
  id: z.string().max(40),
  action: z.enum([...DRILL_ACTIONS, "chat"]),
  text: z
    .string()
    .max(CHAT_MAX * 2)
    .default(""),
});

const toDTO = (m: {
  id: string;
  role: string;
  action: string;
  content: string;
  source: string | null;
  createdAt: Date;
}): ConceptMessageDTO => ({
  id: m.id,
  role: m.role === "user" ? "user" : "assistant",
  action: m.action as ConceptAction,
  content: m.content,
  source: m.source,
  createdAt: m.createdAt.toISOString(),
});

/** Drill-down button or free chat: saves the question + answer to the concept's history. */
export async function askConcept(raw: z.input<typeof askInput>): Promise<AskResult> {
  const user = await requireUser();
  const p = askInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const { id, action } = p.data;
  const text = p.data.text.trim().slice(0, CHAT_MAX);
  if (action === "chat" && !text) return { ok: false, error: "invalid" };
  if (text && looksLikeSecret(text)) return { ok: false, error: "secret" };
  const c = await ownConcept(user.id, id);
  if (!c) return { ok: false, error: "notfound" };
  const locale = await getLocale();
  const ref = { ...c, kind: c.kind as ConceptKind };
  const question = action === "chat" ? text : actionQuestion(action, text);
  // What the user sees in their history: their own words for chat, the button label (+ compare target) otherwise.
  const shown = action === "chat" ? text : action === "compare" && text ? text : "";
  const [history, ov] = await Promise.all([
    db.conceptMessage.findMany({
      where: { conceptId: c.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { role: true, action: true, content: true },
    }),
    loadOverview(ref, locale),
  ]);
  const turns = history.reverse().map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content:
      m.role === "user" && m.action !== "chat"
        ? actionQuestion(m.action as Exclude<ConceptAction, "chat">, m.content)
        : m.content,
  }));
  const ans = await answerConcept(user.id, ref, ov.overview, turns, question, action, locale);
  const now = Date.now();
  const [q, a] = await db.$transaction([
    db.conceptMessage.create({
      data: { conceptId: c.id, role: "user", action, content: shown, createdAt: new Date(now) },
    }),
    db.conceptMessage.create({
      data: {
        conceptId: c.id,
        role: "assistant",
        action,
        content: ans.content,
        source: ans.source,
        createdAt: new Date(now + 1),
      },
    }),
    db.concept.update({
      where: { id: c.id },
      data: { lastOpenedAt: new Date(now), status: undefined },
      select: { id: true },
    }),
  ]);
  // First drill-down moves a NEW concept to LEARNING.
  await db.concept.updateMany({ where: { id: c.id, status: "NEW" }, data: { status: "LEARNING" } });
  return {
    ok: true,
    messages: [toDTO(q), toDTO(a)],
    notice: ans.reason ? aiLimitMessage(ans.reason, locale) : undefined,
  };
}
