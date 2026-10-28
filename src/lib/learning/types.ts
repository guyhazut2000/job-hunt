/**
 * Learning roadmaps: types for the curated skill graph (src/lib/learning/skills-graph.ts).
 * All content in the graph is original to this product. External pages are only linked to.
 */

export const LEARN_CATEGORIES = [
  "foundations",
  "languages",
  "backend",
  "frontend",
  "mobile",
  "data",
  "devops",
  "cloud",
  "ml",
  "qa",
  "hardware",
  "design",
] as const;
export type LearnCategory = (typeof LEARN_CATEGORIES)[number];

export const STAGES = ["fundamentals", "intermediate", "applied"] as const;
export type Stage = (typeof STAGES)[number];

export interface Resource {
  /** Title as published by the provider (proper noun, not translated). */
  title: string;
  url: string;
  /** Publisher, e.g. "MIT OpenCourseWare", "Linux Foundation". */
  by: string;
}

export interface Bilingual {
  he: string;
  en: string;
}

export interface SkillNode {
  /** Stable URL slug, e.g. "kubernetes" -> /learn/kubernetes. */
  id: string;
  /** Display label. Matches the label our extractor emits (src/lib/taxonomy.ts) when it emits one. */
  label: string;
  /**
   * Other names that mean this skill (case-insensitive). Used to map job tech labels and free-text
   * profile skills onto the node. The label is always an alias implicitly.
   */
  aliases: string[];
  category: LearnCategory;
  /** Hard prerequisites (node ids): learn these first. Must form a DAG (tested). */
  prerequisites: string[];
  /** Rough hours to reach job-usable basics (fundamentals + intermediate + a first applied project). */
  hours: number;
  summary: Bilingual;
  /** Topics per stage, in learning order. Technical terms stay in English (as used in Israeli hi-tech). */
  stages: Record<Stage, string[]>;
  /** Official documentation / getting-started guide. */
  docs: Resource;
  /** Free university-grade or official training course. */
  course: Resource;
  /** Hands-on project idea, written by us. */
  project: Bilingual;
  /** Optional slug of the matching https://roadmap.sh/<slug> page (external reference only). */
  roadmapSh?: string;
}

/** Stage workspace tabs (shared by the server page and the client workspace). */
export const WORKSPACE_TABS = ["practice", "qa", "tutor"] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
