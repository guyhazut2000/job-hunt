/**
 * ATS / screening-filter readiness check (#115). Pure and rule-based: it inspects the CV content,
 * the text actually extracted back out of the exported PDF, and (optionally) one job description.
 * It does NOT simulate any vendor's ATS or AI ranking model — it checks the publicly documented
 * failure modes (see docs/ats-check.md) and reports each one with an explanation and a fix.
 */
import { hasMetric } from "@/lib/cv-standard/verbs";
import type { CvContent } from "@/lib/cv-templates/content";
import { resolveSkill } from "@/lib/learning/graph";
import { GLOSSARY } from "@/lib/search/glossary";
import { extractTech } from "@/lib/taxonomy";

export const ATS_RULE_IDS = [
  "textLayer",
  "contactInText",
  "headingsInText",
  "singleColumn",
  "standardHeadings",
  "fileSize",
  "fullTitles",
  "dates",
  "keywordCoverage",
  "titleMatch",
  "skillsList",
  "quantified",
  "seniority",
  "buzzwords",
] as const;
export type AtsRuleId = (typeof ATS_RULE_IDS)[number];
export type AtsGroup = "parse" | "match" | "content";
export type AtsStatus = "pass" | "warn" | "fail" | "pending" | "na";

export const ATS_GROUP: Record<AtsRuleId, AtsGroup> = {
  textLayer: "parse",
  contactInText: "parse",
  headingsInText: "parse",
  singleColumn: "parse",
  standardHeadings: "parse",
  fileSize: "parse",
  fullTitles: "parse",
  dates: "parse",
  keywordCoverage: "match",
  titleMatch: "match",
  skillsList: "match",
  quantified: "content",
  seniority: "content",
  buzzwords: "content",
};

/** Relative weight in the score. Parsing failures cost the most: unread text can't match anything. */
export const ATS_WEIGHT: Record<AtsRuleId, number> = {
  textLayer: 3,
  contactInText: 2,
  headingsInText: 1,
  singleColumn: 2,
  standardHeadings: 1,
  fileSize: 1,
  fullTitles: 1,
  dates: 1,
  keywordCoverage: 3,
  titleMatch: 1,
  skillsList: 1,
  quantified: 2,
  seniority: 1,
  buzzwords: 1,
};

/** Greenhouse's documented parsing limit for resume uploads (see docs/ats-check.md). */
export const MAX_FILE_BYTES = 2.5 * 1024 * 1024;
export const KEYWORD_PASS = 0.7;
export const KEYWORD_WARN = 0.4;
export const QUANT_PASS = 0.4;
export const QUANT_WARN = 0.2;
export const MAX_KEYWORDS = 25;

export interface AtsRule {
  id: AtsRuleId;
  group: AtsGroup;
  status: AtsStatus;
  /** Values interpolated into the explanation (counts, percentages). */
  params: Record<string, string | number>;
  /** Offending / missing items to show (capped by the UI). */
  items: string[];
}

export interface AtsJob {
  title: string;
  /** Structured tech stack from the job record (may be empty for pasted text). */
  tech: string[];
  /** Full description text. */
  text: string;
}

export interface AtsInput {
  content: CvContent;
  columns: 1 | 2;
  /** Section headings as rendered in the PDF (visible sections only). */
  headings: string[];
  /** Ids of the sections rendered in the export (omit = all). */
  sections?: string[];
  /** Headings the user renamed or created (custom sections). */
  customHeadings: string[];
  /** Text extracted from the exported PDF; null when the export could not be rendered. */
  extracted: string | null;
  pdfBytes: number | null;
  job: AtsJob | null;
  /** The user targets senior+ roles (profile seniority / desired role). */
  senior: boolean;
}

export interface KeywordMatch {
  keyword: string;
  found: boolean;
}

export interface AtsReport {
  score: number;
  rules: AtsRule[];
  keywords: KeywordMatch[];
  buzzwords: { word: string; count: number; kind: "llm" | "cliche" }[];
}

// ---------- text helpers ----------

