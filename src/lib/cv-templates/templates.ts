/** The five CV templates: style tokens + default section order. Renderers read only these tokens. */
import type { BuiltinSection, SectionId } from "./sections";

export const TEMPLATE_IDS = ["hitech", "executive", "junior", "creative", "classic"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const isTemplateId = (x: unknown): x is TemplateId => (TEMPLATE_IDS as readonly unknown[]).includes(x);

export interface CvTemplate {
  id: TemplateId;
  /** 1 = single column (ATS friendly); 2 = sidebar + main. */
  columns: 1 | 2;
  font: "sans" | "serif";
  accent: string;
  /** Text colour for headings in the main column. */
  ink: string;
  header: "start" | "center" | "band";
  titleStyle: "rule" | "caps" | "bar" | "underline";
  /** Sections placed in the sidebar when `columns === 2`. */
  sidebar: readonly SectionId[];
  defaults: readonly BuiltinSection[];
  /** Body font size in pt (PDF/DOCX). */
  size: number;
}

export const TEMPLATES: Record<TemplateId, CvTemplate> = {
  hitech: {
    id: "hitech",
    columns: 1,
    font: "sans",
    accent: "#1d4ed8",
    ink: "#0f172a",
    header: "start",
    titleStyle: "rule",
    sidebar: [],
    defaults: ["summary", "skills", "experience", "projects", "education", "military", "languages", "links"],
    size: 10,
  },
  executive: {
    id: "executive",
    columns: 1,
    font: "sans",
    accent: "#7c5a1e",
    ink: "#1c1917",
    header: "center",
    titleStyle: "caps",
    sidebar: [],
    defaults: ["summary", "experience", "education", "military", "skills", "languages", "volunteering", "links"],
    size: 10.5,
  },
  junior: {
    id: "junior",
    columns: 1,
    font: "sans",
    accent: "#0f766e",
    ink: "#0f172a",
    header: "band",
    titleStyle: "bar",
    sidebar: [],
    defaults: [
      "summary",
      "education",
      "projects",
      "skills",
      "experience",
      "military",
      "volunteering",
      "languages",
      "links",
    ],
    size: 10,
  },
  creative: {
    id: "creative",
    columns: 2,
    font: "sans",
    accent: "#be185d",
    ink: "#111827",
    header: "start",
    titleStyle: "bar",
    sidebar: ["skills", "languages", "links"],
    defaults: [
      "summary",
      "experience",
      "projects",
      "skills",
      "languages",
      "links",
      "education",
      "military",
      "volunteering",
    ],
    size: 9.5,
  },
  classic: {
    id: "classic",
    columns: 1,
    font: "serif",
    accent: "#111111",
    ink: "#111111",
    header: "center",
    titleStyle: "underline",
    sidebar: [],
    defaults: ["summary", "experience", "education", "military", "skills", "languages", "links"],
    size: 11,
  },
};

/**
 * Recommend a template from the user's target role(s), headline and seniority. Deterministic and
 * explainable; the gallery shows the result as "מומלץ עבורך".
 */
export function recommendTemplate(p: {
  targetRoles?: string[];
  desiredRole?: string | null;
  headline?: string | null;
  seniority?: string | null;
  targetSeniorities?: string[];
  yearsExperience?: number | null;
}): TemplateId {
  const text = [...(p.targetRoles ?? []), p.desiredRole ?? "", p.headline ?? ""].join(" ").toLowerCase();
  const sen = [p.seniority ?? "", ...(p.targetSeniorities ?? [])].join(" ").toUpperCase();
  const EXEC =
    /\b(vp|cto|ceo|coo|cpo|cfo|director|head of|chief|executive)\b|סמנכ"?ל|מנכ"?ל|דירקטור|ראש תחום|מנהל(ת)? (מחלקה|פיתוח|הנדסה|מוצר|כללי)/i;
  const CREATIVE =
    /\b(product|designer|design|ux|ui|creative|marketing|content|brand)\b|מוצר|עיצוב|מעצב|יצירתי|שיווק|תוכן/i;
  const JUNIOR = /\b(junior|student|intern|graduate|entry)\b|ג'וניור|סטודנט|מתמחה|הסבה|בוגר/i;
  const TECH =
    /\b(engineer|developer|devops|sre|qa|data|backend|frontend|full ?stack|software|ml|security|cloud)\b|מפתח|מהנדס|פיתוח|תוכנה|דאטה|אבטח/i;
  if (EXEC.test(text)) return "executive";
  if (JUNIOR.test(text) || /\b(JUNIOR|INTERN)\b/.test(sen)) return "junior";
  if (CREATIVE.test(text)) return "creative";
  if (/\bMANAGER\b/.test(sen) || /\b(manager|team lead)\b|מנהל|ראש צוות/i.test(text)) return "executive";
  if (p.yearsExperience != null && p.yearsExperience < 2 && !/\b(MID|SENIOR|LEAD)\b/.test(sen)) return "junior";
  if (TECH.test(text)) return "hitech";
  return "classic";
}
