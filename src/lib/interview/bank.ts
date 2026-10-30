/**
 * Original offline question bank for the interview simulation. Used when AI is off or the daily
 * limit is reached, and to fill gaps in an AI plan. Nothing here is copied from other sites.
 */
import type { Lang } from "./types";

type B = Record<Lang, string>;
export const t = (b: B, lang: Lang) => b[lang] ?? b.en;

export interface HrItem {
  id: string;
  q: B;
  followUps: B[];
  focus: B;
}

/** Behavioral questions. `{company}` / `{title}` are filled in from the target. */
export const HR_BANK: HrItem[] = [
  {
    id: "intro",
    q: {
      he: "ספר/י לי על עצמך ועל הדרך שהובילה אותך לתפקיד {title}.",
      en: "Tell me about yourself and what led you to the {title} role.",
    },
    followUps: [
      {
        he: "איזה פרויקט מהשנה האחרונה הכי מייצג אותך? למה?",
        en: "Which project from the last year best represents you? Why?",
      },
    ],
    focus: { he: "סיפור קצר וממוקד שמתחבר לתפקיד", en: "A short, focused story that connects to the role" },
  },
  {
    id: "why-company",
    q: { he: "למה דווקא {company}? מה מושך אותך בתפקיד הזה?", en: "Why {company}? What draws you to this role?" },
    followUps: [
      {
        he: "מה לדעתך יהיה האתגר הכי גדול שלך ב-90 הימים הראשונים?",
        en: "What do you think your biggest challenge would be in the first 90 days?",
      },
    ],
    focus: {
      he: "היכרות עם החברה וחיבור אישי לתפקיד",
      en: "Knowledge of the company and a personal fit with the role",
    },
  },
  {
    id: "conflict",
    q: {
      he: "ספר/י על פעם שהיית בחילוקי דעות עם עמית או מנהל. מה עשית?",
      en: "Tell me about a time you disagreed with a teammate or manager. What did you do?",
    },
    followUps: [{ he: "במבט לאחור, מה היית עושה אחרת?", en: "Looking back, what would you do differently?" }],
    focus: { he: "הקשבה, נימוקים ענייניים ותוצאה", en: "Listening, reasoned arguments and an outcome" },
  },
  {
    id: "failure",
    q: {
      he: "ספר/י על טעות או כישלון מקצועי ומה למדת ממנו.",
      en: "Tell me about a mistake or failure at work and what you learned.",
    },
    followUps: [
      { he: "מה שינית בדרך העבודה שלך בעקבות זה?", en: "What did you change in how you work because of it?" },
    ],
    focus: { he: "לקיחת אחריות ולמידה מוחשית", en: "Ownership and a concrete lesson" },
  },
  {
    id: "proud",
    q: { he: "על איזה הישג מקצועי את/ה הכי גאה?", en: "What professional achievement are you most proud of?" },
    followUps: [
      { he: "מה היה החלק שלך בדיוק, ומה עשו אחרים?", en: "What exactly was your part, and what did others do?" },
    ],
    focus: { he: "תרומה אישית ברורה ותוצאה מדידה", en: "A clear personal contribution and a measurable result" },
  },
  {
    id: "deadline",
    q: {
      he: "ספר/י על פעם שעבדת תחת לחץ זמנים חזק. איך תעדפת?",
      en: "Tell me about a time you worked under a tight deadline. How did you prioritise?",
    },
    followUps: [{ he: "על מה ויתרת, ואיך תקשרת את זה?", en: "What did you drop, and how did you communicate it?" }],
    focus: { he: "תעדוף, תקשורת ועמידה ביעד", en: "Prioritisation, communication and delivery" },
  },
  {
    id: "learn-fast",
    q: {
      he: "ספר/י על פעם שהיית צריך/ה ללמוד טכנולוגיה או תחום חדש מהר.",
      en: "Tell me about a time you had to learn a new technology or domain quickly.",
    },
    followUps: [{ he: "איך ידעת שאת/ה כבר מספיק טוב/ה בזה?", en: "How did you know you were good enough at it?" }],
    focus: { he: "שיטת למידה ותוצאה", en: "A learning method and its outcome" },
  },
  {
    id: "feedback",
    q: {
      he: "ספר/י על פידבק קשה שקיבלת ואיך הגבת.",
      en: "Tell me about tough feedback you received and how you responded.",
    },
    followUps: [{ he: "איך נראה השינוי חודש אחרי?", en: "What did the change look like a month later?" }],
    focus: { he: "פתיחות לביקורת ושינוי בפועל", en: "Openness to criticism and actual change" },
  },
];

