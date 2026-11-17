import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { contextFromHeaders, isBot, type ActivityContext } from "./context";
import type { ActivityType } from "./types";

export interface ActivityInput {
  type: ActivityType;
  userId?: string | null;
  email?: string | null;
  path?: string | null;
  meta?: Record<string, string | number | boolean | null>;
}

type HeaderBag = Pick<Headers, "get">;

async function requestHeaders(): Promise<HeaderBag | null> {
  try {
    const { headers } = await import("next/headers");
    return await headers();
  } catch {
    return null; // outside a request (cron, scripts, tests)
  }
}

/**
 * Builds the row to store. Returns null for bots (when a user-agent is known to be one).
 * Exported for tests; `recordActivity` is the entry point.
 */
export function buildActivityRow(
  input: ActivityInput,
  h: HeaderBag | null,
): Prisma.ActivityEventUncheckedCreateInput | null {
  if (h && isBot(h.get("user-agent")) && input.type === "page_view") return null;
  const ctx: ActivityContext = h ? contextFromHeaders(h) : {};
  return {
    type: input.type,
    userId: input.userId ?? null,
    email: input.email ? input.email.trim().toLowerCase().slice(0, 160) : null,
    path: input.path ? input.path.slice(0, 200) : null,
    ...ctx,
    ...(input.meta && { meta: input.meta as Prisma.InputJsonValue }),
  };
}

/**
 * Stores one activity event. Never throws and never blocks the product on failure
 * (e.g. a preview deployment whose code is ahead of the production schema).
 */
export async function recordActivity(input: ActivityInput, headersOverride?: HeaderBag | null): Promise<void> {
  try {
    const h = headersOverride === undefined ? await requestHeaders() : headersOverride;
    const row = buildActivityRow(input, h);
    if (!row) return;
    await db.activityEvent.create({ data: row });
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[activity] not recorded:", e instanceof Error ? e.message : e);
  }
}

/** Deletes events older than the retention window. */
export async function purgeOldActivity(now = new Date(), days = 90): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const { count } = await db.activityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: count };
}
