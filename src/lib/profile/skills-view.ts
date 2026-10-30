import { SKILL_CATEGORIES, SKILL_LEVELS, type SkillCategory, type SkillLevel } from "./schema";

/**
 * Pure view helpers for the skills editor and the read-only skill chip lists
 * (grouping, collapsing, parsing the add field, autocomplete). No React here so it is unit-tested.
 */

/** Chips shown per group before "+N more" on the profile editor. */
export const EDITOR_VISIBLE = 8;
/** Chips shown before "+N more" on read-only lists (job page, match panel, CV match). */
export const LIST_VISIBLE = 8;

/** Case/space/diacritic-insensitive key used for de-duplication and matching. */
export function skillKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Split the add field: commas (Latin, Hebrew/Arabic), semicolons and new lines separate skills. */
export function parseSkillInput(text: string, existing: readonly string[] = []): string[] {
  const have = new Set(existing.map(skillKey));
  const out: string[] = [];
  for (const raw of text.split(/[,،;\n]+/)) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    const key = skillKey(name);
    if (!key || have.has(key)) continue;
    have.add(key);
    out.push(name);
  }
  return out;
}

/** The fragment after the last separator — what autocomplete should complete. */
export function currentFragment(text: string): string {
  const parts = text.split(/[,،;\n]/);
  return parts[parts.length - 1]?.trim() ?? "";
}

/** Replace the fragment being typed with the picked suggestion, keeping earlier comma-separated names. */
export function replaceFragment(text: string, pick: string): string {
  const idx = Math.max(text.lastIndexOf(","), text.lastIndexOf("،"), text.lastIndexOf(";"), text.lastIndexOf("\n"));
  return idx < 0 ? pick : `${text.slice(0, idx + 1)} ${pick}`;
}

/** Autocomplete: prefix matches first, then word-start, then substring; skips skills already listed. */
export function suggestSkills(
  query: string,
  known: readonly string[],
  existing: readonly string[] = [],
  limit = 6,
): string[] {
  const q = skillKey(query);
  if (!q) return [];
  const have = new Set(existing.map(skillKey));
  const seen = new Set<string>();
  const ranked: { name: string; rank: number }[] = [];
  for (const name of known) {
    const key = skillKey(name);
    if (have.has(key) || seen.has(key) || key === q) continue;
    seen.add(key);
    let rank = -1;
    if (key.startsWith(q)) rank = 0;
    else if (key.split(/[\s./-]+/).some((w) => w.startsWith(q))) rank = 1;
    else if (key.includes(q)) rank = 2;
    if (rank >= 0) ranked.push({ name, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((r) => r.name);
}

const LEVEL_RANK: Record<SkillLevel, number> = Object.fromEntries(SKILL_LEVELS.map((l, i) => [l, i + 1])) as Record<
  SkillLevel,
  number
>;

export interface GroupableSkill {
  name: string;
  level: SkillLevel;
  category: SkillCategory;
}

export interface SkillGroup<S> {
  category: SkillCategory;
  /** items with their index in the source array (so edits patch the right row). */
  items: { skill: S; index: number }[];
}

/**
 * Group by category (fixed category order) and, inside a group, strongest first (EXPERT → BASIC),
 * otherwise keeping the user's order. Display-only: the underlying array order is untouched.
 */
export function groupSkills<S extends GroupableSkill>(skills: readonly S[]): SkillGroup<S>[] {
  return SKILL_CATEGORIES.map((category) => ({
    category,
    items: skills
      .map((skill, index) => ({ skill, index }))
      .filter(({ skill }) => skill.category === category)
      .sort((a, b) => LEVEL_RANK[b.skill.level] - LEVEL_RANK[a.skill.level] || a.index - b.index),
  })).filter((g) => g.items.length > 0);
}

/** How many of each level — for the legend counts. */
export function levelCounts(skills: readonly { level: SkillLevel }[]): Record<SkillLevel, number> {
  const out = Object.fromEntries(SKILL_LEVELS.map((l) => [l, 0])) as Record<SkillLevel, number>;
  for (const s of skills) out[s.level] += 1;
  return out;
}

/** Number of filled bars (1–3) for a level. */
export const levelBars = (level: SkillLevel): number => LEVEL_RANK[level];

/**
 * Collapse a long list. Never hides just one item ("+1 more" is worse than showing it),
 * and keeps `pinned` index (e.g. a just-added or just-edited chip) visible.
 */
export function collapse<X>(
  items: readonly X[],
  limit: number,
  expanded: boolean,
  pinned?: (x: X) => boolean,
): { shown: X[]; hidden: number } {
  if (expanded || items.length <= limit + 1) return { shown: [...items], hidden: 0 };
  const shown = items.slice(0, limit);
  if (pinned) for (const x of items.slice(limit)) if (pinned(x)) shown.push(x);
  return { shown, hidden: items.length - shown.length };
}

/** Years as a short label: "5", "1.5", "" when unknown. */
export function yearsLabel(years: string | number | null | undefined): string {
  if (years == null || years === "") return "";
  const n = Number(years);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 2) / 2);
}
