/**
 * Mandatory CV standard (docs/cv-best-practices.md). Pure: content in, report out. The one-page check
 * needs the rendered PDF, so the caller passes its result (`fit`); without it that rule is "pending".
 * Messages and tips live in src/lib/i18n/cv-standard.ts, keyed by rule id.
 */
import type { CvContent, CvEntry } from "@/lib/cv-templates/content";
import { contentStrings } from "@/lib/cv-templates/content";
import type { TemplateId } from "@/lib/cv-templates/templates";
import { hasFirstPersonPronoun, hasMetric, startsWithActionVerb } from "./verbs";

export type Severity = "blocking" | "warning";
export type RuleStatus = "pass" | "fail" | "pending";
export type StandardSection = "contact" | "summary" | "experience" | "projects" | "education" | "skills" | "page";

export const RULE_IDS = [
  // blocking
  "name",
  "email",
  "phone",
  "link",
  "headline",
  "summaryPresent",
  "summaryMax",
  "hasEntries",
  "bulletsPresent",
  "bulletsMax",
  "bulletTooLong",
  "verbsHalf",
  "metricAny",
  "skillsMin",
  "noPersonal",
  "noStreetAddress",
  "datesValid",
  "onePage",
  // warnings
  "linkedin",
  "summaryRange",
  "bulletsRange",
  "bulletLength",
  "verbsAll",
  "metricThird",
  "pronouns",
  "skillsMax",
  "skillsGrouped",
  "datesOrder",
  "datesFormat",
  "education",
  "juniorProjects",
  "twoColumns",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export interface Ref {
  section: "experience" | "projects" | "summary" | "education" | "military" | "contact" | "custom";
  index?: number;
  bullet?: number;
}

export interface RuleResult {
  id: RuleId;
  severity: Severity;
  section: StandardSection;
  status: RuleStatus;
  params?: Record<string, string | number>;
  refs?: Ref[];
}

export interface FitInfo {
  pages: number;
  /** Auto-tighten level used (0..3). */
  level: number;
  /** Pages at the tightest safe level, when it still does not fit. */
  fits: boolean;
}

export interface StandardInput {
  content: CvContent;
  /** Category per skill (profile skillItems), same order as content.skills when known. */
  skillCategories?: string[];
  yearsExperience?: number | null;
  template: TemplateId;
  fit?: FitInfo | null;
  now?: Date;
}

export interface StandardReport {
  results: RuleResult[];
  blocking: RuleResult[];
  warnings: RuleResult[];
  pending: RuleResult[];
  /** True when every blocking rule passes (pending blocking rules count as not passed). */
  passed: boolean;
  /** True when every blocking rule except the page check passes. */
  contentPassed: boolean;
  score: number;
}

export const LIMITS = {
  summaryMaxWords: 90,
  summaryMinWords: 15,
  summaryIdealMaxWords: 60,
  bulletsMinIdeal: 2,
  bulletsMaxIdeal: 5,
  bulletsMax: 8,
  bulletMaxChars: 300,
  bulletIdealMax: 200,
  bulletIdealMin: 25,
  skillsMin: 4,
  skillsMax: 30,
  recentRoles: 3,
} as const;

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// ----- personal details (Equal Employment Opportunities Law, §6) -----
const PERSONAL_PHRASES = [
  "תעודת זהות",
  "ת.ז",
  "ת\"ז",
  "ת״ז",
  "מצב משפחתי",
  "תאריך לידה",
  "שנת לידה",
  "date of birth",
  "marital status",
  "references available",
  "references upon request",
  "references on request",
  "references: available",
  "ממליצים יינתנו",
  "ממליצים לפי בקשה",
  "ממליצים לפי דרישה",
  "ממליצים:",
  "המלצות יינתנו",
  "המלצות לפי בקשה",
  "id number",
  "id no",
];
const PERSONAL_TOKENS = new Set([
  "נשוי",
  "נשואה",
  "רווק",
  "רווקה",
  "גרוש",
  "גרושה",
  "אלמן",
  "אלמנה",
  "married",
  "divorced",
  "widowed",
  "dob",
  "יליד",
  "ילידת",
]);

/** Personal details that do not belong on a CV; returns the offending snippet or null. */
export function personalDetail(text: string): string | null {
  const low = text.toLowerCase();
  for (const p of PERSONAL_PHRASES) if (low.includes(p)) return p;
  for (const t of low.split(/[^\p{L}\p{N}]+/u)) if (PERSONAL_TOKENS.has(t)) return t;
  const age = low.match(/(?:\bage\s*:?\s*\d{2}\b|גיל\s*:?\s*\d{2})/);
  if (age) return age[0];
  return null;
}

export function looksLikeStreetAddress(location: string): boolean {
  return /\d/.test(location) || /(רחוב|רח['׳]|שד['׳]|שדרות|\bstreet\b|\bst\.|\bave\b|\bavenue\b|\broad\b|\brd\.)/i.test(location);
}

// ----- dates -----
const DATE_RE = /^(\d{4})(?:-(\d{2}))?$/;
/** Months since year 0, or null. */
export function dateValue(s: string): number | null {
  const m = DATE_RE.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0);
}

