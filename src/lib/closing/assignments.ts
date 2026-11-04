import { z } from "zod";
import { israelLocalToUtc, toIsraelLocalInput } from "@/lib/notifications/israel-time";

/** Home assignments (מטלות בית) per application: statuses, validation and due-date state. Pure. */

export const ASSIGNMENT_STATUSES = ["TODO", "IN_PROGRESS", "SUBMITTED", "FEEDBACK"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

const HOUR = 3_600_000;

const optUrl = z
  .string()
  .trim()
  .max(500)
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || /^https?:\/\/\S+$/i.test(s), "url")
  .nullable()
  .optional();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();
/** "YYYY-MM-DDTHH:mm" (datetime-local, Israel time) or "YYYY-MM-DD"; "" → null. */
const optWhen = z
  .string()
  .trim()
  .max(20)
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s), "date")
  .nullable()
  .optional();

export const assignmentInputSchema = z.object({
  applicationId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  description: optText(4000),
  link: optUrl,
  receivedAt: optWhen,
  dueAt: optWhen,
  estimatedHours: z.coerce.number().int().min(0).max(200).nullable().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).default("TODO"),
  submittedLink: optUrl,
  notes: optText(4000),
});
export type AssignmentInput = z.infer<typeof assignmentInputSchema>;

/** Israel wall-clock "YYYY-MM-DD[THH:mm]" → instant. A date without a time means 23:59 that day. */
export function israelLocalToDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return israelLocalToUtc(/T/.test(s) ? s : `${s}T23:59`);
}

/** Instant → Israel "YYYY-MM-DDTHH:mm" for a datetime-local input. */
export function dateToIsraelLocal(d: Date | null | undefined): string {
  return d ? toIsraelLocalInput(d) : "";
}

export type DueState = "done" | "overdue" | "today" | "soon" | "later" | "none";

/** today = within 24h, soon = within 72h. Submitted / feedback assignments are "done". */
export function dueState(a: { dueAt: Date | null; status: string }, now: Date): DueState {
  if (a.status === "SUBMITTED" || a.status === "FEEDBACK") return "done";
  if (!a.dueAt) return "none";
  const left = a.dueAt.getTime() - now.getTime();
  if (left < 0) return "overdue";
  if (left <= 24 * HOUR) return "today";
  if (left <= 72 * HOUR) return "soon";
  return "later";
}

/**
 * Which reminder (if any) is due for an open assignment: "day" ~24h before (window 20–27h) and "hours" ~3h before
 * (window 0–4h). The hourly cron calls this; dedupe keys make each stage fire once.
 */
export function assignmentReminderStage(dueAt: Date, now: Date): "day" | "hours" | null {
  const left = (dueAt.getTime() - now.getTime()) / HOUR;
  if (left > 0 && left <= 4) return "hours";
  if (left > 20 && left <= 27) return "day";
  return null;
}

/** Open assignments sorted by due date (no date last). */
export function sortByDue<T extends { dueAt: Date | null; status: string }>(rows: T[]): T[] {
  const done = (s: string) => s === "SUBMITTED" || s === "FEEDBACK";
  return [...rows].sort((a, b) => {
    if (done(a.status) !== done(b.status)) return done(a.status) ? 1 : -1;
    const ad = a.dueAt?.getTime() ?? Infinity;
    const bd = b.dueAt?.getTime() ?? Infinity;
    return ad - bd;
  });
}
