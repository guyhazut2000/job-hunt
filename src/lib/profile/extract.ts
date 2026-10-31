import type { Seniority } from "@prisma/client";
import { z } from "zod";
import type { LLMProvider } from "../ai/types";
import { extractTech, inferRoleCategory, inferSeniority } from "../taxonomy";
import {
  type EducationItem,
  type EducationKind,
  type ExperienceItem,
  type LanguageItem,
  type Professional,
  type ProjectItem,
  type VolunteerItem,
  type SkillItem,
  categorizeSkill,
  professionalSchema,
  spanYears,
} from "./schema";
import { inferSeniorityFromYears, totalExperienceYears } from "./score";

export interface ExtractedProfile extends Professional {
  targetRoles: string[];
  targetSeniorities: Seniority[];
  source: "heuristic" | "llm";
}

type Section =
  "summary" | "experience" | "education" | "skills" | "languages" | "military" | "projects" | "volunteering" | "other";

const HEADINGS: [Section, RegExp][] = [
  ["summary", /^(summary|profile|about( me)?|professional summary|objective|תקציר|פרופיל|על עצמי|אודות)$/i],
  ["experience", /^(work |professional )?experience$|^employment( history)?$|^ניסיון( תעסוקתי| מקצועי)?$/i],
  [
    "education",
    /^(education|academic background|courses|certifications|education (and|&) courses|השכלה|השכלה וקורסים|קורסים)$/i,
  ],
  [
    "skills",
    /^(technical )?skills$|^(technologies|tech stack|core skills|כישורים|מיומנויות|טכנולוגיות|כישורים טכניים)$/i,
  ],
  ["languages", /^(languages|שפות)$/i],
  ["military", /^(military( service)?|idf|army service|שירות צבאי)$/i],
  ["projects", /^((personal |side |selected |key )?projects|פרויקטים( אישיים| נבחרים)?)$/i],
  ["volunteering", /^(volunteering|volunteer (work|experience)|community( work)?|התנדבות|פעילות התנדבותית)$/i],
];

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const PRESENT = /^(present|current|now|today|היום|כיום|עד היום|הווה)$/i;
const DATE = String.raw`(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[/.]\d{4}|\d{4})`;
const RANGE = new RegExp(
  String.raw`(${DATE})\s*(?:-|–|—|to|עד)\s*(${DATE}|present|current|now|today|היום|כיום|עד היום)`,
  "i",
);