const allBullets = (c: CvContent) =>
  [...c.experience.map((e, i) => ["experience", i, e] as const), ...c.projects.map((e, i) => ["projects", i, e] as const)]
    .flatMap(([section, index, e]) => e.bullets.map((text, bullet) => ({ section, index, bullet, text })));

export function evaluateStandard(input: StandardInput): StandardReport {
  const { content: c } = input;
  const now = input.now ?? new Date();
  const results: RuleResult[] = [];
  const add = (
    id: RuleId,
    severity: Severity,
    section: StandardSection,
    ok: boolean | null,
    params?: RuleResult["params"],
    refs?: Ref[],
  ) =>
    results.push({
      id,
      severity,
      section,
      status: ok === null ? "pending" : ok ? "pass" : "fail",
      ...(params ? { params } : {}),
      ...(refs?.length ? { refs } : {}),
    });

  // contact
  const has = (k: string) => c.contact.some((x) => x.kind === k && x.value.trim());
  add("name", "blocking", "contact", c.name.trim().length > 1);
  add("email", "blocking", "contact", has("email"));
  add("phone", "blocking", "contact", has("phone") && /\d{6,}/.test(c.contact.find((x) => x.kind === "phone")!.value.replace(/\D/g, "")));
  add("link", "blocking", "contact", c.links.some((l) => /^https?:\/\/\S+\.\S+/.test(l.url.trim())));
  add("linkedin", "warning", "contact", c.links.some((l) => l.kind === "linkedin"));
  const location = c.contact.find((x) => x.kind === "location")?.value ?? "";
  add("noStreetAddress", "blocking", "contact", !location || !looksLikeStreetAddress(location));

  // summary
  const sw = wordCount(c.summary);
  add("headline", "blocking", "summary", c.headline.trim().length >= 3);
  add("summaryPresent", "blocking", "summary", sw > 0);
  add("summaryMax", "blocking", "summary", sw <= LIMITS.summaryMaxWords, { words: sw, max: LIMITS.summaryMaxWords });
  add(
    "summaryRange",
    "warning",
    "summary",
    sw === 0 || (sw >= LIMITS.summaryMinWords && sw <= LIMITS.summaryIdealMaxWords),
    { words: sw, min: LIMITS.summaryMinWords, max: LIMITS.summaryIdealMaxWords },
  );

  // entries & bullets
  const withBullets = (l: CvEntry[]) => l.filter((e) => e.bullets.length > 0).length;
  add("hasEntries", "blocking", "experience", withBullets(c.experience) + withBullets(c.projects) > 0);
  const recent = c.experience.slice(0, LIMITS.recentRoles);
  const empty = recent.map((e, i) => (e.bullets.length ? -1 : i)).filter((i) => i >= 0);
  add("bulletsPresent", "blocking", "experience", empty.length === 0, undefined, empty.map((index) => ({ section: "experience", index })));
  const tooMany = c.experience.map((e, i) => (e.bullets.length > LIMITS.bulletsMax ? i : -1)).filter((i) => i >= 0);
  add("bulletsMax", "blocking", "experience", tooMany.length === 0, { max: LIMITS.bulletsMax }, tooMany.map((index) => ({ section: "experience", index })));
  const offRange = recent
    .map((e, i) => (e.bullets.length && (e.bullets.length < LIMITS.bulletsMinIdeal || e.bullets.length > LIMITS.bulletsMaxIdeal) ? i : -1))
    .filter((i) => i >= 0);
  add("bulletsRange", "warning", "experience", offRange.length === 0, { min: LIMITS.bulletsMinIdeal, max: LIMITS.bulletsMaxIdeal }, offRange.map((index) => ({ section: "experience", index })));

  const bullets = allBullets(c);
  const ref = (b: (typeof bullets)[number]): Ref => ({ section: b.section, index: b.index, bullet: b.bullet });
  const long = bullets.filter((b) => b.text.length > LIMITS.bulletMaxChars);
  add("bulletTooLong", "blocking", "experience", long.length === 0, { max: LIMITS.bulletMaxChars }, long.map(ref));
  const oddLen = bullets.filter((b) => b.text.length > LIMITS.bulletIdealMax || b.text.length < LIMITS.bulletIdealMin);
  add("bulletLength", "warning", "experience", oddLen.length === 0, { min: LIMITS.bulletIdealMin, max: LIMITS.bulletIdealMax }, oddLen.map(ref));

  const noVerb = bullets.filter((b) => !startsWithActionVerb(b.text));
  const verbShare = bullets.length ? (bullets.length - noVerb.length) / bullets.length : 1;
  add("verbsHalf", "blocking", "experience", bullets.length < 3 || verbShare >= 0.5, { pct: Math.round(verbShare * 100) }, noVerb.map(ref));
  add("verbsAll", "warning", "experience", noVerb.length === 0, { n: noVerb.length }, noVerb.map(ref));

  const metric = bullets.filter((b) => hasMetric(b.text));
  add("metricAny", "blocking", "experience", bullets.length === 0 || metric.length > 0);
  add(
    "metricThird",
    "warning",
    "experience",
    bullets.length === 0 || metric.length / bullets.length >= 1 / 3,
    { n: metric.length, total: bullets.length },
    bullets.filter((b) => !hasMetric(b.text)).map(ref),
  );
  const pron = bullets.filter((b) => hasFirstPersonPronoun(b.text));
  add("pronouns", "warning", "experience", pron.length === 0 && !hasFirstPersonPronoun(c.summary), undefined, pron.map(ref));

  // skills
  const skills = c.skills.filter((s) => s.trim());
  add("skillsMin", "blocking", "skills", skills.length >= LIMITS.skillsMin, { n: skills.length, min: LIMITS.skillsMin });
  add("skillsMax", "warning", "skills", skills.length <= LIMITS.skillsMax, { n: skills.length, max: LIMITS.skillsMax });
  const cats = input.skillCategories ?? [];
  const uncategorized = cats.filter((x) => !x || x === "other").length;
  add("skillsGrouped", "warning", "skills", skills.length < 8 || !cats.length || uncategorized / cats.length <= 0.5);

  // personal details anywhere in the written text
  const personal = contentStrings(c)
    .map((s) => personalDetail(s))
    .find(Boolean);
  add("noPersonal", "blocking", "contact", !personal, personal ? { found: personal } : undefined);

  // dates
  const nowV = now.getFullYear() * 12 + now.getMonth();
  const badDates: Ref[] = [];
  const checkList = (list: CvEntry[], section: "experience" | "military", needStart: boolean) =>
    list.forEach((e, index) => {
      const s = e.start ? dateValue(e.start) : null;
      const en = e.end ? dateValue(e.end) : null;
      if ((needStart && s === null) || (e.start && s === null) || (e.end && en === null)) badDates.push({ section, index });
      else if (s !== null && (s > nowV + 1 || (en !== null && en < s))) badDates.push({ section, index });
    });
  checkList(c.experience, "experience", true);
  checkList(c.military, "military", false);
  add("datesValid", "blocking", "experience", badDates.length === 0, undefined, badDates);
  const starts = c.experience.map((e) => dateValue(e.start)).filter((v): v is number => v !== null);
  const ordered = starts.every((v, i) => i === 0 || v <= starts[i - 1]);
  add("datesOrder", "warning", "experience", ordered);
  const precisions = new Set(
    c.experience.flatMap((e) => [e.start, e.end].filter(Boolean).map((d) => (d.includes("-") ? "m" : "y"))),
  );
  add("datesFormat", "warning", "experience", precisions.size <= 1);

  // education, juniors, layout
  add("education", "warning", "education", c.education.length + c.military.length > 0);
  const junior = (input.yearsExperience ?? 0) < 2 || c.experience.length === 0;
  add("juniorProjects", "warning", "projects", !junior || c.projects.some((p) => p.bullets.length > 0));
  add("twoColumns", "warning", "page", input.template !== "creative");

  // the hard one-page check
  const fit = input.fit;
  add("onePage", "blocking", "page", fit ? fit.pages === 1 : null, fit ? { pages: fit.pages, level: fit.level } : undefined);

  return summarize(results);
}

