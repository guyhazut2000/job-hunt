/**
 * Mandatory CV standard — server side. Runs the rules + the real-PDF one-page check for the
 * user's chosen template and written language, caches the verdict on Profile.cvStandard (keyed
 * by a content hash) and exposes the gate used by export, tailoring, APPLIED and onboarding.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CvContent } from "@/lib/cv-templates/content";
import { loadCvSource, loadLayout } from "@/lib/cv-templates/server";
import type { LayoutEntry } from "@/lib/cv-templates/sections";
import { TEMPLATES, isTemplateId, type TemplateId } from "@/lib/cv-templates/templates";
import type { CvLang } from "@/lib/i18n/cv-templates";
import { readProfessional } from "@/lib/profile/load";
import { cutSuggestions, fitCvPdf, type CutSuggestion, type FitResult } from "./fit";
import { evaluateStandard, type StandardReport } from "./rules";

export interface StoredStandard {
  hash: string;
  passed: boolean;
  contentPassed: boolean;
  pages: number;
  level: number;
  template: TemplateId;
  lang: CvLang;
  score: number;
  blocking: string[];
  checkedAt: string;
}

export interface StandardCheck {
  report: StandardReport;
  fit: Omit<FitResult, never>;
  cuts: CutSuggestion[];
  template: TemplateId;
  lang: CvLang;
  empty: boolean;
  stored: StoredStandard;
}

export const standardHash = (x: {
  content: CvContent;
  layout: LayoutEntry[];
  template: string;
  lang: string;
  skillCategories: string[];
  years: number | null | undefined;
}) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 20);

export const readStored = (v: unknown): StoredStandard | null =>
  v && typeof v === "object" && typeof (v as StoredStandard).hash === "string" ? (v as StoredStandard) : null;

async function inputs(userId: string, opts: { template?: string | null; lang?: CvLang | null } = {}) {
  const [source, profile] = await Promise.all([
    loadCvSource(userId),
    db.profile.findUnique({ where: { userId }, select: { yearsExperience: true, cvStandard: true, skillItems: true } }),
  ]);
  const template: TemplateId = isTemplateId(opts.template) ? opts.template : (source.chosen ?? source.recommended);
  const lang: CvLang = opts.lang ?? source.written;
  const layout = await loadLayout(userId, template, source.content);
  const skillCategories = readProfessional(profile as never).skillItems.map((s) => s.category);
  const years = profile?.yearsExperience ?? null;
  const hash = standardHash({ content: source.content, layout, template, lang, skillCategories, years });
  return { source, template, lang, layout, skillCategories, years, hash, stored: readStored(profile?.cvStandard) };
}

/** Full check (renders the PDF). Stores the verdict when it is for the default variant. */
export async function checkCvStandard(
  userId: string,
  opts: { template?: string | null; lang?: CvLang | null } = {},
): Promise<StandardCheck> {
  const i = await inputs(userId, opts);
  const fit = await fitCvPdf({ content: i.source.content, layout: i.layout, tpl: TEMPLATES[i.template], lang: i.lang });
  const report = evaluateStandard({
    content: i.source.content,
    template: i.template,
    skillCategories: i.skillCategories,
    yearsExperience: i.years,
    fit,
  });
  const stored: StoredStandard = {
    hash: i.hash,
    passed: report.passed,
    contentPassed: report.contentPassed,
    pages: fit.pages,
    level: fit.level,
    template: i.template,
    lang: i.lang,
    score: report.score,
    blocking: report.blocking.map((r) => r.id),
    checkedAt: new Date().toISOString(),
  };
  // Only the user's own default variant is the "standard of record".
  if (!opts.template && !opts.lang)
    await db.profile
      .update({ where: { userId }, data: { cvStandard: stored as unknown as Prisma.InputJsonValue } })
      .catch(() => undefined);
  const { buffer: _b, ...fitInfo } = fit;
  void _b;
  return {
    report,
    fit: fitInfo as FitResult,
    cuts: fit.fits ? [] : cutSuggestions(i.source.content, i.layout.filter((l) => l.visible).map((l) => l.id)),
    template: i.template,
    lang: i.lang,
    empty: i.source.empty,
    stored,
  };
}

/** Gate: cached by content hash; re-checks only when the CV changed. */
export async function requireCvStandard(userId: string): Promise<{ ok: boolean; stored: StoredStandard }> {
  const i = await inputs(userId);
  if (i.stored && i.stored.hash === i.hash) return { ok: i.stored.passed, stored: i.stored };
  const c = await checkCvStandard(userId);
  return { ok: c.stored.passed, stored: c.stored };
}

/** Cheap status for the banner: content rules live, page check from the cache when it matches. */
export async function cvStandardStatus(userId: string): Promise<{ passed: boolean; score: number; blocking: number }> {
  const i = await inputs(userId);
  if (i.stored && i.stored.hash === i.hash)
    return { passed: i.stored.passed, score: i.stored.score, blocking: i.stored.blocking.length };
  const r = evaluateStandard({
    content: i.source.content,
    template: i.template,
    skillCategories: i.skillCategories,
    yearsExperience: i.years,
  });
  // Unknown page fit counts as not yet passed (the editor runs the full check).
  return { passed: false, score: r.score, blocking: r.blocking.length };
}

export const STANDARD_PATH = "/cv/standard";
export const standardUrl = (from: "export" | "tailor" | "applied" | "onboarding" | "print") =>
  `${STANDARD_PATH}?from=${from}`;