const NBSP = /[\u00a0\u200e\u200f\u202a-\u202e]/g;
export const normText = (s: string) =>
  s
    .replace(NBSP, " ")
    .toLowerCase()
    .replace(/[״"׳'`]/g, "")
    .replace(/\s+/g, " ");

/** Word tokens (Hebrew or Latin letters/digits, 3+ chars). */
export function tokens(s: string): string[] {
  return (normText(s).match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu) ?? []).filter(
    (t) => t.length >= 3,
  );
}

const digits = (s: string) => s.replace(/\D/g, "");

/** The CV's own wording; with `sections`, only the sections actually rendered in the export. */
export function cvText(c: CvContent, sections?: readonly string[]): string {
  const on = (id: string) => !sections || sections.includes(id);
  const entries = (["experience", "projects", "education", "military", "volunteering"] as const)
    .filter(on)
    .flatMap((id) => c[id]);
  return [
    c.name,
    c.headline,
    on("summary") ? c.summary : "",
    ...(on("skills") ? c.skills : []),
    ...entries.flatMap((e) => [e.title, e.org, ...e.bullets, ...(e.tech ?? [])]),
    ...c.custom.filter((x) => on(`custom:${x.id}`)).flatMap((x) => [x.title, ...x.bullets]),
  ]
    .filter(Boolean)
    .join("\n");
}

const bulletsOf = (c: CvContent) => [...c.experience, ...c.projects].flatMap((e) => e.bullets).filter(Boolean);

// ---------- standard headings ----------

/** Headings parsers and recruiters commonly recognize, Hebrew + English (lower-cased). */
export const STANDARD_HEADINGS = [
  "summary",
  "profile",
  "professional summary",
  "about",
  "about me",
  "executive profile",
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "employment history",
  "leadership experience & achievements",
  "projects",
  "selected projects",
  "personal projects",
  "education",
  "skills",
  "technical skills",
  "tools & skills",
  "languages",
  "military service",
  "volunteering",
  "volunteer experience",
  "certifications",
  "certificates",
  "awards",
  "publications",
  "links",
  "תקציר",
  "תמצית",
  "פרופיל",
  "פרופיל מקצועי",
  "פרופיל ניהולי",
  "על עצמי",
  "קצת עליי",
  "ניסיון",
  "ניסיון תעסוקתי",
  "ניסיון מקצועי",
  "ניסיון ניהולי והישגים",
  "פרויקטים",
  "פרויקטים נבחרים",
  "השכלה",
  "כישורים",
  "מיומנויות",
  "כלים וכישורים",
  "כישורים טכניים",
  "שפות",
  "שירות צבאי",
  "צבא",
  "התנדבות",
  "הסמכות",
  "תעודות",
  "פרסים",
  "פרסומים",
  "קישורים",
];
const STD = new Set(STANDARD_HEADINGS);
export const isStandardHeading = (h: string) => STD.has(normText(h).trim());

// ---------- buzzwords ----------

/**
 * Words found over-represented in LLM-edited text (Kobak et al., 2024, arXiv:2406.07016) — used
 * only as a "sounds generic / machine-written" hint, never as a claim that a text was AI-written.
 */
export const LLM_STYLE_WORDS = [
  "delve",
  "delves",
  "delving",
  "showcasing",
  "showcase",
  "underscore",
  "underscores",
  "pivotal",
  "intricate",
  "meticulous",
  "meticulously",
  "realm",
  "seamless",
  "seamlessly",
  "transformative",
  "groundbreaking",
  "leverage",
  "leverages",
  "leveraging",
  "leveraged",
  "comprehensive",
  "crucial",
  "notably",
  "furthermore",
  "tapestry",
  "unparalleled",
  "invaluable",
  "commendable",
];
/** Generic CV clichés that carry no evidence (English + Hebrew). */
export const CLICHES = [
  "results-driven",
  "detail-oriented",
  "team player",
  "hard-working",
  "self-motivated",
  "go-getter",
  "think outside the box",
  "fast-paced environment",
  "dynamic environment",
  "proven track record",
  "passionate",
  "synergy",
  "cutting-edge",
  "best-in-class",
  "rockstar",
  "ninja",
  "guru",
  "excellent communication skills",
  "מוטיבציה גבוהה",
  "בעל מוטיבציה",
  "בעלת מוטיבציה",
  "יכולת למידה עצמית",
  "יכולת למידה גבוהה",
  "ראש גדול",
  "שחקן צוות",
  "שחקנית צוות",
  "יחסי אנוש מעולים",
  "יחסי אנוש טובים",
  "חשיבה מחוץ לקופסה",
  "סביבה דינמית",
  "יכולת עבודה בצוות",
  "יכולת עבודה תחת לחץ",
  "פורץ דרך",
  "חדשני",
  "חדשנית",
  "תשוקה",
  "אחראי ורציני",
  "אחראית ורצינית",
];

function countPhrase(text: string, phrase: string): number {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[- ]/g, "[- ]");
  // Hebrew attaches one-letter prefixes (ו/ה/ב/ל/מ/ש/כ): "ושחקן צוות" still counts.
  const prefix = /^[\u0590-\u05ff]/.test(phrase) ? "[והבלמשכ]{0,2}" : "";
  const re = new RegExp(`(^|[^\\p{L}])${prefix}${esc}(?=$|[^\\p{L}])`, "giu");
  return [...text.matchAll(re)].length;
}

