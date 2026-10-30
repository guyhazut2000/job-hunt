/** Interview simulation (docs/interview-sim.md): shared types. */
export const MODES = ["HR", "TECH", "PROBLEM"] as const;
export type InterviewMode = (typeof MODES)[number];
export const isMode = (v: unknown): v is InterviewMode => MODES.includes(v as InterviewMode);

export type Lang = "he" | "en";
export type PlanSource = "ai" | "offline" | "limited";

export interface PlannedQuestion {
  /** The main question, asked as-is. */
  q: string;
  /** Pre-planned follow-ups (asked one at a time, no extra AI call). */
  followUps: string[];
  /** What a strong answer should show (one short phrase). */
  focus: string;
  /** Keywords / ideas a good answer mentions; used by the offline grader. */
  expected: string[];
  /** PROBLEM mode: id from src/lib/algo/problems.ts. */
  problemId?: string;
}

/** Everything the planner knows about the target (job / application + company context). */
export interface InterviewContext {
  title: string;
  company: string;
  description: string;
  techStack: string[];
  /** Hiring process stages (official or the user's own), in order. */
  stages: { kind: string; title: string }[];
  /** The user's concepts worth asking about (company concepts first). */
  concepts: string[];
  /** Short candidate background (headline + recent roles), for "tell me about yourself" style prompts. */
  background: string;
}

export interface Turn {
  role: "interviewer" | "candidate";
  kind: "question" | "followup" | "answer" | "skip";
  content: string;
  questionIndex: number;
}

export interface Dimension {
  key: string;
  label: string;
  /** 1–5 */
  score: number;
  note: string;
}

export interface Feedback {
  summary: string;
  dimensions: Dimension[];
  perQuestion: { index: number; strength: string; improve: string }[];
  improvements: string[];
}
