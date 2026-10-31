import type { CvDoc } from "@/lib/cv-tailor/types";
import { db } from "@/lib/db";
import type { CvLang } from "@/lib/i18n/cv-templates";
import { readPreferences, readProfessional } from "@/lib/profile/load";
import { detectLanguage } from "./bidi";
import { contentFromProfile, contentFromTailored, contentStrings, isEmptyContent, type CvContent } from "./content";
import { normalizeLayout, type LayoutEntry } from "./sections";
import { TEMPLATES, isTemplateId, recommendTemplate, type TemplateId } from "./templates";

export interface CvSource {
  content: CvContent;
  /** Language the content is written in (detected). */
  written: CvLang;
  empty: boolean;
  tailored: { id: string; title: string; company: string; language: CvLang } | null;
  recommended: TemplateId;
  chosen: TemplateId | null;
}

/** CV content for a user: profile (single source of truth), or a tailored CV (#59) + the profile. */
export async function loadCvSource(userId: string, tailoredId?: string | null): Promise<CvSource> {
  const [user, profile, tailored] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.profile.findUnique({ where: { userId } }),
    tailoredId
      ? db.tailoredCv.findFirst({
          where: { id: tailoredId, userId },
          select: { id: true, title: true, company: true, language: true, content: true },
        })
      : null,
  ]);
  const professional = readProfessional(profile);
  const prefs = readPreferences(profile);
  let content = contentFromProfile({
    name: user?.name ?? null,
    email: user?.email ?? null,
    location: profile?.location ?? null,
    professional,
  });
  if (tailored) content = contentFromTailored(tailored.content as unknown as CvDoc, content);
  return {
    content,
    written: detectLanguage(contentStrings(content)),
    empty: isEmptyContent(content),
    tailored: tailored
      ? {
          id: tailored.id,
          title: tailored.title,
          company: tailored.company,
          language: tailored.language === "en" ? "en" : "he",
        }
      : null,
    recommended: recommendTemplate({
      targetRoles: prefs.targetRoles,
      desiredRole: profile?.desiredRole,
      headline: professional.headline,
      seniority: profile?.seniority,
      targetSeniorities: prefs.targetSeniorities,
      yearsExperience: profile?.yearsExperience,
    }),
    chosen: isTemplateId(profile?.cvTemplate) ? profile.cvTemplate : null,
  };
}

export async function loadLayout(userId: string, template: TemplateId, content: CvContent): Promise<LayoutEntry[]> {
  const row = await db.cvLayout.findUnique({
    where: { userId_template: { userId, template } },
    select: { sections: true },
  });
  return normalizeLayout(
    row?.sections ?? [],
    TEMPLATES[template].defaults,
    content.custom.map((c) => c.id),
  );
}

export async function loadAllLayouts(userId: string, content: CvContent): Promise<Record<TemplateId, LayoutEntry[]>> {
  const rows = await db.cvLayout.findMany({ where: { userId }, select: { template: true, sections: true } });
  const ids = content.custom.map((c) => c.id);
  const out = {} as Record<TemplateId, LayoutEntry[]>;
  for (const id of Object.keys(TEMPLATES) as TemplateId[])
    out[id] = normalizeLayout(rows.find((r) => r.template === id)?.sections ?? [], TEMPLATES[id].defaults, ids);
  return out;
}
