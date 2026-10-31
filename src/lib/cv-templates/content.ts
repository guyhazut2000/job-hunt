/**
 * Template-ready CV content, built only from the profile (single source of truth) or from a
 * tailored CV (#59) completed with the profile's other sections. Nothing here is generated.
 */
import { toBullets } from "@/lib/cv-tailor/base";
import type { CvDoc } from "@/lib/cv-tailor/types";
import type { LanguageItem, Professional } from "@/lib/profile/schema";

export interface CvEntry {
  /** Role / degree / project name. */
  title: string;
  /** Company / institution / organization / project role. */
  org: string;
  start: string;
  end: string;
  bullets: string[];
  url?: string;
  tech?: string[];
}
export interface CvContact {
  kind: "email" | "phone" | "location";
  value: string;
}
export interface CvLink {
  kind: "linkedin" | "github" | "portfolio";
  url: string;
}
export interface CvLanguageLine {
  name: string;
  level?: LanguageItem["level"];
}
export interface CvContent {
  name: string;
  headline: string;
  summary: string;
  contact: CvContact[];
  links: CvLink[];
  experience: CvEntry[];
  projects: CvEntry[];
  education: CvEntry[];
  military: CvEntry[];
  volunteering: CvEntry[];
  skills: string[];
  languages: CvLanguageLine[];
  custom: { id: string; title: string; bullets: string[] }[];
}

const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•–]\s*/, "").trim())
    .filter(Boolean);

