import type { AtsProvider, Seniority, WorkMode } from "@prisma/client";

/** A job normalized from any ATS into our canonical shape. */
export interface NormalizedJob {
  externalId: string;
  source: AtsProvider;
  title: string;
  roleCategory: string;
  seniority: Seniority;
  location: string;
  workMode: WorkMode;
  techStack: string[];
  description: string;
  applyUrl: string;
  postedAt: Date;
}

export interface AdapterContext {
  /** Provider-specific board identifier (Greenhouse board token, Lever site, Comeet "uid:token"). */
  boardId: string;
  fetchImpl?: typeof fetch;
}

/**
 * An ATS adapter knows how to fetch a company's public job board and normalize it.
 * Add a new ATS by implementing this interface and registering it in `registry.ts`.
 */
export interface AtsAdapter<Raw = unknown> {
  provider: AtsProvider;
  fetchRaw(ctx: AdapterContext): Promise<Raw[]>;
  normalize(raw: Raw): NormalizedJob | null;
}
