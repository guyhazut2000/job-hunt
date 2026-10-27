/** Client→server click events accepted by POST /api/events (whitelist; no free-form payloads). */
export const CLICK_EVENTS = ["job_apply_click", "job_linkedin_click"] as const;
export type ClickEvent = (typeof CLICK_EVENTS)[number];
export const CLICK_KINDS = ["company", "exact", "search"] as const;
export type ClickKind = (typeof CLICK_KINDS)[number];
export type ClickPlacement = "card" | "page" | "bar";

export function parseClickEvent(body: unknown): {
  event: ClickEvent;
  jobId: string;
  kind: ClickKind;
  placement: ClickPlacement;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!CLICK_EVENTS.includes(b.event as ClickEvent)) return null;
  if (typeof b.jobId !== "string" || !/^[a-z0-9]{8,40}$/i.test(b.jobId)) return null;
  if (!CLICK_KINDS.includes(b.kind as ClickKind)) return null;
  const placement = (["card", "page", "bar"] as const).find((p) => p === b.placement) ?? "page";
  return { event: b.event as ClickEvent, jobId: b.jobId, kind: b.kind as ClickKind, placement };
}
