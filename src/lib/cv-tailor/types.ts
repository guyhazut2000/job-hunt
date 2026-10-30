/** Tailored CV data model (docs/cv-tailor.md). Stored as JSON on TailoredCv.content / .base. */

export type CvLanguage = "he" | "en";
export type TailorSource = "ai" | "offline" | "limited" | "edited";

export interface CvRole {
  /** Stable id (index in the base CV) so the diff can pair tailored ↔ base roles. */
  id: string;
  company: string;
  title: string;
  /** "YYYY-MM" or "" — always copied from the base CV, never generated. */
  start: string;
  end: string;
  bullets: string[];
  /** Tailored CVs only: index of each bullet in the base role (-1 = written by the user). */
  origin?: number[];
}

export interface CvEducation {
  institution: string;
  title: string;
  start: string;
  end: string;
}

export interface CvDoc {
  name: string;
  contact: string[];
  headline: string;
  summary: string;
  experience: CvRole[];
  skills: string[];
  education: CvEducation[];
  languages: string[];
}

export type RequirementKind = "tech" | "years" | "degree" | "language";

export interface Requirement {
  kind: RequirementKind;
  /** Display label, e.g. "React", "5+ years", "B.Sc / degree", "English". */
  label: string;
  covered: boolean;
  /** Where in the CV it was found (for covered ones). */
  evidence?: string;
}

export interface MatchSummary {
  covered: Requirement[];
  missing: Requirement[];
  /** 0–100: covered / total (100 when the posting lists nothing we can check). */
  score: number;
}

export interface TailorTarget {
  title: string;
  company: string;
  description: string;
  techStack: string[];
}
