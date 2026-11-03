/**
 * The hard one-page check: render the real PDF for the chosen template + language, count pages,
 * auto-tighten within safe limits (density.ts), and when even the tightest level overflows,
 * tell the user what to cut (cutSuggestions — pure, unit-tested).
 */
import type { CvContent } from "@/lib/cv-templates/content";
import type { CvLang } from "@/lib/i18n/cv-templates";
import type { LayoutEntry } from "@/lib/cv-templates/sections";
import type { CvTemplate } from "@/lib/cv-templates/templates";
import { MAX_DENSITY } from "./density";
import { LIMITS, wordCount } from "./rules";

export interface PageMeasure {
  pages: number;
  /** How full the last page is, 0..1 (lowest text line / page height). */
  lastFill: number;
}

export interface FitResult {
  pages: number;
  level: number;
  fits: boolean;
  /** Total height used in pages (e.g. 1.18 = 18% over one page). */
  used: number;
  tried: { level: number; pages: number; used: number }[];
}

export async function measurePdf(buf: Uint8Array): Promise<PageMeasure> {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const pages = doc.numPages;
  let lastFill = 1;
  try {
    const page = await doc.getPage(pages);
    const height = page.getViewport({ scale: 1 }).height;
    const tc = await page.getTextContent();
    let minY = height;
    for (const it of tc.items as { transform?: number[]; str?: string }[])
      if (it.transform && it.str?.trim()) minY = Math.min(minY, it.transform[5]);
    lastFill = Math.min(1, Math.max(0, (height - minY) / height));
  } catch {
    // keep 1
  }
  return { pages, lastFill };
}

const used = (m: PageMeasure) => Math.round((m.pages - 1 + m.lastFill) * 100) / 100;

/**
 * Try density 0..3 until the PDF is one page. `render` is injected so tests can fake it and the
 * route can reuse the buffer of the winning level.
 */
export async function fitToOnePage(
  render: (level: number) => Promise<Uint8Array>,
  maxLevel = MAX_DENSITY,
): Promise<FitResult & { buffer: Uint8Array }> {
  const tried: FitResult["tried"] = [];
  let last: { buffer: Uint8Array; m: PageMeasure; level: number } | null = null;
  for (let level = 0; level <= maxLevel; level++) {
    const buffer = await render(level);
    const m = await measurePdf(buffer);
    tried.push({ level, pages: m.pages, used: used(m) });
    last = { buffer, m, level };
    if (m.pages <= 1) break;
  }
  const l = last!;
  return { pages: l.m.pages, level: l.level, fits: l.m.pages <= 1, used: tried[0].used, tried, buffer: l.buffer };
}

export async function fitCvPdf(input: {
  content: CvContent;
  layout: LayoutEntry[];
  tpl: CvTemplate;
  lang: CvLang;
}): Promise<FitResult & { buffer: Uint8Array }> {
  const { renderCvPdf } = await import("@/lib/cv-templates/pdf");
  return fitToOnePage(async (level) => new Uint8Array(await renderCvPdf({ ...input, densityLevel: level })));
}

export type CutKind =
  | "hideSection"
  | "trimOldRole"
  | "trimRole"
  | "shortenBullets"
  | "shortenSummary"
  | "fewerSkills"
  | "fewerProjects"
  | "fewerEducation";

export interface CutSuggestion {
  kind: CutKind;
  params: Record<string, string | number>;
}

/**
 * What to cut, most effective first. `visible` = section ids rendered by the layout.
 * Only suggests cuts of what exists; never suggests removing the core sections.
 */
export function cutSuggestions(c: CvContent, visible: string[]): CutSuggestion[] {
  const out: CutSuggestion[] = [];
  const shown = (id: string) => visible.includes(id);
  if (shown("volunteering") && c.volunteering.length) out.push({ kind: "hideSection", params: { section: "volunteering" } });
  for (const x of c.custom) if (shown(`custom:${x.id}`)) out.push({ kind: "hideSection", params: { section: x.title } });
  const exp = c.experience;
  if (exp.length >= 3) {
    const old = exp[exp.length - 1];
    if (old.bullets.length > 1)
      out.push({ kind: "trimOldRole", params: { role: old.title || old.org, from: old.bullets.length, to: 1 } });
  }
  exp.forEach((e) => {
    if (e.bullets.length > 4) out.push({ kind: "trimRole", params: { role: e.title || e.org, from: e.bullets.length, to: 4 } });
  });
  const longB = [...exp, ...c.projects].flatMap((e) => e.bullets).filter((b) => b.length > 160).length;
  if (longB) out.push({ kind: "shortenBullets", params: { n: longB, max: 160 } });
  const sw = wordCount(c.summary);
  if (sw > 50) out.push({ kind: "shortenSummary", params: { from: sw, to: 50 } });
  if (shown("projects") && c.projects.length > 3) out.push({ kind: "fewerProjects", params: { from: c.projects.length, to: 3 } });
  if (c.skills.length > 20) out.push({ kind: "fewerSkills", params: { from: c.skills.length, to: Math.min(20, LIMITS.skillsMax) } });
  if (c.education.length > 3) out.push({ kind: "fewerEducation", params: { from: c.education.length, to: 3 } });
  return out;
}
