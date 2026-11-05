/**
 * What this app can honestly do with a job.
 *
 * Greenhouse Job Board GET (questions) is public. The submit POST requires the employer's
 * Job Board API key (HTTP Basic). https://developers.greenhouse.io/job-board.html
 *
 * Lever apply POST requires that site's API key, and the public Postings API does not return
 * custom questions, so a POST from here would file an incomplete candidate. Lever is always
 * a handoff. https://github.com/lever/postings-api
 *
 * Ashby public posting API is GET-only. applicationForm.submit and jobPosting.info need the
 * employer's API key (jobsRead + candidatesWrite). https://developers.ashbyhq.com/docs/public-job-posting-api
 *
 * LinkedIn URLs and mailto links are never fetched and never sent.
 */
import type { BoardKeys } from "./keys";

export type ApplyPlatform = "greenhouse" | "lever" | "ashby" | "other";
export type DeliveryPlan = "api" | "handoff" | "manual";

export type ClassifyReason =
  | "linkedin"
  | "email"
  | "unsupported"
  | "greenhouse_api"
  | "greenhouse_no_key"
  | "lever_no_submit"
  | "ashby_api"
  | "ashby_no_key"
  | "form_unavailable";

export interface ClassifiedTarget {
  platform: ApplyPlatform;
  delivery: DeliveryPlan;
  reason: ClassifyReason;
}

const LINKEDIN_HOSTS = new Set(["linkedin.com", "lnkd.in"]);

export function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return LINKEDIN_HOSTS.has(host) || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

export function isEmailUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith("mailto:");
}

function platformOf(source: string): ApplyPlatform {
  if (source === "GREENHOUSE") return "greenhouse";
  if (source === "LEVER") return "lever";
  if (source === "ASHBY") return "ashby";
  return "other";
}

export function classifyTarget(input: {
  source: string;
  applyUrl: string;
  boardId: string | null;
  keys: BoardKeys;
}): ClassifiedTarget {
  if (isLinkedInUrl(input.applyUrl)) return { platform: "other", delivery: "manual", reason: "linkedin" };
  if (isEmailUrl(input.applyUrl)) return { platform: "other", delivery: "manual", reason: "email" };
  const platform = platformOf(input.source);
  const board = input.boardId?.trim() ?? "";
  if (platform === "greenhouse") {
    if (board && input.keys.greenhouse[board]) {
      return { platform, delivery: "api", reason: "greenhouse_api" };
    }
    return { platform, delivery: "handoff", reason: "greenhouse_no_key" };
  }
  if (platform === "lever") return { platform, delivery: "handoff", reason: "lever_no_submit" };
  if (platform === "ashby") {
    if (board && input.keys.ashby[board]) return { platform, delivery: "api", reason: "ashby_api" };
    return { platform, delivery: "handoff", reason: "ashby_no_key" };
  }
  return { platform: "other", delivery: "manual", reason: "unsupported" };
}
