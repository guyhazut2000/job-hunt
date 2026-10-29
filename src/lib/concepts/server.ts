/** Server-side concept logic: overview cache/generation and drill-down chat (docs/concepts.md). */
import { guardedLLM } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { GRAPH } from "@/lib/learning/graph";
import {
  conceptOverviewSchema,
  normalizeOverview,
  type ConceptAction,
  type ConceptKind,
  type ConceptOverview,
  type OverviewSource,
} from "./core";
import { offlineOverview } from "./fallback";
import {
  CHAT_HISTORY_TURNS,
  CHAT_MAX_TOKENS,
  chatPrompt,
  offlineReply,
  overviewPrompt,
  type ChatTurn,
  type PromptConcept,
} from "./prompts";

const OVERVIEW_MAX_TOKENS = 1100;

export interface ConceptRef {
  slug: string;
  name: string;
  kind: ConceptKind;
  skill: string | null;
  company: { name: string } | null;
}

export interface LoadedOverview {
  overview: ConceptOverview;
  source: OverviewSource;
  /** True when no stored/curated overview exists yet and the client should ask for one. */
  pending: boolean;
}

function promptConcept(c: ConceptRef): PromptConcept {
  return {
    name: c.name,
    kind: c.kind,
    companyName: c.company?.name ?? null,
    skillLabel: c.skill ? (GRAPH.byId.get(c.skill)?.label ?? null) : null,
  };
}

/** Stored (shared) → curated → offline fallback (pending: AI can still improve it). No AI call here. */
export async function loadOverview(c: ConceptRef, locale: Locale): Promise<LoadedOverview> {
  const row = await db.conceptOverview.findUnique({ where: { key_locale: { key: c.slug, locale } } });
  const stored = row && normalizeOverview(row.content);
  if (stored) return { overview: stored, source: row.source === "curated" ? "curated" : "ai", pending: false };
  const off = offlineOverview(c.slug, c.name, c.kind, locale, c.company?.name);
  return { ...off, pending: off.source === "fallback" };
}

export type GenerateResult =
  | { ok: true; overview: ConceptOverview; source: OverviewSource }
  | { ok: false; reason: AiLimitReason | "offline" | "invalid"; overview: ConceptOverview; source: OverviewSource };

/** Generate (Gemini via guardedLLM) and store the shared overview for slug × locale. */
export async function generateOverview(userId: string, c: ConceptRef, locale: Locale): Promise<GenerateResult> {
  const existing = await loadOverview(c, locale);
  if (!existing.pending) return { ok: true, overview: existing.overview, source: existing.source };
  const llm = await guardedLLM("concept_overview", userId);
  if (llm.name === "mock")
    return { ok: false, reason: "offline", overview: existing.overview, source: existing.source };
  try {
    const raw = await llm.complete(overviewPrompt(promptConcept(c), locale), {
      schema: conceptOverviewSchema,
      maxTokens: OVERVIEW_MAX_TOKENS,
    });
    const ov = normalizeOverview(JSON.parse(raw));
    if (!ov) return { ok: false, reason: "invalid", overview: existing.overview, source: existing.source };
    if (c.kind === "COMPANY") ov.category = "company";
    await db.conceptOverview.upsert({
      where: { key_locale: { key: c.slug, locale } },
      create: { key: c.slug, locale, kind: c.kind, source: "ai", model: llm.name, content: ov },
      update: { source: "ai", model: llm.name, content: ov },
    });
    return { ok: true, overview: ov, source: "ai" };
  } catch (e) {
    if (e instanceof AiLimitError)
      return { ok: false, reason: e.reason, overview: existing.overview, source: existing.source };
    return { ok: false, reason: "invalid", overview: existing.overview, source: existing.source };
  }
}

export interface ChatAnswer {
  content: string;
  source: "ai" | "offline" | "limited";
  reason?: AiLimitReason;
}

/** One drill-down / chat answer. History is the concept's saved messages (oldest first). */
export async function answerConcept(
  userId: string,
  c: ConceptRef,
  overview: ConceptOverview | null,
  history: ChatTurn[],
  question: string,
  action: ConceptAction,
  locale: Locale,
): Promise<ChatAnswer> {
  const pc = promptConcept(c);
  const llm = await guardedLLM("concept_chat", userId);
  if (llm.name === "mock") return { content: offlineReply(pc, action, locale, overview), source: "offline" };
  try {
    // First-turn drill-downs carry no personal history, so the guard's prompt cache serves them across users.
    const hist = action !== "chat" && history.length === 0 ? [] : history.slice(-CHAT_HISTORY_TURNS);
    const out = await llm.complete(chatPrompt(pc, overview, hist, question, locale), { maxTokens: CHAT_MAX_TOKENS });
    const text = out.trim().slice(0, 6000);
    if (text) return { content: text, source: "ai" };
  } catch (e) {
    if (e instanceof AiLimitError)
      return { content: offlineReply(pc, action, locale, overview), source: "limited", reason: e.reason };
  }
  return { content: offlineReply(pc, action, locale, overview), source: "offline" };
}
