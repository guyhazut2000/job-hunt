/**
 * LinkedIn profile workspace (#116) — pure, offline rules over text the user pasted from their own profile.
 * Nothing is fetched from LinkedIn and nothing is posted: the page only checks the pasted text, compares it
 * with the CV (the profile is the single source of truth) and builds copy-only suggestions from the CV's own
 * words. The character limits are the commonly reported editor limits (LinkedIn does not publish them in its
 * help pages and may change them), so the UI marks them as approximate.
 */
import { z } from "zod";
import type { LLMMessage } from "@/lib/ai/types";
import { CLICHES, LLM_STYLE_WORDS, findBuzzwords, normText, ownershipBullet } from "@/lib/ats/check";
import { hasMetric } from "@/lib/cv-standard/verbs";
import type { CvContent } from "@/lib/cv-templates/content";
import { introducesFacts } from "@/lib/cv-tailor/tailor";
import { extractTech } from "@/lib/taxonomy";

export type Lang = "he" | "en";

/** Commonly reported limits (approximate — check LinkedIn's own counter while editing). */
export const HEADLINE_MAX = 220;
export const ABOUT_MAX = 2600;
/** Roughly what shows before "see more" — an approximation, varies by device. */
export const ABOUT_HOOK = 300;
export const ABOUT_MIN = 400;
export const QUANT_PASS = 0.4;
export const MAX_FEATURED = 6;
export const DEFAULT_RECS_GOAL = 3;

export const LINKEDIN_SOURCES = [
  {
    id: "helpProfile",
    label: "LinkedIn Help: Create a good LinkedIn profile",
    url: "https://www.linkedin.com/help/linkedin/answer/a554351",
  },
  {
    id: "helpAbout",
    label: "LinkedIn Help: Edit the About section",
    url: "https://www.linkedin.com/help/linkedin/answer/a553140",
  },
] as const;

const urlish = z.string().trim().max(300);
export const linkedinInputSchema = z.object({
  headline: z.string().max(600).catch(""),
  about: z.string().max(6000).catch(""),
  experience: z.string().max(12000).catch(""),
  featured: z.array(urlish).max(MAX_FEATURED).catch([]),
  skills: z.string().max(3000).catch(""),
  recsHave: z.coerce.number().int().min(0).max(500).catch(0),
  recsGoal: z.coerce.number().int().min(0).max(50).catch(DEFAULT_RECS_GOAL),
});
export type LinkedinInput = z.infer<typeof linkedinInputSchema>;
export const EMPTY_LINKEDIN: LinkedinInput = linkedinInputSchema.parse({});

export type CheckStatus = "pass" | "warn" | "fail" | "na";
export const CHECK_IDS = [
  "headlineLength",
  "headlineRole",
  "headlineSkills",
  "headlineCliche",
  "aboutLength",
  "aboutHook",
  "aboutNumbers",
  "aboutRole",
  "aboutCliche",
  "expQuantified",
  "expOwnership",
  "featured",
  "recommendations",
  "cvCompanies",
  "cvTitles",
  "cvSkills",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];
export type CheckGroup = "headline" | "about" | "experience" | "featured" | "recommendations" | "consistency";
export const CHECK_GROUP: Record<CheckId, CheckGroup> = {
  headlineLength: "headline",
  headlineRole: "headline",
  headlineSkills: "headline",
  headlineCliche: "headline",
  aboutLength: "about",
  aboutHook: "about",
  aboutNumbers: "about",
  aboutRole: "about",
  aboutCliche: "about",
  expQuantified: "experience",
  expOwnership: "experience",
  featured: "featured",
  recommendations: "recommendations",
  cvCompanies: "consistency",
  cvTitles: "consistency",
  cvSkills: "consistency",
};

export interface Check {
  id: CheckId;
  status: CheckStatus;
  /** Values for the message template. */
  vars: Record<string, string | number>;
}

export interface LinkedinContext {
  cv: CvContent;
  targetRoles: string[];
}

export interface LinkedinReport {
  checks: Check[];
  passed: number;
  total: number;
  /** CV items missing from the pasted profile. */
  missing: { companies: string[]; titles: string[]; skills: string[] };
  buzzwords: string[];
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•–·]\s*/, "").trim())
    .filter((l) => l.length >= 15);
const contains = (hay: string, needle: string) => {
  const n = normText(needle).trim();
  return !!n && normText(hay).includes(n);
};
export const splitSkills = (s: string) =>
  [
    ...new Set(
      s
        .split(/[\n,;|·•]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && x.length <= 60),
    ),
  ].slice(0, 100);

