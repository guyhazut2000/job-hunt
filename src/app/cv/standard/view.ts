import type { CutSuggestion } from "@/lib/cv-standard/fit";
import type { RuleResult } from "@/lib/cv-standard/rules";
import type { StandardCheck } from "@/lib/cv-standard/server";
import type { TemplateId } from "@/lib/cv-templates/templates";

/** Serializable result for the client editor. */
export interface CheckView {
  passed: boolean;
  contentPassed: boolean;
  score: number;
  results: RuleResult[];
  pages: number;
  level: number;
  used: number;
  fits: boolean;
  cuts: CutSuggestion[];
  template: TemplateId;
  lang: "he" | "en";
  /** The real-PDF page check failed to run; the meter shows an error instead of a verdict. */
  fitError: boolean;
}

export const toCheckView = (c: StandardCheck): CheckView => ({
  passed: c.report.passed,
  contentPassed: c.report.contentPassed,
  score: c.report.score,
  results: c.report.results,
  pages: c.fit.pages,
  level: c.fit.level,
  used: c.fit.used,
  fits: c.fit.fits,
  cuts: c.cuts,
  template: c.template,
  lang: c.lang,
  fitError: c.fitError,
});

export interface EntryInfo {
  title: string;
  org: string;
  period: string;
}

export const entryInfo = (e: { title: string; org: string; start: string; end: string }): EntryInfo => ({
  title: e.title,
  org: e.org,
  period: [e.start, e.end].filter(Boolean).join(" – "),
});

/** What the editor rebuilds from after a save (entries added from a CV import are now real). */
export interface EditorBase {
  baseContent: import("@/lib/cv-templates/content").CvContent;
  experience: EntryInfo[];
  projects: EntryInfo[];
  education: EntryInfo[];
}

export function editorBase(c: import("@/lib/cv-templates/content").CvContent): EditorBase {
  return {
    baseContent: c,
    experience: c.experience.map(entryInfo),
    projects: c.projects.map(entryInfo),
    education: [...c.education, ...c.military].map(entryInfo),
  };
}
