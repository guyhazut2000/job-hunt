/** Turn content + layout + template into the ordered blocks every renderer draws. */
import { CV_LABELS, sectionLabel, type CvLang } from "@/lib/i18n/cv-templates";
import type { CvContent } from "./content";
import { isBuiltin, type LayoutEntry, type SectionId } from "./sections";
import type { CvTemplate } from "./templates";

export interface Block {
  id: SectionId;
  title: string;
  column: "main" | "side";
}

export function sectionHasContent(c: CvContent, id: SectionId): boolean {
  switch (id) {
    case "summary":
      return !!c.summary.trim();
    case "experience":
    case "projects":
    case "education":
    case "military":
    case "volunteering":
    case "skills":
    case "languages":
    case "links":
      return c[id].length > 0;
    default:
      return !!c.custom.find((x) => `custom:${x.id}` === id && x.bullets.length > 0);
  }
}

export function blockTitle(c: CvContent, e: LayoutEntry, tpl: CvTemplate, lang: CvLang): string {
  const renamed = e.titles[lang]?.trim();
  if (renamed) return renamed;
  if (isBuiltin(e.id)) return sectionLabel(lang, tpl.id, e.id);
  return c.custom.find((x) => `custom:${x.id}` === e.id)?.title ?? "";
}

export function resolveBlocks(c: CvContent, layout: LayoutEntry[], tpl: CvTemplate, lang: CvLang): Block[] {
  return layout
    .filter((e) => e.visible && sectionHasContent(c, e.id))
    .map((e) => ({
      id: e.id,
      title: blockTitle(c, e, tpl, lang),
      column: tpl.columns === 2 && tpl.sidebar.includes(e.id) ? ("side" as const) : ("main" as const),
    }));
}

export const levelLabel = (lang: CvLang, level?: string) =>
  level && level in CV_LABELS[lang].levels
    ? CV_LABELS[lang].levels[level as keyof (typeof CV_LABELS)["he"]["levels"]]
    : "";

/** Very light tint of the accent colour for sidebars / bands that still prints well in grayscale. */
export function tint(hex: string, amount = 0.9): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
