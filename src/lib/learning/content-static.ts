import type { Locale } from "@/lib/i18n/dictionaries";
import { normalizeStageContent, type StageContentData } from "./content";
import type { Stage } from "./types";
import data from "./content-static.json";

/**
 * Curated, original practice + Q&A for the most in-demand skills, used when the AI is
 * unavailable (quota hit / LLM_PROVIDER=mock / CI). Written for this product (drafted with our
 * own model and reviewed); not copied from roadmap.sh or any other site.
 * Shape: { [skillId]: { he|en: { fundamentals|intermediate|applied: StageContent } } }.
 */
type Raw = Record<string, Partial<Record<Locale, Partial<Record<Stage, unknown>>>>>;
const RAW = data as Raw;

export const STATIC_SKILLS = Object.keys(RAW);

export function staticStageContent(skill: string, stage: Stage, locale: Locale): StageContentData | null {
  const raw = RAW[skill]?.[locale]?.[stage] ?? RAW[skill]?.[locale === "he" ? "en" : "he"]?.[stage];
  return raw ? normalizeStageContent(raw) : null;
}