export function findBuzzwords(text: string): AtsReport["buzzwords"] {
  const t = normText(text);
  const out: AtsReport["buzzwords"] = [];
  for (const w of LLM_STYLE_WORDS) {
    const n = countPhrase(t, w);
    if (n) out.push({ word: w, count: n, kind: "llm" });
  }
  for (const w of CLICHES) {
    const n = countPhrase(t, w);
    if (n) out.push({ word: w, count: n, kind: "cliche" });
  }
  return out.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

// ---------- keywords ----------

/** Canonical keywords a job asks for: its tech stack plus tech mentioned in the description. */
export function jobKeywords(job: AtsJob): string[] {
  const seen = new Map<string, string>();
  for (const k of [...job.tech, ...extractTech(`${job.title}\n${job.text}`)]) {
    const key = k.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, k.trim());
  }
  return [...seen.values()].slice(0, MAX_KEYWORDS);
}

/** All spellings that count as the same keyword (skill-graph aliases + bilingual glossary). */
export function synonyms(keyword: string): string[] {
  const k = keyword.toLowerCase();
  const out = new Set([k]);
  const node = resolveSkill(keyword);
  if (node) {
    out.add(node.label.toLowerCase());
    for (const a of node.aliases ?? []) out.add(a.toLowerCase());
  }
  for (const g of GLOSSARY) {
    const all = [...g.he, ...g.en].map((x) => x.toLowerCase());
    if (all.includes(k)) all.forEach((x) => out.add(x));
  }
  return [...out].filter((x) => x.length >= 1);
}

export function matchKeywords(keywords: string[], text: string): KeywordMatch[] {
  const t = ` ${normText(text)} `;
  const tech = new Set(extractTech(text).map((x) => x.toLowerCase()));
  return keywords.map((keyword) => {
    const found =
      tech.has(keyword.toLowerCase()) ||
      synonyms(keyword).some((s) => {
        const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^\\p{L}\\p{N}+#])${esc}(?=$|[^\\p{L}\\p{N}+#])`, "iu").test(t);
      });
    return { keyword, found };
  });
}

// ---------- seniority ----------

const OWNERSHIP_EN =
  /\b(led|lead|owned|own|architected|designed|mentored|mentoring|drove|initiated|scaled|migrated|defined|established|spearheaded|coordinated|introduced|championed|managed|hired|reviewed)\b/i;
const OWNERSHIP_HE =
  /(הובלתי|הובלה|הובלת|הוביל|הובילה|אחראי על|אחראית על|אחריות על|תכננתי|אפיינתי|ארכיטקטורה|חנכתי|חניכת|ייזמתי|יזמתי|הגדרתי|ניהלתי|גייסתי|הטמעתי|קבעתי)/;