function toYm(token: string): string | undefined {
  const t = token.trim().toLowerCase();
  if (PRESENT.test(t)) return undefined;
  let m = t.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, 3)]) return `${m[2]}-${String(MONTHS[m[1].slice(0, 3)]).padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})$/);
  return m ? m[1] : undefined;
}

const clean = (s: string) =>
  s
    .replace(/[\s|•·,–—-]+$/g, "")
    .replace(/^[\s|•·,–—-]+/g, "")
    .trim();

/** "Senior Engineer at Acme", "Acme | Senior Engineer", "Senior Engineer, Acme" → {title, company}. */
function splitRoleLine(line: string): { title: string; company: string } {
  const at = line.match(/^(.+?)\s+(?:at|@|ב-)\s+(.+)$/i);
  if (at) return { title: clean(at[1]), company: clean(at[2]) };
  const parts = line
    .split(/\s+[|–—-]\s+|\s*,\s+/)
    .map(clean)
    .filter(Boolean);
  if (parts.length >= 2) {
    const roleish =
      /engineer|developer|manager|lead|designer|analyst|scientist|architect|intern|student|מפתח|מהנדס|מנהל|ראש צוות|מעצב|אנליסט/i;
    return roleish.test(parts[0]) ? { title: parts[0], company: parts[1] } : { title: parts[1], company: parts[0] };
  }
  return { title: clean(line), company: "" };
}

function sectionize(lines: string[]): { section: Section; lines: string[] }[] {
  const out: { section: Section; lines: string[] }[] = [{ section: "other", lines: [] }];
  for (const raw of lines) {
    const l = raw.trim().replace(/:$/, "");
    const hit = l.length < 40 ? HEADINGS.find(([, re]) => re.test(l)) : undefined;
    if (hit) out.push({ section: hit[0], lines: [] });
    else if (raw.trim()) out.at(-1)!.lines.push(raw.trim());
  }
  return out;
}

function parseExperience(lines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let cur: (ExperienceItem & { _pre?: string }) | undefined;
  let pending: string | undefined; // a role line that appears just before its date line
  for (const line of lines) {
    const r = line.match(RANGE);
    if (r) {
      const rest = clean(line.replace(r[0], "").replace(/[()]/g, ""));
      const head = rest || pending || "";
      const { title, company } = splitRoleLine(head);
      cur = {
        title: title || "—",
        company: company || "—",
        start: toYm(r[1]),
        end: toYm(r[2]),
        description: "",
        tech: [],
      };
      items.push(cur);
      pending = undefined;
    } else if (cur && /^[•*\-–]/.test(line)) {
      cur.description += (cur.description ? "\n" : "") + line.replace(/^[•*\-–]\s*/, "");
    } else if (cur && cur.company === "—" && !cur.description) {
      cur.company = clean(line);
    } else {
      if (cur && cur.description) cur.description += "\n" + line;
      pending = line;
    }
  }
  return items.map((e) => ({
    ...e,
    description: e.description.slice(0, 2000),
    tech: extractTech(`${e.title} ${e.description}`),
  }));
}

/** Projects: a short line starts a project ("Name – what it is"); bullets / longer lines describe it. */
function parseProjects(lines: string[]): ProjectItem[] {
  const out: ProjectItem[] = [];
  for (const line of lines) {
    const bullet = /^[•*\-–]/.test(line);
    const text = line.replace(/^[•*\-–]\s*/, "").trim();
    if (!text) continue;
    const url = text.match(/https?:\/\/[^\s)>\]]+|(?:www\.)?github\.com\/[^\s)>\]]+/i)?.[0];
    const startsNew = !out.length || (!bullet && text.length <= 90);
    if (startsNew) {
      const [name, ...rest] = text.split(/\s+[|–—-]\s+|:\s+/);
      out.push({
        name: clean(name.replace(url ?? "", "")).slice(0, 120) || "—",
        role: "",
        url: url ? (url.startsWith("http") ? url : `https://${url}`).replace(/[.,;]+$/, "") : "",
        start: undefined,
        end: undefined,
        description: rest.join(" – ").trim(),
        tech: [],
      });
    } else {
      const cur = out.at(-1)!;
      cur.description = (cur.description ? `${cur.description}\n` : "") + text;
    }
  }
  return out.slice(0, 20).map((p) => ({
    ...p,
    description: p.description.slice(0, 1500),
    tech: extractTech(`${p.name} ${p.description}`),
  }));
}

/** Volunteering: "Role, Organization (2019–2021)" or "Organization – Role" lines. */
function parseVolunteering(lines: string[]): VolunteerItem[] {
  const out: VolunteerItem[] = [];
  for (const line of lines) {
    const bullet = /^[•*\-–]/.test(line);
    const text = line.replace(/^[•*\-–]\s*/, "").trim();
    if (!text) continue;
    if (bullet && out.length) {
      const cur = out.at(-1)!;
      cur.description = (cur.description ? `${cur.description}\n` : "") + text;
      continue;
    }
    const r = text.match(RANGE);
    const body = clean(text.replace(r?.[0] ?? "", "").replace(/[()]/g, ""));
    if (!body) continue;
    let { title, company } = splitRoleLine(body);
    const VROLE = /mentor|volunteer|coordinator|guide|instructor|tutor|board member|מתנדב|מדריכ|חונכ|רכז|מנטור/i;
    if (company && VROLE.test(company) && !VROLE.test(title)) [title, company] = [company, title];
    out.push({
      organization: (company || title).slice(0, 120),
      role: company ? title.slice(0, 120) : "",
      start: r ? toYm(r[1]) : undefined,
      end: r ? toYm(r[2]) : undefined,
      description: "",
    });
  }
  return out.slice(0, 15);
}

/** Israeli mobile / landline or an international number found in the CV text. */
export function findPhone(text: string): string {
  const m =
    text.match(/(?:\+972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/) ??
    text.match(/(?:\+972[-\s]?|0)[23489][-\s]?\d{3}[-\s]?\d{4}/) ??
    text.match(/\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,3}/);
  return m ? m[0].trim().slice(0, 30) : "";
}

const MILITARY = /\b(8200|mamram|talpiot|idf|c4i|lotem|matzov|unit 81)\b|ממר"?ם|צה"ל|תלפיות|יחידה|מודיעין|חיל/i;

