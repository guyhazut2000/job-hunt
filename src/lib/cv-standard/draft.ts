/**
 * The guided editor edits a "draft" — only the CV fields the standard checks — and merges it back
 * into the profile (single source of truth). Pure so it is unit-tested.
 */
import { z } from "zod";
import { toBullets } from "@/lib/cv-tailor/base";
import { SKILL_CATEGORIES, professionalSchema, type Professional } from "@/lib/profile/schema";
import type { CvContent } from "@/lib/cv-templates/content";

export const draftSchema = z.object({
  name: z.string().trim().max(120),
  location: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  linkedinUrl: z.string().trim().max(300),
  githubUrl: z.string().trim().max(300),
  portfolioUrl: z.string().trim().max(300),
  headline: z.string().max(140),
  summary: z.string().max(2000),
  experience: z.array(z.object({ bullets: z.array(z.string().max(600)).max(20) })).max(30),
  projects: z.array(z.object({ bullets: z.array(z.string().max(600)).max(20) })).max(20),
  skills: z.array(z.object({ name: z.string().trim().min(1).max(40), category: z.enum(SKILL_CATEGORIES) })).max(80),
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
  };
}

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
    experience: p.experience.map((e, i) =>
      d.experience[i] ? { ...e, description: joinBullets(d.experience[i].bullets) } : e,
    ),
    projects: p.projects.map((x, i) => (d.projects[i] ? { ...x, description: joinBullets(d.projects[i].bullets) } : x)),
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
  return {
    ...c,
    name: d.name.trim(),
    headline: d.headline.trim(),
    summary: d.summary.trim(),
    contact,
    links,
    experience: c.experience.map((e, i) => (d.experience[i] ? { ...e, bullets: clean(d.experience[i].bullets) } : e)),
    projects: c.projects.map((e, i) => (d.projects[i] ? { ...e, bullets: clean(d.projects[i].bullets) } : e)),
    skills: d.skills.map((s) => s.name),
  };
}
