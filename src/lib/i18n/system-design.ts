import type { Locale } from "@/lib/i18n";

const en = {
  nav: "System design sections",
  kicker: "System design",
  sections: { method: "Method & cheat sheet", questions: "Questions", ai: "AI-native" },
  title: "System design for frontend and fullstack interviews",
  lead: "A 45-minute method, a cheat sheet of the concepts that come up most, and a frontend variant. Written for senior frontend and fullstack rounds; every section links to its sources.",
  methodTitle: "The method (45 minutes)",
  minutes: "{m} min",
  frontendTitle: "Frontend variant",
  frontendLead:
    "In a frontend round the client is the system. The same flow, with client concerns first (after GreatFrontEnd's RADIO framework):",
  cheatTitle: "Cheat sheet",
  latencyTitle: "Latency orders of magnitude",
  latencyNote: "Rounded; hardware changes these, so quote orders of magnitude only.",
  sources: "Sources",
  seniorTitle: "What a senior answer shows",
  senior: [
    "You drive: you propose the scope and the deep dives instead of waiting for questions.",
    "Every choice comes with its trade-off and the condition under which you'd choose differently.",
    "You think about operation: monitoring, failure, migration, cost.",
  ],
  qTitle: "Practice questions",
  qLead:
    "Frontend, fullstack and backend prompts that come up in interviews. For each: what to clarify, the core of a good answer, a deep dive and a common pitfall. Try it on a timer before opening.",
  kinds: { all: "All", frontend: "Frontend", fullstack: "Fullstack", backend: "Backend", ai: "AI" } as Record<
    string,
    string
  >,
  clarify: "Clarify",
  core: "Core of the answer",
  deepDive: "Deep dive",
  pitfall: "Common pitfall",
  practiceSim: "Practice it out loud in an interview simulation",
  aiTitle: "AI-native engineering",
  aiLead:
    "Topics that now come up in senior rounds at companies building with LLMs: integration, RAG, prompts, evals, cost and latency, safety, agents and governance. For each: why it matters, what to say, and a question to expect.",
  why: "Why it matters",
  ask: "Expect to be asked",
  inThisApp: "In this app",
  inThisAppBody:
    "This product's own AI features follow the same rules: a daily per-user call cap, a DB cache of responses, schema-validated output and a rule-based fallback whenever the model is unavailable.",
  roadmapLinks: "External roadmaps (links only)",
  copyright: "All content here is original; external pages, including roadmap.sh, are linked for reference only.",
};
export type SystemDesignStrings = typeof en;

const he: SystemDesignStrings = {
  nav: "חלקי System Design",
  kicker: "System Design",
  sections: { method: "שיטה ודף עזר", questions: "שאלות", ai: "AI-native" },
  title: "System Design לראיונות frontend ו־fullstack",
  lead: "שיטה ל־45 דקות, דף עזר של המושגים שעולים הכי הרבה, וגרסה ל־frontend. נכתב לראיונות בכירים ב־frontend וב־fullstack; לכל חלק יש קישור למקורות.",
  methodTitle: "השיטה (45 דקות)",
  minutes: "{m} דק׳",
  frontendTitle: "הגרסה ל־frontend",
  frontendLead:
    "בראיון frontend ה־client הוא המערכת. אותה זרימה, עם השיקולים של ה־client קודם (בעקבות מסגרת RADIO של GreatFrontEnd):",
  cheatTitle: "דף עזר",
  latencyTitle: "סדרי גודל של latency",
  latencyNote: "מעוגל; החומרה משנה את המספרים, אז מצטטים רק סדרי גודל.",
  sources: "מקורות",
  seniorTitle: "מה תשובה של בכיר מראה",
  senior: [
    "את/ה מוביל/ה: מציע/ה את ההיקף ואת הצלילות לעומק במקום לחכות לשאלות.",
    "לכל בחירה יש trade-off ותנאי שבו היית בוחר/ת אחרת.",
    "חשיבה על תפעול: ניטור, כשלים, מיגרציה, עלות.",
  ],
  qTitle: "שאלות לתרגול",
  qLead:
    "שאלות frontend, fullstack ו־backend שעולות בראיונות. לכל אחת: מה לברר, הליבה של תשובה טובה, צלילה לעומק וטעות נפוצה. כדאי לנסות עם טיימר לפני שפותחים.",
  kinds: { all: "הכול", frontend: "Frontend", fullstack: "Fullstack", backend: "Backend", ai: "AI" },
  clarify: "לברר",
  core: "ליבת התשובה",
  deepDive: "צלילה לעומק",
  pitfall: "טעות נפוצה",
  practiceSim: "לתרגל בקול בסימולציית ראיון",
  aiTitle: "הנדסה AI-native",
  aiLead:
    "נושאים שעולים היום בראיונות בכירים בחברות שבונות עם LLM: שילוב במוצר, RAG, prompts, evals, עלות ו־latency, אבטחה, agents וממשל. לכל נושא: למה זה חשוב, מה להגיד, ושאלה שכדאי לצפות לה.",
  why: "למה זה חשוב",
  ask: "צפוי שישאלו",
  inThisApp: "באפליקציה הזו",
  inThisAppBody:
    "יכולות ה־AI של המוצר הזה עובדות לפי אותם כללים: מכסה יומית של קריאות לכל משתמש, cache של תשובות ב־DB, פלט שנבדק מול schema, ו־fallback מבוסס חוקים כשהמודל לא זמין.",
  roadmapLinks: "מסלולים חיצוניים (קישורים בלבד)",
  copyright: "התוכן כאן נכתב במיוחד; עמודים חיצוניים, כולל roadmap.sh, מקושרים להפניה בלבד.",
};

export const systemDesignStrings = (locale: Locale | string): SystemDesignStrings => (locale === "he" ? he : en);
