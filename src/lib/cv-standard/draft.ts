/**
 * The guided editor edits a "draft" — only the CV fields the standard checks — and merges it back
 * into the profile (single source of truth). Pure so it is unit-tested.
 */
import { z } from "zod";
import { toBullets } from "@/lib/cv-tailor/base";
import { EDUCATION_KINDS, SKILL_CATEGORIES, professionalSchema, type Professional } from "@/lib/profile/schema";
import type { CvContent } from "@/lib/cv-templates/content";

const ym = z.string().trim().max(7).default("");
/**
 * A role / project the user accepted from the CV import (docs/cv-ai-assist.md). It exists only in
 * the draft until "Save" appends it to the profile; its bullets are the draft's bullets at that index.
 */
export const newEntry = z.object({
  title: z.string().trim().min(1).max(120),
  org: z.string().trim().max(120).default(""),
  start: ym,
  end: ym,
});
export type NewEntry = z.infer<typeof newEntry>;
export const newEducation = z.object({
  kind: z.enum(EDUCATION_KINDS),
  institution: z.string().trim().min(1).max(160),
  title: z.string().trim().max(160).default(""),
  start: ym,
  end: ym,
});
export type NewEducation = z.infer<typeof newEducation>;

/** A "[X%]" / "[N]" / "[מספר]" placeholder the AI left where a real number is missing. */
export const PLACEHOLDER_RE = /\[(?:X|N|Y|Z|\?|מספר|אחוז|מדד|metric)[^\]]{0,12}\]/;
export function draftPlaceholders(d: Pick<Draft, "summary" | "headline" | "experience" | "projects">): number {
  const all = [
    d.summary,
    d.headline,
    ...d.experience.flatMap((e) => e.bullets),
    ...d.projects.flatMap((e) => e.bullets),
  ];
  return all.filter((x) => PLACEHOLDER_RE.test(x)).length;
}

export const draftSchema = z.object({
  name: z.string().trim().max(120),
  location: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  linkedinUrl: z.string().trim().max(300),
  githubUrl: z.string().trim().max(300),
  portfolioUrl: z.string().trim().max(300),
  headline: z.string().max(140),
  summary: z.string().max(2000),
  experience: z.array(z.object({ bullets: z.array(z.string().max(600)).max(20), add: newEntry.optional() })).max(30),
  projects: z.array(z.object({ bullets: z.array(z.string().max(600)).max(20), add: newEntry.optional() })).max(20),
  skills: z.array(z.object({ name: z.string().trim().min(1).max(40), category: z.enum(SKILL_CATEGORIES) })).max(80),
  /** Education / courses / certifications added in the editor (existing ones are edited in the profile). */
  education: z.array(newEducation).max(20).default([]),
});
export type Draft = z.infer<typeof draftSchema>;

export function draftFromProfile(p: Professional, who: { name: string | null; location: string | null }): Draft {
  return {
    name: who.name ?? "",
    location: who.location ?? "",
    phone: p.phone ?? "",
    linkedinUrl: p.linkedinUrl,
    githubUrl: p.githubUrl,
    portfolioUrl: p.portfolioUrl,
    headline: p.headline,
    summary: p.summary,
    experience: p.experience.map((e) => ({ bullets: toBullets(e.description) })),
    projects: p.projects.map((x) => ({ bullets: toBullets(x.description) })),
    skills: p.skillItems.map((s) => ({ name: s.name, category: s.category })),
    education: [],
  };
}

const ymOrEmpty = (v: string) => (/^\d{4}(-\d{2})?$/.test(v) ? v : "");

const joinBullets = (b: string[]) =>
  b
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