function educationKind(line: string): EducationKind {
  if (MILITARY.test(line)) return "MILITARY";
  if (/bootcamp|בוטקמפ/i.test(line)) return "BOOTCAMP";
  if (/certif|certified|הסמכה/i.test(line)) return "CERTIFICATION";
  if (
    /\b(b\.?sc|m\.?sc|b\.?a|m\.?a|ph\.?d|mba|bachelor|master|degree|university|technion|college)\b|תואר|אוניברסיט|טכניון|מכללה/i.test(
      line,
    )
  )
    return "DEGREE";
  return "COURSE";
}

function parseEducation(lines: string[], forceKind?: EducationKind): EducationItem[] {
  const out: EducationItem[] = [];
  for (const line of lines) {
    if (line.length < 4) continue;
    const r = line.match(RANGE);
    const year = line.match(/\b(19|20)\d{2}\b/g);
    const body = clean(
      line
        .replace(r?.[0] ?? "", "")
        .replace(/\b(19|20)\d{2}\b/g, "")
        .replace(/[()]/g, ""),
    );
    if (!body) continue;
    const { title, company } = splitRoleLine(body);
    out.push({
      kind: forceKind ?? educationKind(line),
      institution: (company || title).slice(0, 160),
      title: company ? title.slice(0, 160) : "",
      start: r ? toYm(r[1]) : year && year.length > 1 ? year[0] : undefined,
      end: r ? toYm(r[2]) : year?.at(-1),
    });
  }
  return out.slice(0, 20);
}

const LANGS: [string, RegExp][] = [
  ["Hebrew", /hebrew|עברית/i],
  ["English", /english|אנגלית/i],
  ["Arabic", /arabic|ערבית/i],
  ["Russian", /russian|רוסית/i],
  ["French", /french|צרפתית/i],
  ["Spanish", /spanish|ספרדית/i],
  ["German", /german|גרמנית/i],
  ["Amharic", /amharic|אמהרית/i],
];
function langLevel(s: string): LanguageItem["level"] {
  if (/native|mother tongue|שפת אם/i.test(s)) return "NATIVE";
  if (/fluent|full professional|excellent|שוטפת|רהוטה|גבוהה|מצוינת/i.test(s)) return "FLUENT";
  if (/good|conversational|intermediate|טובה|בינונית/i.test(s)) return "CONVERSATIONAL";
  if (/basic|elementary|בסיסית/i.test(s)) return "BASIC";
  return "FLUENT";
}
function parseLanguages(text: string): LanguageItem[] {
  const out: LanguageItem[] = [];
  for (const [name, re] of LANGS) {
    // Level words follow the language name, up to the next separator ("Hebrew - native, English - fluent").
    const m = text.match(new RegExp(`(?:${re.source})([^,;\n•|]{0,40})`, "i"));
    if (m) out.push({ name, level: langLevel(m[1]) });
  }
  return out;
}

function skillLevel(years: number | undefined, mentions: number): SkillItem["level"] {
  if ((years ?? 0) >= 4 || mentions >= 3) return "EXPERT";
  if ((years ?? 0) >= 1.5 || mentions >= 2) return "GOOD";
  return years ? "BASIC" : "GOOD";
}