/** Words of the target role worth matching ("Senior Backend Engineer" → backend, engineer, senior). */
function roleWords(role: string): string[] {
  return normText(role)
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((w) => w.length >= 3);
}
function mentionsRole(text: string, roles: string[]): boolean {
  const t = normText(text);
  return roles.some(
    (r) =>
      contains(t, r) ||
      (roleWords(r).length > 0 && roleWords(r).filter((w) => t.includes(w)).length >= Math.min(2, roleWords(r).length)),
  );
}

export function topSkills(cv: CvContent, n = 5): string[] {
  return cv.skills.slice(0, n);
}

export function evaluateLinkedin(raw: LinkedinInput, ctx: LinkedinContext): LinkedinReport {
  const input = linkedinInputSchema.parse(raw);
  const headline = clean(input.headline);
  const about = input.about.trim();
  const roles = ctx.targetRoles.filter(Boolean);
  const skills = topSkills(ctx.cv);
  const checks: Check[] = [];
  const add = (id: CheckId, status: CheckStatus, vars: Check["vars"] = {}) => checks.push({ id, status, vars });

  // Headline
  if (!headline) {
    add("headlineLength", "fail", { n: 0, max: HEADLINE_MAX });
    add("headlineRole", "na");
    add("headlineSkills", "na");
    add("headlineCliche", "na");
  } else {
    add("headlineLength", headline.length <= HEADLINE_MAX ? (headline.length < 30 ? "warn" : "pass") : "fail", {
      n: headline.length,
      max: HEADLINE_MAX,
    });
    add("headlineRole", !roles.length ? "na" : mentionsRole(headline, roles) ? "pass" : "warn", {
      role: roles[0] ?? "",
    });
    const hit = skills.filter((s) => contains(headline, s));
    add("headlineSkills", !skills.length ? "na" : hit.length >= 2 ? "pass" : hit.length ? "warn" : "fail", {
      n: hit.length,
      skills: skills.slice(0, 3).join(", "),
    });
    const bw = findBuzzwords(headline);
    add("headlineCliche", bw.length ? "warn" : "pass", { words: bw.map((b) => b.word).join(", ") });
  }

  // About
  if (!about) {
    add("aboutLength", "fail", { n: 0, max: ABOUT_MAX, min: ABOUT_MIN });
    for (const id of ["aboutHook", "aboutNumbers", "aboutRole", "aboutCliche"] as const) add(id, "na");
  } else {
    add("aboutLength", about.length > ABOUT_MAX ? "fail" : about.length < ABOUT_MIN ? "warn" : "pass", {
      n: about.length,
      max: ABOUT_MAX,
      min: ABOUT_MIN,
    });
    const hook = about.slice(0, ABOUT_HOOK);
    const hookOk =
      (roles.length && mentionsRole(hook, roles)) || hasMetric(hook) || skills.some((s) => contains(hook, s));
    add("aboutHook", hookOk ? "pass" : "warn", { n: ABOUT_HOOK });
    add("aboutNumbers", hasMetric(about) ? "pass" : "warn");
    add("aboutRole", !roles.length ? "na" : mentionsRole(about, roles) ? "pass" : "warn", { role: roles[0] ?? "" });
    const bw = findBuzzwords(about);
    add("aboutCliche", bw.length ? "warn" : "pass", { words: bw.map((b) => b.word).join(", ") });
  }

  // Experience (pasted)
  const bullets = lines(input.experience);
  if (!bullets.length) {
    add("expQuantified", "na");
    add("expOwnership", "na");
  } else {
    const q = bullets.filter(hasMetric).length;
    const share = q / bullets.length;
    add("expQuantified", share >= QUANT_PASS ? "pass" : share >= QUANT_PASS / 2 ? "warn" : "fail", {
      n: q,
      total: bullets.length,
      pct: Math.round(share * 100),
    });
    const o = bullets.filter(ownershipBullet).length;
    add("expOwnership", o >= 2 ? "pass" : o ? "warn" : "fail", { n: o, total: bullets.length });
  }

  // Featured
  const featured = input.featured.map((f) => f.trim()).filter(Boolean);
  const validLinks = featured.filter((f) => /^https?:\/\/\S+\.\S+/.test(f));
  add("featured", validLinks.length >= 2 ? "pass" : validLinks.length ? "warn" : "fail", { n: validLinks.length });

  // Recommendations — a personal goal the user sets, not a LinkedIn rule.
  const goal = input.recsGoal;
  add("recommendations", goal === 0 ? "na" : input.recsHave >= goal ? "pass" : input.recsHave > 0 ? "warn" : "fail", {
    have: input.recsHave,
    goal,
  });

  // Consistency with the CV (only when there is pasted experience / skills to compare).
  const pastedAll = `${headline}\n${about}\n${input.experience}`;
  const cvCompanies = [...new Set(ctx.cv.experience.map((e) => clean(e.org)).filter(Boolean))].slice(0, 8);
  const cvTitles = [...new Set(ctx.cv.experience.map((e) => clean(e.title)).filter(Boolean))].slice(0, 8);
  const missingCompanies = input.experience.trim() ? cvCompanies.filter((c) => !contains(pastedAll, c)) : [];
  const missingTitles = input.experience.trim() ? cvTitles.filter((t) => !contains(pastedAll, t)) : [];
  const liSkills = splitSkills(input.skills);
  const liSkillText = `${liSkills.join("\n")}\n${pastedAll}`;
  const cvSkills = ctx.cv.skills.slice(0, 15);
  const missingSkills = input.skills.trim() ? cvSkills.filter((s) => !contains(liSkillText, s)) : [];
  add(
    "cvCompanies",
    !input.experience.trim() || !cvCompanies.length ? "na" : missingCompanies.length ? "warn" : "pass",
    { n: missingCompanies.length, total: cvCompanies.length },
  );
  add("cvTitles", !input.experience.trim() || !cvTitles.length ? "na" : missingTitles.length ? "warn" : "pass", {
    n: missingTitles.length,
    total: cvTitles.length,
  });
  add(
    "cvSkills",
    !input.skills.trim() || !cvSkills.length ? "na" : missingSkills.length > cvSkills.length / 3 ? "warn" : "pass",
    {
      n: missingSkills.length,
      total: cvSkills.length,
    },
  );

  const scored = checks.filter((c) => c.status !== "na");
  const buzzwords = [...new Set(findBuzzwords(`${headline}\n${about}`).map((b) => b.word))];
  return {
    checks,
    passed: scored.filter((c) => c.status === "pass").length,
    total: scored.length,
    missing: { companies: missingCompanies, titles: missingTitles, skills: missingSkills },
    buzzwords,
  };
}

