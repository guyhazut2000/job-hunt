import { z } from "zod";

/**
 * "Accept the offer" bulk step: which applications to archive, and the undo record stored in
 * OfferClosing.acceptance. Archiving sets Application.archivedAt + archiveBatch and never changes the status, so
 * undo only clears those two fields for the batch. Pure helpers — the DB writes live in src/app/closing/actions.ts.
 */

export const OPEN_STATUSES = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER"] as const;

export interface ArchivableApp {
  id: string;
  status: string;
  archivedAt: Date | null;
}

/** Open (not rejected, not already archived) applications other than the accepted one. */
export function pickArchivable<T extends ArchivableApp>(apps: T[], acceptedApplicationId: string | null): T[] {
  return apps.filter(
    (a) =>
      a.id !== acceptedApplicationId &&
      a.archivedAt === null &&
      (OPEN_STATUSES as readonly string[]).includes(a.status),
  );
}

export const acceptanceSchema = z.object({
  acceptedAt: z.string(),
  /** Batch id written to Application.archiveBatch (null when nothing was archived). */
  batch: z.string().nullable(),
  archivedIds: z.array(z.string()).default([]),
  /** Job alerts paused by this step, restored on undo. */
  paused: z
    .object({
      /** Previous highMatchEnabled value (null = we did not touch it). */
      highMatchWas: z.boolean().nullable(),
      savedSearchIds: z.array(z.string()).default([]),
    })
    .default({ highMatchWas: null, savedSearchIds: [] }),
  /** Set when undone (kept for history). */
  undoneAt: z.string().nullable().default(null),
});
export type Acceptance = z.infer<typeof acceptanceSchema>;

export function parseAcceptance(raw: unknown): Acceptance | null {
  const r = acceptanceSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Undo is offered while the acceptance exists, was not undone yet, and is at most `days` old. */
export function canUndo(a: Acceptance | null, now: Date, days = 30): boolean {
  if (!a || a.undoneAt) return false;
  const at = Date.parse(a.acceptedAt);
  return Number.isFinite(at) && now.getTime() - at <= days * 86_400_000;
}

export function newBatchId(now: Date, rand = Math.random): string {
  return `acc_${now.getTime().toString(36)}_${Math.floor(rand() * 1e9).toString(36)}`;
}
