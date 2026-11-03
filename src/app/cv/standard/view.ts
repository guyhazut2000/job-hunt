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
});
