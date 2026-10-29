/** Offline overview built from the roadmap graph or a generic template (pure; docs/concepts.md). */
import type { Locale } from "@/lib/i18n/dictionaries";
import { GRAPH, resolveSkill } from "@/lib/learning/graph";
import type { LearnCategory, SkillNode } from "@/lib/learning/types";
import { curatedOverview } from "./catalog";
import type { ConceptCategory, ConceptKind, ConceptOverview } from "./core";

const CAT: Partial<Record<LearnCategory, ConceptCategory>> = {
  devops: "devops",
  cloud: "devops",
  backend: "backend",
  frontend: "frontend",
  mobile: "frontend",
  data: "data",
  ml: "data",
  foundations: "cli-os",
  languages: "backend",
  qa: "practices",
  hardware: "architecture",
};

export function conceptCategoryForSkill(n: SkillNode): ConceptCategory {
  if (n.id === "networking") return "networking";
  return CAT[n.category] ?? "practices";
}

/** Roadmap node a concept name maps to (by id, label or alias). */
export function skillForConcept(name: string): SkillNode | undefined {
  return resolveSkill(name);
}

function fromNode(n: SkillNode, locale: Locale): ConceptOverview {
  const he = locale === "he";
  const next = [...GRAPH.byId.values()].filter((x) => x.prerequisites.includes(n.id)).slice(0, 3);
  const related = [...n.prerequisites.map((id) => GRAPH.byId.get(id)).filter((x): x is SkillNode => !!x), ...next]
    .slice(0, 6)
    .map((x) => ({
      name: x.label,
      why: n.prerequisites.includes(x.id)
        ? he
          ? "בסיס שכדאי להכיר קודם"
          : "A foundation to know first"
        : he
          ? "הצעד הבא"
          : "A natural next step",
    }));
  return {
    summary: n.summary[locale],
    why: he
      ? `${n.label} מופיע במשרות רבות בתחום — שווה להבין את הבסיס ואת הבעיה שהוא פותר.`
      : `${n.label} shows up in many job posts — worth understanding the basics and the problem it solves.`,
    how: he
      ? `נושאי יסוד: ${n.stages.fundamentals.slice(0, 4).join(", ")}.`
      : `Core topics: ${n.stages.fundamentals.slice(0, 4).join(", ")}.`,
    example: { code: "", caption: "" },
    keyPoints: n.stages.intermediate.slice(0, 4),
    related,
    category: conceptCategoryForSkill(n),
  };
}

function generic(name: string, kind: ConceptKind, locale: Locale, companyName?: string | null): ConceptOverview {
  const he = locale === "he";
  if (kind === "COMPANY") {
    const co = companyName ?? "";
    return {
      summary: he
        ? `${name} ב-${co}: עדיין אין סקירה שנוצרה.`
        : `${name} at ${co}: no overview has been generated yet.`,
      why: he
        ? "הבנת התרבות ותהליך הגיוס של חברה עוזרת להתכונן לראיונות ולשאול שאלות טובות."
        : "Understanding a company's culture and hiring process helps you prepare for interviews and ask good questions.",
      how: he
        ? "בדוק/י את עמודי הקריירה הרשמיים, ושאל/י בצ'אט למטה כשה-AI זמין."
        : "Check the official careers pages, and ask in the chat below when AI is available.",
      example: { code: "", caption: "" },
      keyPoints: [],
      related: [],
      category: "company",
    };
  }
  return {
    summary: he ? `${name}: עדיין אין סקירה שנוצרה.` : `${name}: no overview has been generated yet.`,
    why: he
      ? "ה-AI לא זמין כרגע. אפשר לכתוב הערות ולחזור אחר כך."
      : "AI is not available right now. You can take notes and come back later.",
    how: he
      ? "חפש/י בתיעוד הרשמי, או שאל/י בצ'אט למטה כשה-AI זמין."
      : "Look it up in the official docs, or ask in the chat below when AI is available.",
    example: { code: "", caption: "" },
    keyPoints: [],
    related: [],
    category: "practices",
  };
}

/** Curated → roadmap graph → generic. `slug` is the canonical concept slug. */
export function offlineOverview(
  slug: string,
  name: string,
  kind: ConceptKind,
  locale: Locale,
  companyName?: string | null,
): { overview: ConceptOverview; source: "curated" | "fallback" } {
  const cur = curatedOverview(slug, locale);
  if (cur) return { overview: cur, source: "curated" };
  const node = kind === "TECH" ? skillForConcept(name) : undefined;
  return { overview: node ? fromNode(node, locale) : generic(name, kind, locale, companyName), source: "fallback" };
}
