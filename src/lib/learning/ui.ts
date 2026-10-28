/**
 * Presentation helpers for the learning UI. Pure (no DB / React), so they are unit-tested and
 * safe to import from client components.
 */
import type { LearnCategory } from "./types";

export type SkillLevel = "beginner" | "intermediate" | "advanced";

/**
 * Entry level of a skill from the number of its transitive prerequisites
 * (`prerequisitePath(id).length`): 0–1 → beginner, 2–3 → intermediate, 4+ → advanced.
 * Takes the count rather than the graph so client components don't bundle the graph.
 */
export function levelFromDepth(depth: number): SkillLevel {
  return depth <= 1 ? "beginner" : depth <= 3 ? "intermediate" : "advanced";
}

/** Hue (OKLCH degrees) per category, used for soft monogram tiles. Text stays ≥ 4.5:1 on the tile. */
export const CATEGORY_HUE: Record<LearnCategory, number> = {
  foundations: 70,
  languages: 280,
  backend: 250,
  frontend: 200,
  mobile: 320,
  data: 145,
  devops: 35,
  cloud: 225,
  ml: 300,
  qa: 100,
  hardware: 15,
  design: 340,
};

export function categoryTone(cat: LearnCategory): { background: string; color: string } {
  const h = CATEGORY_HUE[cat];
  return { background: `oklch(0.935 0.04 ${h})`, color: `oklch(0.4 0.1 ${h})` };
}

/** Two-glyph monogram for a skill label: "Kubernetes" → "Ku", "CI/CD" → "CI", "C++" → "C++". */
export function monogram(label: string): string {
  const clean = label.replace(/[^\p{L}\p{N}+#]/gu, "");
  if (/^[\p{L}][+#]+$/u.test(clean)) return clean.slice(0, 3);
  return clean.slice(0, 2) || label.slice(0, 2);
}

/** Case-insensitive match of a search query against a node's label, aliases and id. */
export function matchesQuery(q: string, n: { id: string; label: string; aliases: string[] }): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [n.id, n.label, ...n.aliases].some((x) => x.toLowerCase().includes(s));
}
