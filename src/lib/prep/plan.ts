import { z } from "zod";
import { isStageKind, type StageKind } from "@/lib/hiring/kinds";

/**
 * Interview prep page per application (#93) — pure logic (no DB, no LLM).
 *
 * - Stages: the user's own hiring process for the company → the official one → a default list.
 * - Topics ("ds:<id>" / "pattern:<id>") suggested from the job's tech stack + description.
 * - Stories: the user's "הסיפור שלי" work stories, ranked by overlap with the suggested topics.
 * - Questions to ask the company: a static bank per stage kind.
 * - Summary: a template overview; the AI version (feature "interview_prep") is validated here.
 * - Debrief stats for /stats.
 */

export type PrepLang = "he" | "en";

export const prepStageSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.string().max(40),
  title: z.string().trim().min(1).max(120),
  date: z.string().max(40).nullable().optional(),
  done: z.boolean().default(false),
  note: z.string().max(1000).default(""),
});
export type PrepStage = z.infer<typeof prepStageSchema>;
export const prepStagesSchema = z.array(prepStageSchema).max(15);

export const prepQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(3).max(300),
  done: z.boolean().default(false),
});
export type PrepQuestion = z.infer<typeof prepQuestionSchema>;
export const prepQuestionsSchema = z.array(prepQuestionSchema).max(30);

export interface PrepSummary {
  text: string;
  focus: string[];
  source: "ai" | "template" | "limited";
  at: string;
}
export const prepSummarySchema = z.object({
  text: z.string().min(1).max(2000),
  focus: z.array(z.string().max(200)).max(8),
  source: z.enum(["ai", "template", "limited"]),
  at: z.string(),
});

export const parseStages = (v: unknown): PrepStage[] => {
  const r = prepStagesSchema.safeParse(v);
  return r.success ? r.data : [];
};
export const parseQuestions = (v: unknown): PrepQuestion[] => {
  const r = prepQuestionsSchema.safeParse(v);
  return r.success ? r.data : [];
};
export const parseSummary = (v: unknown): PrepSummary | null => {
  const r = prepSummarySchema.safeParse(v);
  return r.success ? r.data : null;
};

