/** Client→server click events accepted by POST /api/events (whitelist; no free-form payloads). */
export const CLICK_EVENTS = ["job_apply_click", "job_linkedin_click", "company_linkedin_click"] as const;
export type ClickEvent = (typeof CLICK_EVENTS)[number];
export const CLICK_KINDS = ["company", "exact", "search", "company_page", "company_search", "company_jobs"] as const;
export type ClickKind = (typeof CLICK_KINDS)[number];
export const CLICK_PLACEMENTS = ["card", "page", "bar", "header", "list"] as const;
export type ClickPlacement = (typeof CLICK_PLACEMENTS)[number];

const ID = /^[a-z0-9]{8,40}$/i;
const COMPANY_KINDS: readonly ClickKind[] = ["company_page", "company_search", "company_jobs"];

export function parseClickEvent(body: unknown): {
  event: ClickEvent;
  jobId?: string;
  companyId?: string;
  kind: ClickKind;
  placement: ClickPlacement;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!CLICK_EVENTS.includes(b.event as ClickEvent)) return null;
  if (!CLICK_KINDS.includes(b.kind as ClickKind)) return null;
  const event = b.event as ClickEvent;
  const kind = b.kind as ClickKind;
  const jobId = typeof b.jobId === "string" && ID.test(b.jobId) ? b.jobId : undefined;
  const companyId = typeof b.companyId === "string" && ID.test(b.companyId) ? b.companyId : undefined;
  if (b.jobId !== undefined && !jobId) return null;
  if (b.companyId !== undefined && !companyId) return null;
  if (event === "company_linkedin_click") {
    // Company links may sit on a job page (jobId too) or on company pages (companyId only).
    if (!companyId || !COMPANY_KINDS.includes(kind)) return null;
  } else if (!jobId || COMPANY_KINDS.includes(kind)) {
    return null;
  }
  const placement = CLICK_PLACEMENTS.find((p) => p === b.placement) ?? "page";
  return { event, ...(jobId && { jobId }), ...(companyId && { companyId }), kind, placement };
}
