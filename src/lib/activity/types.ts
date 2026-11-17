/** Event types the activity log stores (a whitelist; the beacon can only send `page_view`). */
export const ACTIVITY_TYPES = [
  "sign_in",
  "sign_in_failed",
  "sign_out",
  "sign_up",
  "page_view",
  "job_saved",
  "application_status",
  "cv_uploaded",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as readonly string[]).includes(v);
}

/** How long rows are kept before the hourly cron deletes them. */
export const ACTIVITY_RETENTION_DAYS = 90;

/** Repeat views of the same path inside this window are not recorded again (client-side dedupe). */
export const PAGE_VIEW_DEDUPE_MS = 30_000;
