/**
 * Auto-tighten levels for the one-page fit (docs/cv-best-practices.md §8). Every level stays inside
 * the research's safe limits: body font ≥ 9.5pt, line height ≥ 1.2, side margins 36pt (0.5"),
 * top/bottom ≥ 24pt, inter-section spacing ≥ 60% of the original. Beyond level 3 we ask the user to cut.
 */
import type { CvTemplate } from "@/lib/cv-templates/templates";

export const MAX_DENSITY = 3;
export const MIN_BODY_PT = 9.5;

export interface Density {
  level: number;
  /** Multiplier for vertical spacing (section/entry/bullet gaps). */
  k: number;
  lineHeight: number;
  padTop: number;
  padBottom: number;
}

const LEVELS: Omit<Density, "level">[] = [
  { k: 1, lineHeight: 1.35, padTop: 32, padBottom: 34 },
  { k: 0.85, lineHeight: 1.3, padTop: 28, padBottom: 28 },
  { k: 0.72, lineHeight: 1.25, padTop: 26, padBottom: 26 },
  { k: 0.6, lineHeight: 1.2, padTop: 24, padBottom: 24 },
];
const FONT_STEP = [0, 0.25, 0.5, 0.75];

export function clampLevel(level: number | undefined | null): number {
  const n = Math.round(Number(level ?? 0));
  return Number.isFinite(n) ? Math.min(MAX_DENSITY, Math.max(0, n)) : 0;
}

export function density(level?: number | null): Density {
  const l = clampLevel(level);
  return { level: l, ...LEVELS[l] };
}

/** Template with the body size reduced for the level, never below MIN_BODY_PT (or the template's own size if smaller). */
export function tightenTemplate(tpl: CvTemplate, level?: number | null): CvTemplate {
  const l = clampLevel(level);
  if (!l) return tpl;
  const floor = Math.min(tpl.size, MIN_BODY_PT);
  return { ...tpl, size: Math.max(floor, tpl.size - FONT_STEP[l]) };
}