/** Deterministic extraction used by the mock provider and as a fallback when the LLM fails. */
export function heuristicExtract(text: string, now = new Date()): ExtractedProfile {
  const lines = text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .split("\n");
  const sections = sectionize(lines);
  const pick = (s: Section) => sections.filter((x) => x.section === s).flatMap((x) => x.lines);
  const top = sections[0].lines;

  const roleish =
    /engineer|developer|manager|lead|designer|analyst|scientist|architect|devops|qa|מפתח|מהנדס|מנהל|ראש צוות|מעצבת?|אנליסט/i;
  const headline = top.slice(0, 6).find((l) => roleish.test(l) && l.length < 140 && !/@/.test(l)) ?? "";
  const summary =
    pick("summary").join(" ").slice(0, 2000) || top.slice(0, 15).find((l) => l.length > 80 && l !== headline) || "";

  const experience = parseExperience(pick("experience"));
  const education = [...parseEducation(pick("education")), ...parseEducation(pick("military"), "MILITARY")];
  // A military unit mentioned outside its own section still counts (very common in Israeli CVs).
  if (!education.some((e) => e.kind === "MILITARY")) {
    const ml = lines.find((l) => MILITARY.test(l) && l.length < 160);
    if (ml) education.push(...parseEducation([ml.trim()], "MILITARY"));
  }

  const langSrc = pick("languages").join(" ") || text;
  const languages = parseLanguages(langSrc);

  // Skills: union of skills section + experience tech; years = sum of spans where the skill appears.
  const skillsSection = extractTech(pick("skills").join(" "));
  const all = new Set([...skillsSection, ...experience.flatMap((e) => e.tech), ...extractTech(text)]);
  const skillItems: SkillItem[] = [...all].map((name) => {
    const roles = experience.filter((e) => e.tech.includes(name));
    const years = roles.reduce((a, e) => a + spanYears(e.start || undefined, e.end || undefined, now), 0);
    const y = years ? Math.round(years * 2) / 2 : undefined;
    return { name, years: y ?? null, level: skillLevel(y, roles.length), category: categorizeSkill(name) };
  });

  const urls = text.match(/https?:\/\/[^\s)>\]]+|(?:www\.)?(?:github|linkedin)\.com\/[^\s)>\]]+/gi) ?? [];
  const norm = (u: string) => (u.startsWith("http") ? u : `https://${u}`).replace(/[.,;]+$/, "");
  const linkedinUrl = urls.map(norm).find((u) => /linkedin\.com\//i.test(u)) ?? "";
  const githubUrl = urls.map(norm).find((u) => /github\.com\//i.test(u)) ?? "";
  const portfolioUrl = urls.map(norm).find((u) => !/linkedin|github|mailto/i.test(u)) ?? "";

  const yearsTotal = totalExperienceYears(experience, now);
  const titleSource = headline || experience[0]?.title || "";
  const role = titleSource ? inferRoleCategory(titleSource) : undefined;
  const senFromTitle = titleSource ? inferSeniority(titleSource) : undefined;
  const seniority =
    yearsTotal != null && (!senFromTitle || senFromTitle === "MID")
      ? inferSeniorityFromYears(yearsTotal)
      : senFromTitle;

  return {
    ...professionalSchema.parse({
      headline: headline.slice(0, 140),
      summary,
      experience: experience.slice(0, 30),
      skillItems: skillItems.slice(0, 80),
      education,
      languages,
      linkedinUrl,
      githubUrl,
      portfolioUrl,
      phone: findPhone(text),
      projects: parseProjects(pick("projects")),
      volunteering: parseVolunteering(pick("volunteering")),
    }),
    targetRoles: role && role !== "other" ? [role] : [],
    targetSeniorities: seniority ? [seniority] : [],
    source: "heuristic",
  };
}

const llmShape = professionalSchema.extend({
  targetRoles: z.array(z.string()).default([]),
  targetSeniorities: z.array(z.enum(["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"])).default([]),
});

const s = z.string();
const dates = {
  start: s.describe("YYYY-MM or YYYY, empty if unknown"),
  end: s.describe("YYYY-MM or YYYY, empty if current"),
};
/**
 * Generation-only schema for providers with structured output (Gemini rejects empty-string enums
 * and transforms, so this mirrors `llmShape` with plain types). The result is still validated by `llmShape`.
 */
export const llmWireShape = z.object({
  headline: s,
  summary: s,
  experience: z.array(z.object({ company: s, title: s, ...dates, description: s, tech: z.array(s) })),
  skillItems: z.array(
    z.object({
      name: s,
      level: z.enum(["BASIC", "GOOD", "EXPERT"]),
      years: z.number().nullable(),
      category: z.enum(["languages", "frontend", "backend", "data", "cloud", "mobile", "ml", "tools", "other"]),
    }),
  ),
  education: z.array(
    z.object({
      kind: z.enum(["DEGREE", "BOOTCAMP", "CERTIFICATION", "COURSE", "MILITARY"]),
      institution: s,
      title: s,
      ...dates,
    }),
  ),
  languages: z.array(z.object({ name: s, level: z.enum(["BASIC", "CONVERSATIONAL", "FLUENT", "NATIVE"]) })),
  linkedinUrl: s,
  githubUrl: s,
  portfolioUrl: s,
  phone: s.describe("phone number as written, empty if none"),
  projects: z.array(z.object({ name: s, role: s, url: s, ...dates, description: s, tech: z.array(s) })),
  volunteering: z.array(z.object({ organization: s, role: s, ...dates, description: s })),
  targetRoles: z.array(s),
  targetSeniorities: z.array(z.enum(["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"])),
});

const MONTH_RE = /^\d{4}(-\d{2})?$/;
const URL_RE = /^https?:\/\/\S+$/i;

/** Drop values the strict schema would reject (e.g. "Present" as an end date) instead of discarding the whole extraction. */
export function normalizeLlmProfile(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  const fixDates = (items: unknown) =>
    Array.isArray(items)
      ? items.map((it) => {
          if (!it || typeof it !== "object") return it;
          const x = { ...(it as Record<string, unknown>) };
          for (const k of ["start", "end"]) {
            const v = typeof x[k] === "string" ? (x[k] as string).trim() : "";
            x[k] = MONTH_RE.test(v) ? v : "";
          }
          return x;
        })
      : items;
  o.experience = fixDates(o.experience);
  o.education = fixDates(o.education);
  o.projects = fixDates(o.projects);
  o.volunteering = fixDates(o.volunteering);
  if (Array.isArray(o.projects))
    o.projects = o.projects.map((p) =>
      p && typeof p === "object" && !URL_RE.test(String((p as { url?: unknown }).url ?? "").trim())
        ? { ...(p as object), url: "" }
        : p,
    );
  if (typeof o.phone === "string" && !/^[+\d][\d\s()-]{6,}$/.test(o.phone.trim())) o.phone = "";
  for (const k of ["linkedinUrl", "githubUrl", "portfolioUrl"]) {
    const v = typeof o[k] === "string" ? (o[k] as string).trim() : "";
    o[k] = URL_RE.test(v) ? v : "";
  }
  return o;
}

const PROMPT = `Extract a structured profile from the CV below. Reply with JSON only, matching:
{"headline":string,"summary":string,
 "experience":[{"company":string,"title":string,"start":"YYYY-MM","end":"YYYY-MM"|"" (empty if current),"description":string,"tech":string[]}],
 "skillItems":[{"name":string,"level":"BASIC"|"GOOD"|"EXPERT","years":number|null,"category":"languages"|"frontend"|"backend"|"data"|"cloud"|"mobile"|"ml"|"tools"|"other"}],
 "education":[{"kind":"DEGREE"|"BOOTCAMP"|"CERTIFICATION"|"COURSE"|"MILITARY","institution":string,"title":string,"start":"YYYY","end":"YYYY"}],
 "languages":[{"name":string,"level":"BASIC"|"CONVERSATIONAL"|"FLUENT"|"NATIVE"}],
 "linkedinUrl":string,"githubUrl":string,"portfolioUrl":string,"phone":string,
 "projects":[{"name":string,"role":string,"url":string,"start":"YYYY-MM"|"","end":"YYYY-MM"|"","description":string,"tech":string[]}],
 "volunteering":[{"organization":string,"role":string,"start":"YYYY-MM"|"","end":"YYYY-MM"|"","description":string}],
 "targetRoles":string[] (from: backend,frontend,fullstack,mobile,devops,data,ml,qa,security,product,design,hardware,management),
 "targetSeniorities":string[]}
IDF technology units (8200, Mamram, Talpiot, etc.) go in education with kind MILITARY. Projects and volunteering only if the CV lists them; otherwise empty arrays. Do not invent facts.`;

/** Extract with the configured LLM; the mock provider (or any failure) uses the heuristic extractor. */
export async function extractProfile(text: string, provider: LLMProvider): Promise<ExtractedProfile> {
  const fallback = () => heuristicExtract(text);
  if (provider.name === "mock") return fallback();
  try {
    const raw = await provider.complete(
      [
        { role: "system", content: PROMPT },
        { role: "user", content: text.slice(0, 20_000) },
      ],
      { json: true, schema: llmWireShape, maxTokens: 3000 },
    );
    const parsed = llmShape.safeParse(normalizeLlmProfile(JSON.parse(raw)));
    if (!parsed.success) return fallback();
    const d = parsed.data;
    return {
      ...d,
      skillItems: d.skillItems.map((s) => ({
        ...s,
        category: s.category === "other" ? categorizeSkill(s.name) : s.category,
      })),
      targetSeniorities: d.targetSeniorities as Seniority[],
      source: "llm",
    };
  } catch {
    return fallback();
  }
}