export function summarize(results: RuleResult[]): StandardReport {
  const blocking = results.filter((r) => r.severity === "blocking" && r.status === "fail");
  const warnings = results.filter((r) => r.severity === "warning" && r.status === "fail");
  const pending = results.filter((r) => r.status === "pending");
  const weight = (r: RuleResult) => (r.severity === "blocking" ? 3 : 1);
  const scored = results.filter((r) => r.status !== "pending");
  const total = scored.reduce((s, r) => s + weight(r), 0);
  const got = scored.filter((r) => r.status === "pass").reduce((s, r) => s + weight(r), 0);
  const contentPassed = blocking.filter((r) => r.id !== "onePage").length === 0;
  return {
    results,
    blocking,
    warnings,
    pending,
    passed: blocking.length === 0 && !pending.some((r) => r.severity === "blocking"),
    contentPassed,
    score: total ? Math.round((got / total) * 100) : 0,
  };
}

/** Per-bullet feedback for the guided editor. */
export interface BulletFeedback {
  verb: boolean;
  metric: boolean;
  length: "short" | "ok" | "long" | "tooLong";
  pronoun: boolean;
}
export function bulletFeedback(text: string): BulletFeedback {
  const n = text.trim().length;
  return {
    verb: startsWithActionVerb(text),
    metric: hasMetric(text),
    length:
      n > LIMITS.bulletMaxChars ? "tooLong" : n > LIMITS.bulletIdealMax ? "long" : n < LIMITS.bulletIdealMin ? "short" : "ok",
    pronoun: hasFirstPersonPronoun(text),
  };
}