// ---------- rule-based suggestions (only the CV's own words) ----------

/** "Senior Backend Engineer | Node.js · PostgreSQL · AWS | <current title> at <company>" within the limit. */
export function suggestHeadline(ctx: LinkedinContext, lang: Lang): string {
  const role = ctx.targetRoles[0] || ctx.cv.headline || ctx.cv.experience[0]?.title || "";
  const parts: string[] = [];
  if (role) parts.push(role);
  const sk = topSkills(ctx.cv, 4);
  if (sk.length) parts.push(sk.join(" · "));
  const cur = ctx.cv.experience[0];
  if (cur?.title && cur.org && normText(cur.title) !== normText(role))
    parts.push(lang === "he" ? `${cur.title} ב-${cur.org}` : `${cur.title} at ${cur.org}`);
  let out = parts.join(" | ");
  while (out.length > HEADLINE_MAX && parts.length > 1) {
    parts.pop();
    out = parts.join(" | ");
  }
  return out.slice(0, HEADLINE_MAX);
}

/** The strongest CV bullets: quantified first, then ownership. */
export function bestBullets(cv: CvContent, n = 3): string[] {
  const all = [...cv.experience, ...cv.projects].flatMap((e) => e.bullets.map(clean)).filter(Boolean);
  const score = (b: string) => (hasMetric(b) ? 2 : 0) + (ownershipBullet(b) ? 1 : 0);
  return [...all].sort((a, b) => score(b) - score(a)).slice(0, n);
}

export function suggestAbout(ctx: LinkedinContext, lang: Lang): string {
  const he = lang === "he";
  const cv = ctx.cv;
  const role = ctx.targetRoles[0] || cv.headline || "";
  const out: string[] = [];
  const summary = clean(cv.summary);
  if (summary) out.push(summary);
  else if (role) out.push(he ? `${role}.` : `${role}.`);
  const best = bestBullets(cv);
  if (best.length) {
    out.push("", he ? "כמה דברים שעשיתי:" : "A few things I've done:");
    out.push(...best.map((b) => `• ${b}`));
  }
  const sk = cv.skills.slice(0, 10);
  if (sk.length) out.push("", `${he ? "טכנולוגיות" : "Tech"}: ${sk.join(" · ")}`);
  if (role) out.push("", he ? `מחפש/ת את התפקיד הבא כ-${role}.` : `Looking for my next ${role} role.`);
  return out.join("\n").slice(0, ABOUT_MAX);
}

