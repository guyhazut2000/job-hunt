/**
 * Hiring-process stage kinds (docs/hiring-process.md): labels, deterministic keyword detection, and the
 * /learn prep link for each kind. Pure — no DB or network.
 */
import { resolveSkill } from "@/lib/learning/graph";

export const STAGE_KINDS = [
  "application",
  "phone_screen",
  "assessment",
  "home_assignment",
  "technical",
  "coding",
  "system_design",
  "team",
  "manager",
  "hr",
  "executive",
  "onsite",
  "references",
  "offer",
  "other",
] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export function isStageKind(v: unknown): v is StageKind {
  return typeof v === "string" && (STAGE_KINDS as readonly string[]).includes(v);
}

export const STAGE_LABELS: Record<"he" | "en", Record<StageKind, string>> = {
  he: {
    application: "הגשת מועמדות",
    phone_screen: "שיחת סינון טלפונית",
    assessment: "מבחן מקוון / מבחני התאמה",
    home_assignment: "מטלת בית",
    technical: "ראיון מקצועי / טכני",
    coding: "ראיון קוד",
    system_design: "ראיון System Design",
    team: "פגישה עם הצוות",
    manager: "ראיון עם המנהל/ת",
    hr: "ראיון HR / התאמה תרבותית",
    executive: "ראיון עם הנהלה בכירה",
    onsite: "יום ראיונות (Onsite)",
    references: "בדיקת ממליצים",
    offer: "הצעת עבודה",
    other: "שלב נוסף",
  },
  en: {
    application: "Application",
    phone_screen: "Phone / recruiter screen",
    assessment: "Online assessment",
    home_assignment: "Home assignment",
    technical: "Technical / professional interview",
    coding: "Coding interview",
    system_design: "System design interview",
    team: "Meet the team",
    manager: "Hiring manager interview",
    hr: "HR / culture interview",
    executive: "Executive interview",
    onsite: "Onsite / interview loop",
    references: "Reference check",
    offer: "Offer",
    other: "Other stage",
  },
};

/** Keyword patterns (EN + HE) per kind, checked in this order — the first match wins. */
const KIND_PATTERNS: [StageKind, RegExp][] = [
  ["system_design", /system[- ]design|architecture interview|ארכיטקטורה|תכנון מערכת/i],
  ["home_assignment", /home[- ]?(assignment|task|exercise|test)|take[- ]home|מטלת בית|מטלה ביתית|תרגיל בית/i],
  ["coding", /coding|live code|pair[- ]programming|whiteboard|algorithm|leetcode|ראיון קוד|כתיבת קוד/i],
  [
    "assessment",
    /assessment|online test|aptitude|psychometric|hackerrank|codility|מבחן (מקוון|התאמה)|מבחני (מיון|התאמה)|מכון (מיון|השמה)/i,
  ],
  [
    "phone_screen",
    /phone|recruiter (call|screen|chat|conversation|interview)|initial (call|screen|conversation)|intro(ductory)? call|screen(ing)? call|talent (acquisition|partner) (call|chat)|שיחה טלפונית|שיחת (סינון|היכרות|טלפון)|ראיון טלפוני/i,
  ],
  ["references", /reference (check|call)s?|\breferences\b|ממליצים/i],
  [
    "offer",
    /^offer\b|(job|an|the|final|verbal|written|receive|extend(ed)?|make|making) offer\b|offer (stage|letter|decision|call)|decision (and|&) offer|הצעת (עבודה|שכר)|חתימה על חוזה/i,
  ],
  ["executive", /executive|vp |c-level|ceo|cto|founder|הנהלה|מנכ"?ל|סמנכ"?ל/i],
  [
    "hr",
    /\bhr\b|human resources|people (team|partner)|culture|values|behavio(u)?ral|personality|משאבי אנוש|ראיון (HR|אישי)|התאמה תרבותית/i,
  ],
  ["manager", /hiring manager|manager|team lead|מנהל|ראש צוות/i],
  ["team", /team (interview|meeting|members)|meet the team|peer|panel|הצוות/i],
  ["onsite", /on-?site|interview (loop|day)|final round|virtual onsite|יום ראיונות/i],
  ["technical", /technical|professional interview|deep dive|domain|ראיון (מקצועי|טכני)/i],
  ["application", /apply|application|resume|cv review|הגשת מועמדות|קורות חיים/i],
];

/** Best-effort kind for a free-text stage name (used to validate/normalise LLM output and by the heuristic). */
export function detectKind(text: string): StageKind {
  for (const [kind, re] of KIND_PATTERNS) if (re.test(text)) return kind;
  return "other";
}

export interface PrepLink {
  href: string;
  /** Learning-graph skill id when the link points at a skill page. */
  skill?: string;
}

const TECH_KINDS: ReadonlySet<StageKind> = new Set(["technical", "coding", "home_assignment", "assessment", "onsite"]);

/**
 * Where to prepare for a stage in /learn: system design → networking fundamentals (the closest node in the
 * learning graph); technical/coding stages → the job's first tech-stack skill that has a roadmap. HR,
 * offer, references etc. have no learning content and return null.
 */
export function prepLinkFor(kind: StageKind, techStack: readonly string[] = []): PrepLink | null {
  if (kind === "system_design") return { href: "/learn/networking", skill: "networking" };
  if (!TECH_KINDS.has(kind)) return null;
  for (const t of techStack) {
    const node = resolveSkill(t);
    if (node) return { href: `/learn/${node.id}`, skill: node.id };
  }
  return { href: "/learn" };
}