let seq = 0;
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++ % 1000).toString(36)}`;

const DEFAULT_KINDS: StageKind[] = ["phone_screen", "technical", "coding", "manager", "hr"];
const CODING_KINDS = new Set<string>(["technical", "coding", "home_assignment", "onsite", "assessment"]);

export function defaultStages(
  process: Array<{ kind: string; title: string }> | null | undefined,
  labelFor: (kind: string) => string,
  interviewAt?: Date | null,
): PrepStage[] {
  const src = process?.length
    ? process.map((s) => ({ kind: s.kind, title: s.title || labelFor(s.kind) }))
    : DEFAULT_KINDS.map((k) => ({ kind: k, title: labelFor(k) }));
  return src.slice(0, 15).map((s, i) => ({
    id: `s${i + 1}`,
    kind: s.kind,
    title: s.title.slice(0, 120),
    date: i === 0 && interviewAt ? interviewAt.toISOString().slice(0, 10) : null,
    done: false,
    note: "",
  }));
}

/** Keyword → DS&A topic keys. Matched against tech stack + title + description (lowercase). */
const TOPIC_RULES: Array<{ re: RegExp; topics: string[] }> = [
  {
    re: /\b(graph|network|routing|map(s)?|social|dependency|dependencies)\b/,
    topics: ["ds:graph", "pattern:graph-traversal", "pattern:topo-sort"],
  },
  { re: /\b(cache|caching|redis|memcached|lookup|dedup)/, topics: ["ds:hash-map", "pattern:hashing"] },
  { re: /\b(search|autocomplete|typeahead|elastic|lucene|text)\b/, topics: ["ds:trie", "pattern:binary-search"] },
  {
    re: /\b(stream|streaming|real[- ]?time|kafka|events?|scheduling|scheduler|priority)\b/,
    topics: ["ds:heap", "ds:queue", "pattern:sliding-window"],
  },
  {
    re: /\b(time[- ]?series|metrics|monitoring|analytics|logs?)\b/,
    topics: ["pattern:sliding-window", "pattern:prefix-sums"],
  },
  { re: /\b(calendar|booking|intervals?|reservations?)\b/, topics: ["pattern:intervals", "ds:sorted-map"] },
  {
    re: /\b(security|cyber|network security|firewall|packets?)\b/,
    topics: ["ds:trie", "ds:hash-set", "pattern:bit-manipulation"],
  },
  { re: /\b(embedded|firmware|c\+\+|low[- ]level|kernel)\b/, topics: ["pattern:bit-manipulation", "ds:linked-list"] },
  {
    re: /\b(optimi[sz]ation|pricing|algorithmic|ml|machine learning|recommend)/,
    topics: ["pattern:dp-1d", "pattern:greedy"],
  },
  { re: /\b(tree|hierarch|dom|file ?system|json)\b/, topics: ["ds:tree", "pattern:tree-traversal"] },
  { re: /\b(frontend|react|ui|browser)\b/, topics: ["ds:tree", "ds:stack"] },
];

/** Everyone gets these for a coding round. */
const CORE_TOPICS = ["ds:array", "ds:hash-map", "pattern:two-pointers", "pattern:sliding-window"];

export function suggestTopics(
  job: { title?: string | null; description?: string | null; techStack?: string[] | null },
  stageKinds: string[],
  max = 8,
): string[] {
  const text = [job.title ?? "", ...(job.techStack ?? []), (job.description ?? "").slice(0, 6000)]
    .join(" ")
    .toLowerCase();
  const out: string[] = [];
  const add = (t: string) => {
    if (!out.includes(t)) out.push(t);
  };
  for (const r of TOPIC_RULES) if (r.re.test(text)) r.topics.forEach(add);
  const coding = stageKinds.some((k) => CODING_KINDS.has(k));
  if (coding || out.length === 0) CORE_TOPICS.forEach(add);
  return out.slice(0, max);
}

export interface StoryLite {
  id: string;
  kind: string;
  itemId: string;
  situation: string;
  built: string;
}

/** User stories ranked: exact topic match first, then text overlap with job tech; at most `max`. */
export function suggestStories(stories: StoryLite[], topics: string[], techStack: string[] = [], max = 4): string[] {
  const tech = techStack.map((t) => t.toLowerCase()).filter((t) => t.length > 1);
  const scored = stories.map((s) => {
    let score = topics.includes(`${s.kind}:${s.itemId}`) ? 10 : 0;
    const txt = `${s.situation} ${s.built}`.toLowerCase();
    for (const t of tech) if (txt.includes(t)) score += 2;
    return { id: s.id, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.id);
}

const Q: Partial<Record<"general" | StageKind, { he: string[]; en: string[] }>> = {
  general: {
    he: ["איך נראה יום עבודה טיפוסי בצוות?", "מה ייחשב הצלחה בתפקיד אחרי 3 חודשים?"],
    en: ["What does a typical day on the team look like?", "What would success in this role look like after 3 months?"],
  },
  phone_screen: {
    he: ['איך בנוי תהליך הגיוס ומה הלו"ז הצפוי?', "למה המשרה פתוחה – צוות חדש או החלפה?"],
    en: ["What are the stages and the expected timeline?", "Why is the role open – a new team or a backfill?"],
  },
  technical: {
    he: ["מה הסטאק והאתגר הטכני הגדול כרגע?", "איך נראה תהליך ה-code review וה-deploy?"],
    en: [
      "What's the stack and the biggest technical challenge right now?",
      "What do code review and deploys look like?",
    ],
  },
  home_assignment: {
    he: ["על מה הכי חשוב לכם שאשים דגש במטלה?", "האם תהיה שיחת review על הפתרון?"],
    en: ["What should I focus on most in the assignment?", "Will there be a review call about my solution?"],
  },
  coding: {
    he: ["באיזו שפה ובאיזו סביבה עובדים בראיון הקוד?", "מה חשוב לכם יותר – פתרון עובד או הסבר הדרך?"],
    en: [
      "Which language / environment is used in the coding round?",
      "What matters more to you – a working solution or the reasoning?",
    ],
  },
  system_design: {
    he: ["מה סדרי הגודל של התעבורה והנתונים במערכת?", "מה החוב הטכני שהכי מפריע לצוות?"],
    en: ["What traffic and data scale does the system handle?", "Which tech debt bothers the team most?"],
  },
  team: {
    he: ["איך הצוות מחלק עבודה ומתעדף?", "מה הדבר שהכי אהבתם לאחרונה בעבודה כאן?"],
    en: ["How does the team split and prioritise work?", "What's something you enjoyed recently working here?"],
  },
  onsite: {
    he: ["איך הצוות מתמודד עם תקלות בפרודקשן ו-on-call?", "איך מתקבלות החלטות ארכיטקטורה?"],
    en: ["How does the team handle production incidents and on-call?", "How are architecture decisions made?"],
  },
  hr: {
    he: ["איך נראים מסלולי קידום ומשוב?", "מה מדיניות העבודה ההיברידית?"],
    en: ["What do growth paths and feedback look like?", "What's the hybrid / remote policy?"],
  },
  manager: {
    he: ["מה הציפיות שלך ממני ברבעון הראשון?", "איך אתה נותן משוב לצוות?"],
    en: ["What would you expect from me in the first quarter?", "How do you give feedback to the team?"],
  },
};

export function defaultQuestions(stageKinds: string[], lang: PrepLang, max = 8): PrepQuestion[] {
  const keys = ["general", ...stageKinds.filter((k, i, a) => a.indexOf(k) === i)];
  const texts: string[] = [];
  for (const k of keys) {
    const bank = k === "general" ? Q.general : isStageKind(k) ? Q[k] : undefined;
    for (const t of bank?.[lang] ?? []) if (!texts.includes(t)) texts.push(t);
  }
  return texts.slice(0, max).map((text, i) => ({ id: `q${i + 1}`, text, done: false }));
}

export interface PrepFacts {
  title: string;
  company: string;
  techStack: string[];
  stages: string[];
  /** First ~1500 chars of the job description (only from the posting itself). */
  description: string | null;
  topics: string[];
}

export function templateSummary(f: PrepFacts, lang: PrepLang, at = new Date()): PrepSummary {
  const tech = f.techStack.slice(0, 6).join(", ");
  const stages = f.stages.join(" → ");
  const text =
    lang === "he"
      ? [
          `מתכוננים לראיון לתפקיד ${f.title} ב-${f.company}.`,
          stages ? `שלבים צפויים: ${stages}.` : "",
          tech ? `טכנולוגיות מהמשרה: ${tech}.` : "",
          "הכינו 2–3 סיפורים מהעבודה, חזרו על הנושאים שמסומנים למטה, ובחרו שאלות לשאול אותם.",
        ]
          .filter(Boolean)
          .join(" ")
      : [
          `Preparing for the ${f.title} interview at ${f.company}.`,
          stages ? `Expected stages: ${stages}.` : "",
          tech ? `Tech from the posting: ${tech}.` : "",
          "Prepare 2–3 work stories, review the topics marked below, and pick questions to ask them.",
        ]
          .filter(Boolean)
          .join(" ");
  const focus = f.techStack.slice(0, 4);
  return { text, focus, source: "template", at: at.toISOString() };
}

export const summaryAiSchema = z.object({
  overview: z.string().min(40).max(1200),
  focus: z.array(z.string().min(2).max(160)).min(1).max(6),
});

export function summaryPrompt(f: PrepFacts, lang: PrepLang) {
  const language = lang === "he" ? "Hebrew" : "English";
  return [
    {
      role: "system" as const,
      content:
        `You help a candidate prepare for a job interview. Write in ${language}. Use ONLY the facts given ` +
        "(the job posting text and the stages). Do not invent company facts, numbers, salaries or people. " +
        'Return JSON {"overview": 2-4 sentences on what this role likely emphasises, "focus": 3-5 short bullet points to prepare}.',
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        title: f.title,
        company: f.company,
        techStack: f.techStack.slice(0, 15),
        stages: f.stages,
        description: (f.description ?? "").slice(0, 1500),
      }),
    },
  ];
}

const PLACEHOLDER = /\[[^\]]{1,40}\]|\{\{|<[a-z_]+>|XXX/i;

/** Accept the AI summary only if well-formed, without placeholders, and it names the company or role. */
export function validateAiSummary(raw: unknown, f: PrepFacts, at = new Date()): PrepSummary | null {
  const r = summaryAiSchema.safeParse(raw);
  if (!r.success) return null;
  const { overview, focus } = r.data;
  if (PLACEHOLDER.test(overview) || focus.some((x) => PLACEHOLDER.test(x))) return null;
  const low = overview.toLowerCase();
  const mentions =
    low.includes(f.company.toLowerCase()) ||
    f.title
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length > 3 && low.includes(w));
  if (!mentions) return null;
  return { text: overview.trim(), focus: focus.map((x) => x.trim()), source: "ai", at: at.toISOString() };
}

export const debriefSchema = z.object({
  applicationId: z.string().min(1),
  stageKind: z.string().min(1).max(40),
  happenedAt: z.coerce.date(),
  rating: z.coerce.number().int().min(1).max(5),
  asked: z.string().max(3000).default(""),
  wentWell: z.string().max(3000).default(""),
  improve: z.string().max(3000).default(""),
  outcome: z.enum(["pending", "passed", "failed"]).default("pending"),
});
export type DebriefInput = z.infer<typeof debriefSchema>;

export interface DebriefLite {
  stageKind: string;
  rating: number;
  outcome: string;
  improve: string;
}

export interface DebriefStats {
  total: number;
  avgRating: number | null;
  passed: number;
  failed: number;
  pending: number;
  byStage: Array<{ kind: string; count: number; avgRating: number; passed: number; decided: number }>;
  /** Most recent non-empty "what to improve" notes (newest first in input order). */
  improveNotes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function debriefStats(rows: DebriefLite[]): DebriefStats {
  const by = new Map<string, { count: number; sum: number; passed: number; decided: number }>();
  let sum = 0;
  let passed = 0;
  let failed = 0;
  for (const r of rows) {
    sum += r.rating;
    if (r.outcome === "passed") passed++;
    if (r.outcome === "failed") failed++;
    const b = by.get(r.stageKind) ?? { count: 0, sum: 0, passed: 0, decided: 0 };
    b.count++;
    b.sum += r.rating;
    if (r.outcome === "passed") b.passed++;
    if (r.outcome !== "pending") b.decided++;
    by.set(r.stageKind, b);
  }
  return {
    total: rows.length,
    avgRating: rows.length ? round1(sum / rows.length) : null,
    passed,
    failed,
    pending: rows.length - passed - failed,
    byStage: [...by.entries()]
      .map(([kind, b]) => ({
        kind,
        count: b.count,
        avgRating: round1(b.sum / b.count),
        passed: b.passed,
        decided: b.decided,
      }))
      .sort((a, b) => b.count - a.count),
    improveNotes: rows
      .map((r) => r.improve.trim())
      .filter(Boolean)
      .slice(0, 3),
  };
}
