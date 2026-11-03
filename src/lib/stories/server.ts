import "server-only";
import { db } from "@/lib/db";
import type { StoryItemKind } from "@/lib/algo/industry";
import type { StoryLang, StoryView } from "./story";

type Row = {
  kind: string;
  itemId: string;
  situation: string;
  built: string;
  why: string;
  result: string;
  polished: string | null;
  polishedLang: string | null;
  polishedSource: string | null;
  updatedAt: Date;
};

export function toView(r: Row): StoryView {
  return {
    kind: r.kind === "pattern" ? "pattern" : "ds",
    itemId: r.itemId,
    fields: { situation: r.situation, built: r.built, why: r.why, result: r.result },
    polished: r.polished,
    polishedLang: r.polishedLang === "en" ? "en" : r.polishedLang === "he" ? "he" : null,
    polishedSource: r.polishedSource === "ai" ? "ai" : r.polishedSource === "template" ? "template" : null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** The user's stories keyed by `${kind}:${itemId}`; empty map when signed out. */
export async function storiesFor(userId: string | null | undefined, kind?: StoryItemKind) {
  if (!userId) return new Map<string, StoryView>();
  const rows = await db.workStory.findMany({ where: { userId, ...(kind ? { kind } : {}) }, take: 200 });
  return new Map(rows.map((r) => [`${r.kind}:${r.itemId}`, toView(r)]));
}

export async function listStories(userId: string): Promise<StoryView[]> {
  const rows = await db.workStory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 200 });
  return rows.map(toView);
}

export type { StoryLang };