export function recommendationRequestDraft(
  p: { name?: string | null; myName?: string | null; project?: string | null },
  lang: Lang,
): string {
  const he = lang === "he";
  const who = clean(p.name ?? "") || (he ? "[שם]" : "[name]");
  const me = clean(p.myName ?? "") || (he ? "[השם שלך]" : "[your name]");
  const project = clean(p.project ?? "") || (he ? "[הפרויקט שעבדנו עליו יחד]" : "[the project we worked on together]");
  if (he)
    return `היי ${who},
אני מעדכן/ת את פרופיל ה-LinkedIn שלי לקראת חיפוש עבודה, ויהיה לי כבוד אם תכתוב/י לי המלצה קצרה.
אם זה עוזר, אפשר להתמקד ב-${project} – מה עשיתי שם ואיך זה היה לעבוד איתי.
ואם זה לא מסתדר עכשיו – לגמרי בסדר, תודה בכל מקרה!
${me}`;
  return `Hi ${who},
I'm updating my LinkedIn profile ahead of a job search, and I'd be grateful if you could write me a short recommendation.
If it helps, you could focus on ${project} — what I did there and what it was like working together.
And if the timing doesn't work, totally fine — thank you either way!
${me}`;
}

// ---------- optional AI polish, guarded against new facts ----------

export function cvCorpus(cv: CvContent): string {
  return [
    cv.headline,
    cv.summary,
    ...cv.skills,
    ...[...cv.experience, ...cv.projects].flatMap((e) => [
      e.title,
      e.org,
      e.start,
      e.end,
      ...e.bullets,
      ...(e.tech ?? []),
    ]),
  ].join("\n");
}

export function linkedinPrompt(ctx: LinkedinContext, input: LinkedinInput, lang: Lang): LLMMessage[] {
  const language = lang === "he" ? "Hebrew (keep technical terms and tool names in English)" : "English";
  return [
    {
      role: "system",
      content:
        "You help a software engineer improve their LinkedIn headline and About section. Use ONLY facts from the CV and " +
        "the user's pasted text. Never add numbers, metrics, tools, companies, titles or achievements that are not there. " +
        `Headline: at most ${HEADLINE_MAX} characters, the target role plus the main skills, no clichés. ` +
        `About: at most 1500 characters, a strong first two lines, first person, plain text, no hashtags, no emojis. ` +
        'Answer as JSON: {"headline": string, "about": string}.',
    },
    {
      role: "user",
      content:
        `Write in ${language}.\nTarget role: ${ctx.targetRoles[0] || "(not set)"}\n\nCV:\n${cvCorpus(ctx.cv).slice(0, 5000)}\n\n` +
        `Current headline: ${clean(input.headline) || "(empty)"}\nCurrent About:\n${input.about.trim().slice(0, 3000) || "(empty)"}`,
    },
  ];
}

const NUM_RE = /\d+(?:[.,]\d+)?/g;
const BANNED = [...CLICHES, ...LLM_STYLE_WORDS];

/** Accept the AI's headline/about only within limits and when they introduce no new tech or numbers. */
export function validateLinkedinAi(
  raw: string,
  ctx: LinkedinContext,
  input: LinkedinInput,
): { headline: string; about: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const r = z.object({ headline: z.string(), about: z.string() }).safeParse(parsed);
  if (!r.success) return null;
  const headline = clean(r.data.headline);
  const about = r.data.about.replace(/[*#`>]/g, "").trim();
  if (!headline || headline.length > HEADLINE_MAX || about.length < 80 || about.length > ABOUT_MAX) return null;
  const corpus = `${cvCorpus(ctx.cv)}\n${input.headline}\n${input.about}\n${input.experience}\n${ctx.targetRoles.join("\n")}`;
  const allowedTech = new Set(extractTech(corpus));
  const allowedNums = new Set((corpus.match(NUM_RE) ?? []).map((n) => n.replace(",", ".")));
  if (introducesFacts(`${headline}\n${about}`, allowedTech, allowedNums)) return null;
  const t = normText(`${headline}\n${about}`);
  if (BANNED.some((w) => t.includes(normText(w)))) return null;
  return { headline, about };
}
