import type { Professional } from "@/lib/profile/schema";
import { extractTech } from "@/lib/taxonomy";
import type { CvDoc } from "./types";

const LANG_LABEL: Record<string, { he: string; en: string }> = {
  BASIC: { he: "בסיסית", en: "basic" },
  CONVERSATIONAL: { he: "שיחה", en: "conversational" },
  FLUENT: { he: "שוטפת", en: "fluent" },
  NATIVE: { he: "שפת אם", en: "native" },
};

/** Split a free-text role description into bullets (lines, "•", "-", or sentences for one long line). */
export function toBullets(description: string): string[] {
  const lines = description
    .split(/\r?\n|•|·|▪|●/)
    .map((l) => l.replace(/^\s*[-*–]\s*/, "").trim())
    .filter((l) => l.length > 1);
  if (lines.length === 1 && lines[0].length > 180) {
    return lines[0]
      .split(/(?<=[.!?])\s+(?=\S)/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return lines;
}

/**
 * The user's base CV: the structured profile (filled from the uploaded CV and edited by the user),
 * with skills completed from the primary resume text. Nothing here is generated.
 */
export function buildBaseCv(opts: {
  name: string | null;
  email: string | null;
  professional: Professional;
  profileSkills: string[];
  resumeText: string | null;
  resumeSkills: string[];
  locale: "he" | "en";
}): CvDoc {
  const p = opts.professional;
  const contact = [opts.email ?? "", p.linkedinUrl, p.githubUrl, p.portfolioUrl].filter(Boolean);
  const phone = p.phone || opts.resumeText?.match(/(?:\+972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/)?.[0];
  if (phone) contact.splice(1, 0, phone);

  const skills: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      skills.push(s.trim());
    }
  };
  p.skillItems.forEach((s) => add(s.name));
  opts.profileSkills.forEach(add);
  p.experience.forEach((e) => e.tech.forEach(add));
  opts.resumeSkills.forEach(add);
  if (opts.resumeText) extractTech(opts.resumeText).forEach(add);

  let summary = p.summary;
  if (!summary && opts.resumeText && p.experience.length === 0) {
    // No structured profile yet: keep the CV's opening paragraph as the summary.
    summary =
      opts.resumeText
        .split(/\n\s*\n/)[0]
        ?.trim()
        .slice(0, 600) ?? "";
  }

  return {
    name: opts.name ?? "",
    contact,
    headline: p.headline,
    summary,
    experience: p.experience.map((e, i) => ({
      id: String(i),
      company: e.company,
      title: e.title,
      start: e.start ?? "",
      end: e.end ?? "",
      bullets: toBullets(e.description),
    })),
    skills,
    education: p.education.map((e) => ({
      institution: e.institution,
      title: e.title,
      start: e.start ?? "",
      end: e.end ?? "",
    })),
    languages: p.languages.map((l) => `${l.name} (${LANG_LABEL[l.level]?.[opts.locale] ?? l.level})`),
  };
}

/** All text of a CV in one string (for coverage and the no-invention check). */
export function cvCorpus(cv: CvDoc, extra = ""): string {
  return [
    cv.headline,
    cv.summary,
    ...cv.experience.flatMap((e) => [e.company, e.title, ...e.bullets]),
    cv.skills.join(", "),
    ...cv.education.flatMap((e) => [e.institution, e.title]),
    cv.languages.join(", "),
    extra,
  ].join("\n");
}

export function isEmptyCv(cv: CvDoc): boolean {
  return !cv.summary && cv.experience.length === 0 && cv.skills.length === 0;
}