const SCOPE =
  /\b(team|teams|cross-team|cross-functional|org|company-wide|production|customers|users|stakeholders|roadmap)\b|(צוות|צוותים|רוחבי|לקוחות|משתמשים|פרודקשן|בייצור|בעלי עניין|מפת דרכים)/i;

export const ownershipBullet = (b: string) => OWNERSHIP_EN.test(b) || OWNERSHIP_HE.test(b);
export const scopeBullet = (b: string) => SCOPE.test(b);

// ---------- titles / dates ----------

const ABBREV_TITLE = /(^|[\s(/,-])(sr|jr|snr|jnr|mgr|eng|engr|dev|assoc|exec|mngr)\.?(?=$|[\s)/,-])/i;
export const abbreviatedTitle = (t: string) => ABBREV_TITLE.test(t);
const SENIORITY_WORDS =
  /\b(senior|sr|junior|jr|lead|principal|staff|head|of|the|and|mid|level|ii|iii|i|-)\b|בכיר|בכירה|ג'וניור|ראש צוות/gi;

export function titleCore(title: string): string[] {
  return tokens(title.replace(SENIORITY_WORDS, " ").replace(/[()\[\]|·,/]/g, " "));
}

// ---------- evaluate ----------

const rule = (id: AtsRuleId, status: AtsStatus, params: AtsRule["params"] = {}, items: string[] = []): AtsRule => ({
  id,
  group: ATS_GROUP[id],
  status,
  params,
  items,
});