export function contentFromProfile(input: {
  name: string | null;
  email: string | null;
  location?: string | null;
  professional: Professional;
}): CvContent {
  const p = input.professional;
  const contact: CvContact[] = [];
  if (input.email) contact.push({ kind: "email", value: input.email });
  if (p.phone) contact.push({ kind: "phone", value: p.phone });
  if (input.location) contact.push({ kind: "location", value: input.location });
  const links: CvLink[] = [];
  if (p.linkedinUrl) links.push({ kind: "linkedin", url: p.linkedinUrl });
  if (p.githubUrl) links.push({ kind: "github", url: p.githubUrl });
  if (p.portfolioUrl) links.push({ kind: "portfolio", url: p.portfolioUrl });
  const edu = (kind: "military" | "other") =>
    p.education
      .filter((e) => (kind === "military" ? e.kind === "MILITARY" : e.kind !== "MILITARY"))
      .map((e) => ({
        title: e.title,
        org: e.institution,
        start: e.start ?? "",
        end: e.end ?? "",
        bullets: [],
      }));
  return {
    name: (input.name ?? "").trim(),
    headline: p.headline,
    summary: p.summary,
    contact,
    links,
    experience: p.experience.map((e) => ({
      title: e.title,
      org: e.company,
      start: e.start ?? "",
      end: e.end ?? "",
      bullets: toBullets(e.description),
    })),
    projects: p.projects.map((x) => ({
      title: x.name,
      org: x.role,
      start: x.start ?? "",
      end: x.end ?? "",
      bullets: toBullets(x.description),
      url: x.url || undefined,
      tech: x.tech.length ? x.tech : undefined,
    })),
    education: edu("other"),
    military: edu("military"),
    volunteering: p.volunteering.map((v) => ({
      title: v.role,
      org: v.organization,
      start: v.start ?? "",
      end: v.end ?? "",
      bullets: toBullets(v.description),
    })),
    skills: p.skillItems.map((s) => s.name),
    languages: p.languages.map((l) => ({ name: l.name, level: l.level })),
    custom: p.customSections.map((c) => ({ id: c.id, title: c.title, bullets: lines(c.body) })),
  };
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * A tailored CV keeps its tailored headline, summary, experience, skills and education; the
 * sections a tailored CV does not cover (projects, military, volunteering, links, custom) come
 * from the profile so every template can render it.
 */
export function contentFromTailored(doc: CvDoc, base: CvContent): CvContent {
  const military = new Set(base.military.map((m) => norm(m.org)));
  const education = doc.education.filter((e) => !military.has(norm(e.institution)));
  return {
    ...base,
    name: doc.name || base.name,
    headline: doc.headline,
    summary: doc.summary,
    experience: doc.experience.map((r) => ({
      title: r.title,
      org: r.company,
      start: r.start,
      end: r.end,
      bullets: r.bullets,
    })),
    skills: doc.skills,
    education: education.map((e) => ({ title: e.title, org: e.institution, start: e.start, end: e.end, bullets: [] })),
    languages: doc.languages.length
      ? doc.languages.map((name) => {
          const known = base.languages.find((l) => norm(name).startsWith(norm(l.name)));
          return known && norm(known.name) === norm(name) ? known : { name };
        })
      : base.languages,
  };
}

/** True when there is nothing worth rendering yet (gallery then previews demo content). */
export function isEmptyContent(c: CvContent): boolean {
  return (
    !c.summary && !c.headline && !c.experience.length && !c.education.length && !c.projects.length && !c.skills.length
  );
}

/** Every user-written string, in a stable order (translation and hashing walk the same list). */
export function contentStrings(c: CvContent): string[] {
  const out: string[] = [c.name, c.headline, c.summary];
  for (const x of c.contact) if (x.kind === "location") out.push(x.value);
  for (const list of [c.experience, c.projects, c.education, c.military, c.volunteering])
    for (const e of list) out.push(e.title, e.org, ...e.bullets);
  for (const l of c.languages) out.push(l.name);
  for (const x of c.custom) out.push(x.title, ...x.bullets);
  return out;
}

/** Inverse of contentStrings: rebuild the content with replaced strings (same order, same count). */
export function withStrings(c: CvContent, strings: string[]): CvContent {
  let i = 0;
  const next = () => strings[i++] ?? "";
  const name = next();
  const headline = next();
  const summary = next();
  const contact = c.contact.map((x) => (x.kind === "location" ? { ...x, value: next() } : x));
  const mapList = (list: CvEntry[]) =>
    list.map((e) => ({ ...e, title: next(), org: next(), bullets: e.bullets.map(() => next()) }));
  const experience = mapList(c.experience);
  const projects = mapList(c.projects);
  const education = mapList(c.education);
  const military = mapList(c.military);
  const volunteering = mapList(c.volunteering);
  const languages = c.languages.map((l) => ({ ...l, name: next() }));
  const custom = c.custom.map((x) => ({ ...x, title: next(), bullets: x.bullets.map(() => next()) }));
  return {
    ...c,
    name,
    contact,
    headline,
    summary,
    experience,
    projects,
    education,
    military,
    volunteering,
    languages,
    custom,
  };
}

/** Demo content for gallery thumbnails and sample files — not any real user's data. */
export function demoContent(lang: "he" | "en"): CvContent {
  if (lang === "en")
    return {
      name: "Noa Cohen",
      headline: "Full-Stack Developer · React & Node.js",
      summary:
        "Full-stack developer with 4 years of experience building B2B SaaS products. I care about clean APIs, fast UIs and shipping small, well-tested changes.",
      contact: [
        { kind: "email", value: "noa.cohen@example.com" },
        { kind: "phone", value: "050-123-4567" },
        { kind: "location", value: "Tel Aviv" },
      ],
      links: [
        { kind: "linkedin", url: "https://www.linkedin.com/in/noa-cohen-demo" },
        { kind: "github", url: "https://github.com/noa-demo" },
      ],
      experience: [
        {
          title: "Full-Stack Developer",
          org: "Acme Cloud",
          start: "2022-03",
          end: "",
          bullets: [
            "Built the billing dashboard in React and TypeScript, used by 1,200 customers.",
            "Cut API p95 latency from 800ms to 250ms with PostgreSQL indexes and caching in Redis.",
          ],
        },
        {
          title: "Junior Developer",
          org: "Startup Labs",
          start: "2020-08",
          end: "2022-02",
          bullets: ["Developed internal tools with Node.js and Express.", "Wrote CI pipelines in GitHub Actions."],
        },
      ],
      projects: [
        {
          title: "Trail Mapper",
          org: "Creator",
          start: "2023-01",
          end: "",
          bullets: ["Offline hiking maps app with 2,000 monthly users."],
          url: "https://github.com/noa-demo/trail-mapper",
          tech: ["React Native", "MapLibre"],
        },
      ],
      education: [
        { title: "B.Sc. Computer Science", org: "Tel Aviv University", start: "2016", end: "2020", bullets: [] },
      ],
      military: [{ title: "Software developer", org: "IDF – C4I Corps", start: "2013", end: "2016", bullets: [] }],
      volunteering: [
        {
          title: "Mentor",
          org: "Code.org Israel",
          start: "2021",
          end: "",
          bullets: ["Weekly coding club for teenagers."],
        },
      ],
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Redis", "Docker", "AWS"],
      languages: [
        { name: "Hebrew", level: "NATIVE" },
        { name: "English", level: "FLUENT" },
      ],
      custom: [{ id: "awards", title: "Awards", bullets: ["1st place, TAU Hackathon 2019"] }],
    };
  return {
    name: "נועה כהן",
    headline: "מפתחת Full-Stack · React ו-Node.js",
    summary:
      "מפתחת Full-Stack עם 4 שנות ניסיון בבניית מוצרי SaaS לעסקים. אוהבת ממשקי API נקיים, ממשקים מהירים ושחרור שינויים קטנים ובדוקים היטב.",
    contact: [
      { kind: "email", value: "noa.cohen@example.com" },
      { kind: "phone", value: "050-123-4567" },
      { kind: "location", value: "תל אביב" },
    ],
    links: [
      { kind: "linkedin", url: "https://www.linkedin.com/in/noa-cohen-demo" },
      { kind: "github", url: "https://github.com/noa-demo" },
    ],
    experience: [
      {
        title: "מפתחת Full-Stack",
        org: "Acme Cloud",
        start: "2022-03",
        end: "",
        bullets: [
          "בניתי את לוח הבקרה לחיובים ב-React וב-TypeScript, בשימוש 1,200 לקוחות.",
          "הורדתי את זמן התגובה (p95) של ה-API מ-800ms ל-250ms בעזרת אינדקסים ב-PostgreSQL ו-caching ב-Redis.",
        ],
      },
      {
        title: "מפתחת ג'וניור",
        org: "Startup Labs",
        start: "2020-08",
        end: "2022-02",
        bullets: ["פיתחתי כלים פנימיים ב-Node.js וב-Express.", "כתבתי תהליכי CI ב-GitHub Actions."],
      },
    ],
    projects: [
      {
        title: "Trail Mapper",
        org: "יוצרת",
        start: "2023-01",
        end: "",
        bullets: ["אפליקציית מפות טיולים אופליין עם 2,000 משתמשים בחודש."],
        url: "https://github.com/noa-demo/trail-mapper",
        tech: ["React Native", "MapLibre"],
      },
    ],
    education: [{ title: "B.Sc. במדעי המחשב", org: "אוניברסיטת תל אביב", start: "2016", end: "2020", bullets: [] }],
    military: [{ title: "מפתחת תוכנה", org: 'צה"ל – חיל התקשוב', start: "2013", end: "2016", bullets: [] }],
    volunteering: [
      { title: "מנטורית", org: "Code.org ישראל", start: "2021", end: "", bullets: ["חוג תכנות שבועי לבני נוער."] },
    ],
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Redis", "Docker", "AWS"],
    languages: [
      { name: "עברית", level: "NATIVE" },
      { name: "אנגלית", level: "FLUENT" },
    ],
    custom: [{ id: "awards", title: "פרסים", bullets: ["מקום ראשון, האקתון אוניברסיטת תל אביב 2019"] }],
  };
}