/** Merge the draft into the profile; existing skill levels/years are kept by name. */
export function mergeDraft(
  p: Professional,
  d: Draft,
): { ok: true; professional: Professional } | { ok: false; path: string } {
  const byName = new Map(p.skillItems.map((s) => [s.name.toLowerCase(), s]));
  const seen = new Set<string>();
  const skillItems = d.skills
    .filter((s) => {
      const k = s.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((s) => ({
      ...(byName.get(s.name.toLowerCase()) ?? { level: "GOOD" as const }),
      name: s.name,
      category: s.category,
    }));
  const merged = {
    ...p,
    phone: d.phone,
    linkedinUrl: d.linkedinUrl,
    githubUrl: d.githubUrl,
    portfolioUrl: d.portfolioUrl,
    headline: d.headline.trim(),
    summary: d.summary.trim(),
    experience: [
      ...p.experience.map((e, i) =>
        d.experience[i] && !d.experience[i].add ? { ...e, description: joinBullets(d.experience[i].bullets) } : e,
      ),
      // Roles accepted from the CV import, appended after the profile's own.
      ...d.experience.flatMap((x) =>
        x.add
          ? [
              {
                company: x.add.org || x.add.title,
                title: x.add.title,
                start: ymOrEmpty(x.add.start),
                end: ymOrEmpty(x.add.end),
                description: joinBullets(x.bullets),
                tech: [],
              },
            ]
          : [],
      ),
    ],
    projects: [
      ...p.projects.map((x, i) =>
        d.projects[i] && !d.projects[i].add ? { ...x, description: joinBullets(d.projects[i].bullets) } : x,
      ),
      ...d.projects.flatMap((x) =>
        x.add
          ? [
              {
                name: x.add.title,
                role: x.add.org,
                url: "",
                start: ymOrEmpty(x.add.start),
                end: ymOrEmpty(x.add.end),
                description: joinBullets(x.bullets),
                tech: [],
              },
            ]
          : [],
      ),
    ],
    education: [
      ...p.education,
      ...(d.education ?? []).map((e) => ({ ...e, start: ymOrEmpty(e.start), end: ymOrEmpty(e.end) })),
    ],
    skillItems,
  };
  const r = professionalSchema.safeParse(merged);
  if (!r.success) return { ok: false, path: r.error.issues[0]?.path.join(".") ?? "" };
  return { ok: true, professional: r.data };
}

/** The CV content as it will be once the draft is saved (live preview + live rules). */
export function applyDraft(c: CvContent, d: Draft, email: string | null): CvContent {
  const contact: CvContent["contact"] = [];
  if (email) contact.push({ kind: "email", value: email });
  if (d.phone.trim()) contact.push({ kind: "phone", value: d.phone.trim() });
  if (d.location.trim()) contact.push({ kind: "location", value: d.location.trim() });
  const links: CvContent["links"] = [];
  if (d.linkedinUrl.trim()) links.push({ kind: "linkedin", url: d.linkedinUrl.trim() });
  if (d.githubUrl.trim()) links.push({ kind: "github", url: d.githubUrl.trim() });
  if (d.portfolioUrl.trim()) links.push({ kind: "portfolio", url: d.portfolioUrl.trim() });
  const clean = (b: string[]) => b.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const added = (xs: Draft["experience"]) =>
    xs.flatMap((x) =>
      x.add
        ? [{ title: x.add.title, org: x.add.org, start: x.add.start, end: x.add.end, bullets: clean(x.bullets) }]
        : [],
    );
  const edu = d.education ?? [];
  const toEntry = (e: NewEducation) => ({
    title: e.title,
    org: e.institution,
    start: e.start,
    end: e.end,
    bullets: [],
  });
  return {
    ...c,
    name: d.name.trim(),
    headline: d.headline.trim(),
    summary: d.summary.trim(),
    contact,
    links,
    experience: [
      ...c.experience.map((e, i) =>
        d.experience[i] && !d.experience[i].add ? { ...e, bullets: clean(d.experience[i].bullets) } : e,
      ),
      ...added(d.experience),
    ],
    projects: [
      ...c.projects.map((e, i) =>
        d.projects[i] && !d.projects[i].add ? { ...e, bullets: clean(d.projects[i].bullets) } : e,
      ),
      ...added(d.projects),
    ],
    education: [...c.education, ...edu.filter((e) => e.kind !== "MILITARY").map(toEntry)],
    military: [...c.military, ...edu.filter((e) => e.kind === "MILITARY").map(toEntry)],
    skills: d.skills.map((s) => s.name),
  };
}
