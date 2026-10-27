import type { AtsProvider, WorkMode } from "@prisma/client";
import { extractTech, htmlToText, inferRoleCategory, inferSeniority, inferWorkMode } from "../taxonomy";
import type { NormalizedJob } from "./types";

export function buildJob(input: {
  externalId: string | number;
  source: AtsProvider;
  title: string;
  location?: string | null;
  descriptionHtmlOrText: string;
  applyUrl: string;
  postedAt?: string | number | Date | null;
  workModeHint?: string | null;
}): NormalizedJob | null {
  const title = input.title?.trim();
  if (!title || !input.applyUrl) return null;
  const description = htmlToText(input.descriptionHtmlOrText ?? "");
  const location = (input.location ?? "").trim() || "Israel";
  const workMode: WorkMode = inferWorkMode(`${input.workModeHint ?? ""} ${location} ${title}`);
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
