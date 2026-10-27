import type { AtsProvider, CompanySyncMode } from "@prisma/client";

export const SYNC_FAILING_THRESHOLD = 3;

export interface CompanySyncInfo {
  syncMode: CompanySyncMode;
  atsProvider: AtsProvider;
  atsBoardId: string | null;
  careersUrl?: string | null;
  website?: string | null;
  syncFailures?: number;
}

/** Jobs are not pulled automatically: switched to manual, or there is no ATS board to pull from. */
export function isManualCompany(c: CompanySyncInfo): boolean {
  return c.syncMode === "MANUAL" || c.atsProvider === "MANUAL" || !c.atsBoardId;
}

/** An AUTO company whose feed failed several syncs in a row (it stays listed; the error is shown). */
export function isSyncFailing(c: CompanySyncInfo): boolean {
  return !isManualCompany(c) && (c.syncFailures ?? 0) >= SYNC_FAILING_THRESHOLD;
}

/** Where to look for openings by hand: the careers page, else the company website. */
export function careersLink(c: Pick<CompanySyncInfo, "careersUrl" | "website">): string | null {
  return safeHttpUrl(c.careersUrl) ?? safeHttpUrl(c.website);
}

export type CompanyFilter = "all" | "auto" | "manual";

export function parseCompanyFilter(v: string | string[] | undefined): CompanyFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "auto" || s === "manual" ? s : "all";
}

export function matchesFilter(c: CompanySyncInfo, filter: CompanyFilter): boolean {
  if (filter === "all") return true;
  return filter === "manual" ? isManualCompany(c) : !isManualCompany(c);
}

/** Only http(s) URLs are ever rendered as links; LinkedIn is never used as a careers page. */
export function safeHttpUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
