import { z } from "zod";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { SkillNode, Stage } from "./types";

/**
 * Practice + Q&A content for one (skill, stage, locale). The same zod schema constrains the
 * LLM (structured output), validates cached rows, and checks the curated static fallback.
 */
export const exerciseSchema = z.object({
  title: z.string().trim().min(3).max(140),
  goal: z.string().trim().min(3).max(500),
  steps: z.array(z.string().trim().min(2).max(500)).min(2).max(8),
  expected: z.string().trim().min(3).max(600),
  hints: z.array(z.string().trim().min(2).max(500)).max(4),
  checklist: z.array(z.string().trim().min(2).max(240)).min(1).max(6),
  level: z.enum(["easy", "medium", "hard"]),
});

export const questionSchema = z.object({
  q: z.string().trim().min(5).max(500),
  a: z.string().trim().min(5).max(1800),
  kind: z.enum(["concept", "why", "compare", "debug", "scenario"]),
});

export const stageContentSchema = z.object({
  exercises: z.array(exerciseSchema).min(1).max(4),
  questions: z.array(questionSchema).min(3).max(8),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type Exercise = ExerciseInput & { id: string };
export type Question = QuestionInput & { id: string };
export interface StageContentData {
  exercises: Exercise[];
  questions: Question[];
}
export type ContentSource = "ai" | "static" | "generic";

/** Small stable hash (djb2, base36). Ids survive re-reads of the same content; isomorphic. */
export function stableId(prefix: string, text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return `${prefix}${h.toString(36)}`;
}

/** Validate raw (LLM / DB / static) content and attach stable ids. Returns null when invalid. */
export function normalizeStageContent(raw: unknown): StageContentData | null {
  const parsed = stageContentSchema.safeParse(raw);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const uniq = (id: string) => {
    let out = id;
    for (let i = 2; seen.has(out); i++) out = `${id}-${i}`;
    seen.add(out);
    return out;
  };
  return {
    exercises: parsed.data.exercises.map((e) => ({ ...e, id: uniq(stableId("e", e.title)) })),
    questions: parsed.data.questions.map((q) => ({ ...q, id: uniq(stableId("q", q.q)) })),
  };
}

const LEVEL_HINT: Record<Stage, string> = {
  fundamentals: "a beginner who is new to this skill",
  intermediate: "someone who knows the basics and wants working, real-world fluency",
  applied: "someone ready to build a realistic, portfolio-worthy piece of work",
};

/**
 * Prompt for one stage. No user data is included, so the result is shared across users.
 */
export function stageContentPrompt(node: SkillNode, stage: Stage, locale: Locale) {
  const lang = locale === "he" ? "Hebrew (keep commands, code, and technical terms in English)" : "English";
  const system = [
    "You are a senior engineer writing original hands-on study material for a job-seeker learning platform.",
    "Write original content in your own words. Do not copy text from roadmap.sh, official docs, courses, or any website.",
    "Exercises must be doable on a laptop with free tools, in 20–90 minutes each, with concrete commands or code where useful.",
    "Questions must deepen understanding (why / trade-offs / debugging / scenarios), not trivia. Answers are concise but complete (2–6 sentences).",
    `Write everything in ${lang}.`,
  ].join("\n");
  const user = [
    `Skill: ${node.label} (${node.category}).`,
    `Stage: ${stage}, written for ${LEVEL_HINT[stage]}.`,
    `Topics of this stage: ${node.stages[stage].join("; ")}.`,
    stage === "applied" ? `Suggested project idea: ${node.project.en}` : "",
    "Return 2–3 exercises (each: title, goal, 3–6 steps, expected result, 1–3 hints, 2–4 checklist items, level) and 5–6 questions with answers (each with a kind).",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

/**
 * Deterministic last-resort content built from the roadmap topics, for skills without curated
 * content when the AI is unavailable. Short and honest: it structures self-study, it does not
 * pretend to be expert material.
 */
export function genericStageContent(node: SkillNode, stage: Stage, locale: Locale): StageContentData {
  const he = locale === "he";
  const topics = node.stages[stage];
  const L = node.label;
  const exercises: ExerciseInput[] = [
    {
      title: he ? `מפת נושאים: ${L}` : `Topic map: ${L}`,
      goal: he
        ? "לבנות דף סיכום אישי קצר עם דוגמה מעשית לכל נושא בשלב."
        : "Build a short personal cheat sheet with one working example per topic in this stage.",
      steps: [
        ...topics
          .slice(0, 5)
          .map((t) => (he ? `נסה דוגמה קטנה שמדגימה: ${t}` : `Try a small example that shows: ${t}`)),
        he
          ? "רשום לכל נושא משפט אחד: מה זה ומתי משתמשים בזה."
          : "Write one sentence per topic: what it is and when to use it.",
      ],
      expected: he
        ? "קובץ סיכום עם דוגמה שרצה לכל נושא, ושאלה פתוחה אחת שעוד לא ברורה לך."
        : "A notes file with a working example per topic, plus one open question you still have.",
      hints: [
        he
          ? "התחל מהתיעוד הרשמי, ושאל את מורה ה-AI כשנתקעים."
          : "Start from the official docs and ask the AI tutor when stuck.",
      ],
      checklist: [
        he ? "יש דוגמה שרצה לכל נושא" : "Every topic has a working example",
        he ? "אני יכול להסביר כל נושא בלי להסתכל" : "I can explain each topic without looking",
      ],
      level: stage === "fundamentals" ? "easy" : "medium",
    },
    {
      title: he ? `מיני-פרויקט: ${L}` : `Mini project: ${L}`,
      goal:
        stage === "applied"
          ? node.project[locale]
          : he
            ? "לחבר את נושאי השלב לדבר אחד קטן שעובד."
            : "Combine this stage's topics into one small thing that works.",
      steps: he
        ? [
            "בחר בעיה קטנה מהעבודה או מהיומיום.",
            "תכנן אותה בעזרת נושאי השלב.",
            "ממש, בדוק, ותעד ב-README.",
            "העלה ל-GitHub והדבק כאן את הקישור.",
          ]
        : [
            "Pick a small problem from work or daily life.",
            "Plan it using this stage's topics.",
            "Build it, test it, and document it in a README.",
            "Push to GitHub and paste the link here.",
          ],
      expected: he
        ? "ריפו קטן עם README שמסביר מה בנית ואיך מריצים."
        : "A small repo with a README explaining what you built and how to run it.",
      hints: [he ? "עדיף קטן ועובד על פני גדול וחצי גמור." : "Small and working beats big and half-done."],
      checklist: [
        he ? "הקוד רץ מאפס לפי ה-README" : "Runs from scratch following the README",
        he ? "קישור GitHub נשמר" : "GitHub link saved",
      ],
      level: stage === "applied" ? "hard" : "medium",
    },
  ];
  const questions: QuestionInput[] = topics.slice(0, 5).map((t) => ({
    q: he
      ? `הסבר במילים שלך: ${t}. מתי זה חשוב בעבודה?`
      : `Explain in your own words: ${t}. When does it matter at work?`,
    a: he
      ? `ענה לעצמך בקול ואז השווה לתיעוד הרשמי של ${L}. תשובה טובה מסבירה מה זה, איזו בעיה זה פותר, ודוגמה אחת מהשטח. אפשר לבקש ממורה ה-AI לבדוק את התשובה שלך.`
      : `Answer out loud, then compare with the official ${L} docs. A good answer says what it is, which problem it solves, and gives one real example. You can ask the AI tutor to check your answer.`,
    kind: "concept" as const,
  }));
  while (questions.length < 3) {
    questions.push({
      q: he ? `מה הטעות הנפוצה ביותר של מתחילים ב-${L}?` : `What is the most common beginner mistake with ${L}?`,
      a: he
        ? "חשוב על מקרה שבו משהו לא עבד לך, מה היה הסימפטום ומה תיקן אותו."
        : "Think of a time something failed for you: what was the symptom and what fixed it?",
      kind: "debug",
    });
  }
  return normalizeStageContent({ exercises, questions })!;
}
