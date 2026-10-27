import type { AtsProvider, WorkMode } from "@prisma/client";
import { extractTech, htmlToText, inferRoleCategory, inferSeniority, inferWorkMode } from "../taxonomy";
import { normalizeLocation } from "./location";
import type { NormalizedJob } from "./types";

/** Descriptions are shown in full on our page, but we cap storage; the original posting is always linked. */
const MAX_DESCRIPTION = 20_000;

export function buildJob(input: {
  externalId: string | number;
  source: AtsProvider;
  title: string;
  /** Raw location strings from the ATS (first non-empty wins for non-Israeli fallbacks). */
  locations?: (string | null | undefined)[];
  /** @deprecated use `locations` */
  location?: string | null;
  descriptionHtmlOrText: string;
  applyUrl: string;
  postedAt?: string | number | Date | null;
  workModeHint?: string | null;
}): NormalizedJob | null {
  const title = input.title?.trim();
  if (!title || !input.applyUrl) return null;
  const description = htmlToText(input.descriptionHtmlOrText ?? "").slice(0, MAX_DESCRIPTION);
  const rawLocations = [...(input.locations ?? []), input.location];
  const location = normalizeLocation(...rawLocations);
  const workMode: WorkMode = inferWorkMode(`${input.workModeHint ?? ""} ${rawLocations.join(" ")} ${title}`);
  const posted = input.postedAt ? new Date(input.postedAt) : new Date();
  return {
    externalId: String(input.externalId),
    source: input.source,
    title,
    roleCategory: inferRoleCategory(title),
    seniority: inferSeniority(title),
    location,
    workMode,
    techStack: extractTech(`${title}\n${description}`),
    description,
    applyUrl: input.applyUrl,
    postedAt: Number.isNaN(posted.getTime()) ? new Date() : posted,
  };
}