export function evaluateAts(input: AtsInput): AtsReport {
  const c = input.content;
  const source = cvText(c);
  const rendered = cvText(c, input.sections);
  const ext = input.extracted;
  const extNorm = ext == null ? null : normText(ext);
  const rules: AtsRule[] = [];

  // textLayer: how much of the CV's own wording survives a text extraction of the exported PDF.
  if (extNorm == null) rules.push(rule("textLayer", "pending"));
  else {
    const want = [...new Set(tokens(rendered))];
    const have = new Set(tokens(extNorm));
    const missing = want.filter((w) => !have.has(w));
    const pct = want.length ? Math.round(((want.length - missing.length) / want.length) * 100) : 0;
    rules.push(rule("textLayer", pct >= 95 ? "pass" : pct >= 80 ? "warn" : "fail", { pct }, missing.slice(0, 12)));
  }

  // contactInText: email + phone readable in the body text.
  {
    const email = c.contact.find((x) => x.kind === "email")?.value ?? "";
    const phone = c.contact.find((x) => x.kind === "phone")?.value ?? "";
    if (!email && !phone) rules.push(rule("contactInText", "fail", {}, ["email", "phone"]));
    else if (extNorm == null) rules.push(rule("contactInText", "pending"));
    else {
      const missing: string[] = [];
      if (!email) missing.push("email");
      else if (!extNorm.includes(email.toLowerCase())) missing.push(email);
      if (phone && digits(phone).length >= 7 && !digits(ext ?? "").includes(digits(phone))) missing.push(phone);
      rules.push(
        rule(
          "contactInText",
          missing.length ? (email && missing.includes(email) ? "fail" : "warn") : "pass",
          {},
          missing,
        ),
      );
    }
  }

  // headingsInText: every rendered section heading is present as text.
  if (extNorm == null) rules.push(rule("headingsInText", "pending"));
  else {
    const missing = input.headings.filter((h) => h && !extNorm.includes(normText(h).trim()));
    rules.push(rule("headingsInText", missing.length ? "warn" : "pass", { n: input.headings.length }, missing));
  }

  rules.push(rule("singleColumn", input.columns === 1 ? "pass" : "fail"));

  {
    const odd = [...new Set(input.customHeadings.filter((h) => h.trim() && !isStandardHeading(h)))];
    rules.push(rule("standardHeadings", odd.length ? "warn" : "pass", {}, odd));
  }

  if (input.pdfBytes == null) rules.push(rule("fileSize", "pending"));
  else {
    const kb = Math.round(input.pdfBytes / 1024);
    rules.push(rule("fileSize", input.pdfBytes <= MAX_FILE_BYTES ? "pass" : "fail", { kb }));
  }

  {
    const bad = c.experience.map((e) => e.title).filter((t) => t && abbreviatedTitle(t));
    rules.push(rule("fullTitles", bad.length ? "warn" : "pass", {}, bad));
  }

  {
    const entries = [...c.experience, ...c.education];
    const bad = entries.filter((e) => !/\d{4}/.test(e.start ?? "")).map((e) => e.title || e.org);
    rules.push(rule("dates", entries.length === 0 ? "na" : bad.length ? "warn" : "pass", {}, bad));
  }

  // keyword coverage against one job.
  let keywords: KeywordMatch[] = [];
  if (!input.job) {
    rules.push(rule("keywordCoverage", "na"));
    rules.push(rule("titleMatch", "na"));
  } else {
    const kws = jobKeywords(input.job);
    keywords = matchKeywords(kws, source);
    const found = keywords.filter((k) => k.found).length;
    const pct = kws.length ? Math.round((found / kws.length) * 100) : 0;
    rules.push(
      kws.length === 0
        ? rule("keywordCoverage", "na")
        : rule(
            "keywordCoverage",
            pct >= KEYWORD_PASS * 100 ? "pass" : pct >= KEYWORD_WARN * 100 ? "warn" : "fail",
            { pct, found, total: kws.length },
            keywords.filter((k) => !k.found).map((k) => k.keyword),
          ),
    );
    const core = titleCore(input.job.title);
    const where = new Set(tokens([c.headline, c.summary, ...c.experience.map((e) => e.title)].join(" ")));
    const hit = core.filter((w) => where.has(w));
    rules.push(
      core.length === 0
        ? rule("titleMatch", "na")
        : rule("titleMatch", hit.length === core.length ? "pass" : hit.length ? "warn" : "fail", {
            title: input.job.title,
          }),
    );
  }

  rules.push(
    rule("skillsList", c.skills.length >= 5 ? "pass" : c.skills.length ? "warn" : "fail", { n: c.skills.length }),
  );

  const bullets = bulletsOf(c);
  {
    const n = bullets.filter(hasMetric).length;
    const share = bullets.length ? n / bullets.length : 0;
    rules.push(
      bullets.length === 0
        ? rule("quantified", "fail", { n: 0, total: 0, pct: 0 })
        : rule("quantified", share >= QUANT_PASS ? "pass" : share >= QUANT_WARN ? "warn" : "fail", {
            n,
            total: bullets.length,
            pct: Math.round(share * 100),
          }),
    );
  }

  {
    const expBullets = c.experience.flatMap((e) => e.bullets);
    const own = expBullets.filter(ownershipBullet).length;
    const scope = expBullets.filter(scopeBullet).length;
    const status: AtsStatus = input.senior
      ? own >= 3 && scope >= 1
        ? "pass"
        : own >= 1
          ? "warn"
          : "fail"
      : own >= 1
        ? "pass"
        : "warn";
    rules.push(rule("seniority", expBullets.length ? status : "na", { own, scope, total: expBullets.length }));
  }

  const buzz = findBuzzwords(source);
  {
    const total = buzz.reduce((s, b) => s + b.count, 0);
    rules.push(
      rule(
        "buzzwords",
        total === 0 ? "pass" : total <= 3 ? "warn" : "fail",
        { n: total },
        buzz.map((b) => b.word),
      ),
    );
  }

  return { score: atsScore(rules), rules, keywords, buzzwords: buzz };
}

/** Weighted share of passed rules (warn = half). Pending / not-applicable rules are excluded. */
export function atsScore(rules: AtsRule[]): number {
  let total = 0;
  let got = 0;
  for (const r of rules) {
    if (r.status === "pending" || r.status === "na") continue;
    const w = ATS_WEIGHT[r.id];
    total += w;
    got += r.status === "pass" ? w : r.status === "warn" ? w / 2 : 0;
  }
  return total ? Math.round((got / total) * 100) : 0;
}