/** Targeted follow-ups when a behavioral answer misses a STAR part. */
export const STAR_FOLLOWUPS: Record<"s" | "t" | "a" | "r", B> = {
  s: {
    he: "תן/י קצת הקשר: איפה זה היה ומה היה המצב?",
    en: "Give me some context: where was this and what was the situation?",
  },
  t: { he: "מה בדיוק היה התפקיד או היעד שלך באותו מצב?", en: "What exactly was your responsibility or goal there?" },
  a: { he: "מה את/ה עשית, צעד אחרי צעד? (לא הצוות, את/ה)", en: "What did you do, step by step? (You, not the team.)" },
  r: {
    he: "ומה הייתה התוצאה? יש מספר או שינוי שאפשר למדוד?",
    en: "And what was the result? Is there a number or change you can measure?",
  },
};

/** Generic follow-up when an answer is very short. */
export const SHORT_FOLLOWUP: B = {
  he: "אפשר להרחיב קצת? תן/י דוגמה קונקרטית.",
  en: "Can you expand a bit? Give me a concrete example.",
};

export const TECH_TEMPLATES = {
  explain: {
    he: "הסבר/י את {x}: איזו בעיה זה פותר ואיך זה עובד מתחת למכסה?",
    en: "Explain {x}: what problem does it solve and how does it work under the hood?",
  },
  experience: {
    he: "ספר/י על מקרה אמיתי שבו השתמשת ב-{x}. מה היה קשה?",
    en: "Tell me about a real case where you used {x}. What was hard?",
  },
  followTradeoff: {
    he: "מתי לא היית בוחר/ת ב-{x}? מה החלופה?",
    en: "When would you not choose {x}? What's the alternative?",
  },
  followDebug: {
    he: "איך היית מאתר/ת בעיית ביצועים שקשורה ל-{x}?",
    en: "How would you track down a performance problem involving {x}?",
  },
  focus: {
    he: "הבנה של העקרונות, דוגמה ושיקולי trade-off",
    en: "Understanding of the principles, an example and trade-offs",
  },
  systemDesign: {
    he: "איך היית מתכנן/ת שירות מרכזי ב-{company} שצריך לשרת פי 10 משתמשים? תאר/י רכיבים וזרימת נתונים.",
    en: "How would you design a core service at {company} that must handle 10x users? Describe components and data flow.",
  },
  systemDesignFollow: {
    he: "איפה צוואר הבקבוק הראשון, ואיך היית מנטר/ת אותו?",
    en: "Where is the first bottleneck, and how would you monitor it?",
  },
  systemDesignFocus: {
    he: "פירוק לרכיבים, סקייל ושיקולי עקביות",
    en: "Breaking into components, scale and consistency trade-offs",
  },
};

export const PROBLEM_TEMPLATES = {
  ask: {
    he: "{statement}\n\nמגבלות: {constraints}\n\nתאר/י בקול איך היית ניגש/ת: איזה pattern, למה, ומה הסיבוכיות.",
    en: "{statement}\n\nConstraints: {constraints}\n\nTalk me through your approach: which pattern, why, and the complexity.",
  },
  followComplexity: {
    he: "מה סיבוכיות הזמן והזיכרון של הפתרון שלך?",
    en: "What are the time and space complexity of your solution?",
  },
  followEdges: {
    he: "אילו מקרי קצה היית בודק/ת לפני שאת/ה כותב/ת קוד?",
    en: "Which edge cases would you check before writing code?",
  },
  focus: {
    he: "זיהוי ה-pattern, נימוק, סיבוכיות ומקרי קצה",
    en: "Spotting the pattern, reasoning, complexity and edge cases",
  },
};

export const fill = (s: string, vars: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
