/**
 * Hiring-manager round (#119): a bank of behavioral questions a hiring manager typically asks a senior engineer,
 * the seniority signals each one probes, and questions to ask the manager back. The question wording follows
 * common public sources (Amazon Leadership Principles, Google re:Work structured interviewing, StaffEng, MIT CAPD
 * STAR guide, Tech Interview Handbook) — no question here is presented as "asked at" any specific company.
 */

export type Lang = "he" | "en";
type T = Record<Lang, string>;

export interface Source {
  id: string;
  label: string;
  url: string;
}

export const MANAGER_SOURCES = {
  star: {
    id: "star",
    label: "MIT CAPD: The STAR method for behavioral interviews",
    url: "https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/",
  },
  amazon: {
    id: "amazon",
    label: "Amazon: Leadership Principles",
    url: "https://www.amazon.jobs/content/en/our-workplace/leadership-principles",
  },
  rework: {
    id: "rework",
    label: "Google re:Work: Use structured interviewing",
    url: "https://rework.withgoogle.com/en/guides/hiring-use-structured-interviewing",
  },
  staffeng: {
    id: "staffeng",
    label: "StaffEng: Staff archetypes",
    url: "https://staffeng.com/guides/staff-archetypes/",
  },
  tihBehavioral: {
    id: "tihBehavioral",
    label: "Tech Interview Handbook: Behavioral interviews",
    url: "https://www.techinterviewhandbook.org/behavioral-interview/",
  },
  tihFinal: {
    id: "tihFinal",
    label: "Tech Interview Handbook: Questions to ask at the end",
    url: "https://www.techinterviewhandbook.org/final-questions/",
  },
} satisfies Record<string, Source>;
export type SourceId = keyof typeof MANAGER_SOURCES;

/** What a senior answer shows. The checker below looks for each one in the user's own text. */
export const SIGNALS = ["ownership", "scope", "metric", "tradeoff", "influence", "reflection", "firstPerson"] as const;
export type SignalId = (typeof SIGNALS)[number];

export const SIGNAL_LABEL: Record<SignalId, T> = {
  ownership: { he: "בעלות – מה את/ה הובלת או החלטת", en: "Ownership — what you led or decided" },
  scope: { he: "היקף – צוותים, משתמשים, פרודקשן", en: "Scope — teams, users, production" },
  metric: { he: "תוצאה מדידה – מספר, אחוז, זמן", en: "A measurable result — a number, %, time" },
  tradeoff: { he: "שיקולים וחלופות – למה כך ולא אחרת", en: "Trade-offs — why this and not an alternative" },
  influence: {
    he: "השפעה בלי סמכות – שכנוע, יישור קו, חניכה",
    en: "Influence without authority — aligning, convincing, mentoring",
  },
  reflection: { he: "רפלקציה – מה למדת / היית עושה אחרת", en: "Reflection — what you learned or would change" },
  firstPerson: { he: "גוף ראשון – מה *את/ה* עשית, לא רק \"אנחנו\"", en: "First person — what *you* did, not only \"we\"" },
};

export type Level = "all" | "senior" | "staff";

export interface ManagerQuestion {
  id: string;
  q: T;
  /** What the manager is trying to learn. */
  probes: T;
  signals: SignalId[];
  level: Level;
  source: SourceId;
}

export const QUESTIONS: ManagerQuestion[] = [
  {
    id: "ownership-beyond",
    q: {
      he: "ספר/י על פעם שלקחת אחריות על בעיה שלא הייתה באחריותך.",
      en: "Tell me about a time you took ownership of a problem that wasn't yours.",
    },
    probes: { he: "בעלות ויוזמה מעבר להגדרת התפקיד", en: "Ownership and initiative beyond your job description" },
    signals: ["ownership", "scope", "metric"],
    level: "all",
    source: "amazon",
  },
  {
    id: "disagree",
    q: {
      he: "ספר/י על מחלוקת טכנית עם עמית או מנהל. איך היא הסתיימה?",
      en: "Tell me about a technical disagreement with a peer or your manager. How did it end?",
    },
    probes: { he: "\"Disagree and commit\" – לחלוק בכבוד ואז להתחייב", en: "Disagree and commit — push back respectfully, then commit" },
    signals: ["influence", "tradeoff", "reflection"],
    level: "all",
    source: "amazon",
  },
  {
    id: "failure",
    q: {
      he: "ספר/י על כישלון או טעות שלך בפרודקשן. מה למדת?",
      en: "Tell me about a failure or a mistake of yours that reached production. What did you learn?",
    },
    probes: { he: "כנות, לקיחת אחריות ולמידה", en: "Honesty, accountability and learning" },
    signals: ["ownership", "reflection", "firstPerson"],
    level: "all",
    source: "tihBehavioral",
  },
  {
    id: "deliver-pressure",
    q: {
      he: "ספר/י על פרויקט עם דדליין קשוח. מה ויתרת עליו ולמה?",
      en: "Tell me about a project with a hard deadline. What did you cut, and why?",
    },
    probes: { he: "תיעדוף ושיקולי scope מול איכות", en: "Prioritisation and scope-vs-quality trade-offs" },
    signals: ["tradeoff", "metric", "ownership"],
    level: "all",
    source: "amazon",
  },
  {
    id: "dive-deep",
    q: {
      he: "ספר/י על באג או תקלה קשים במיוחד שחקרת עד הסוף.",
      en: "Tell me about a particularly hard bug or incident you dug into to the root cause.",
    },
    probes: { he: "\"Dive deep\" – עומק טכני ושיטתיות", en: "Dive deep — technical depth and method" },
    signals: ["firstPerson", "metric", "reflection"],
    level: "all",
    source: "amazon",
  },
  {
    id: "ambiguity",
    q: {
      he: "ספר/י על משימה שהתחילה עמומה מאוד. איך הפכת אותה לתוכנית?",
      en: "Tell me about a task that started very ambiguous. How did you turn it into a plan?",
    },
    probes: { he: "עבודה בעמימות והגדרת בעיה", en: "Handling ambiguity and framing the problem" },
    signals: ["ownership", "tradeoff", "scope"],
    level: "senior",
    source: "rework",
  },
  {
    id: "influence-no-authority",
    q: {
      he: "ספר/י על פעם ששכנעת צוות אחר לשנות כיוון בלי שהייתה לך סמכות עליו.",
      en: "Tell me about a time you got another team to change direction without having authority over them.",
    },
    probes: { he: "השפעה רוחבית – סימן מרכזי לבכירות", en: "Cross-team influence — a core senior signal" },
    signals: ["influence", "scope", "tradeoff"],
    level: "senior",
    source: "staffeng",
  },
  {
    id: "mentoring",
    q: {
      he: "ספר/י על מישהו שחנכת. מה השתנה אצלו בעקבות זה?",
      en: "Tell me about someone you mentored. What changed for them?",
    },
    probes: { he: "\"Hire and develop the best\" – הצמחת אחרים", en: "Hire and develop the best — growing others" },
    signals: ["influence", "metric", "reflection"],
    level: "senior",
    source: "amazon",
  },
  {
    id: "tech-decision",
    q: {
      he: "ספר/י על החלטה ארכיטקטונית שקיבלת. אילו חלופות שקלת?",
      en: "Tell me about an architecture decision you made. Which alternatives did you consider?",
    },
    probes: { he: "שיקול דעת טכני ותיעוד החלטות", en: "Technical judgement and documenting decisions" },
    signals: ["tradeoff", "ownership", "scope"],
    level: "senior",
    source: "staffeng",
  },
  {
    id: "tech-debt",
    q: {
      he: "איך שכנעת את המוצר / ההנהלה להשקיע בחוב טכני?",
      en: "How did you convince product or leadership to invest in tech debt?",
    },
    probes: { he: "חיבור עבודה טכנית לערך עסקי", en: "Tying technical work to business value" },
    signals: ["influence", "metric", "tradeoff"],
    level: "senior",
    source: "staffeng",
  },
  {
    id: "customer",
    q: {
      he: "ספר/י על פעם ששינית תוכנית בגלל משוב של לקוחות או משתמשים.",
      en: "Tell me about a time you changed a plan because of customer or user feedback.",
    },
    probes: { he: "\"Customer obsession\" – מתחילים מהמשתמש", en: "Customer obsession — working backwards from the user" },
    signals: ["scope", "metric", "tradeoff"],
    level: "all",
    source: "amazon",
  },
  {
    id: "raise-bar",
    q: {
      he: "ספר/י על תהליך או סטנדרט הנדסי שהכנסת לצוות.",
      en: "Tell me about an engineering process or standard you introduced to the team.",
    },
    probes: { he: "\"Insist on the highest standards\" – הרמת הרף לצוות", en: "Insist on the highest standards — raising the bar for the team" },
    signals: ["ownership", "influence", "metric"],
    level: "senior",
    source: "amazon",
  },
  {
    id: "org-direction",
    q: {
      he: "ספר/י על יוזמה טכנית שהשפיעה על כמה צוותים או על כל הארגון.",
      en: "Tell me about a technical initiative that affected several teams or the whole org.",
    },
    probes: { he: "השפעה ברמת ארגון – רמת Staff", en: "Org-level impact — Staff level" },
    signals: ["scope", "influence", "ownership", "metric"],
    level: "staff",
    source: "staffeng",
  },
  {
    id: "why-us",
    q: {
      he: "למה התפקיד הזה ולמה עכשיו? מה את/ה מחפש/ת בצעד הבא?",
      en: "Why this role, and why now? What are you looking for in your next step?",
    },
    probes: { he: "מוטיבציה והתאמה – לא שאלת STAR, אבל כמעט תמיד נשאלת", en: "Motivation and fit — not STAR, but almost always asked" },
    signals: ["scope", "reflection"],
    level: "all",
    source: "rework",
  },
];
export const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

/** Questions to ask the hiring manager — quoted from the Tech Interview Handbook "final questions" list. */
export const ASK_MANAGER: { group: T; questions: string[] }[] = [
  {
    group: { he: "על התפקיד", en: "About the role" },
    questions: [
      "What would be the most important problem you would want me to solve if I joined your team?",
      "What does success look like for your team/project?",
      "What would I work on if I joined this team and who would I work most closely with?",
    ],
  },
  {
    group: { he: "על הצוות והניהול", en: "Team and management" },
    questions: [
      "What is your team's biggest challenge right now?",
      "How do you measure individual performance?",
      "Two senior team members disagree over a technical issue. How do you handle it?",
      "How do you train/ramp up engineers who are new to the team?",
      "What role does the manager play in making technical decisions?",
    ],
  },
  {
    group: { he: "על העבודה הטכנית", en: "Technical work" },
    questions: [
      "How does the engineering team balance resources between feature requests and engineering maintenance?",
      "What is the most costly technical decision made early on that the company is living with now?",
      "How do you evaluate new technologies? Who makes the final decisions?",
    ],
  },
];

// ---------- STAR answers ----------

export const STAR_FIELDS = ["situation", "task", "action", "result"] as const;
export type StarField = (typeof STAR_FIELDS)[number];
export type StarFields = Record<StarField, string>;
export const STAR_MAX = 800;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const sentence = (s: string) => {
  const t = clean(s).replace(/[.!?]+$/, "");
  return t ? `${t}.` : "";
};

export const normalizeStar = (f: Partial<StarFields>): StarFields => ({
  situation: clean(f.situation ?? ""),
  task: clean(f.task ?? ""),
  action: clean(f.action ?? ""),
  result: clean(f.result ?? ""),
});
export const isEmptyStar = (f: Partial<StarFields>) => STAR_FIELDS.every((k) => !clean(f[k] ?? ""));

/** A spoken STAR answer built only from the user's words (the offline fallback). */
export function starTemplate(f: StarFields, lang: Lang): string {
  const n = normalizeStar(f);
  const he = lang === "he";
  const parts: string[] = [];
  if (n.situation) parts.push(`${he ? "הרקע:" : "The situation:"} ${sentence(n.situation)}`);
  if (n.task) parts.push(`${he ? "המשימה שלי:" : "My task:"} ${sentence(n.task)}`);
  if (n.action) parts.push(`${he ? "מה שעשיתי:" : "What I did:"} ${sentence(n.action)}`);
  if (n.result) parts.push(`${he ? "התוצאה:" : "The result:"} ${sentence(n.result)}`);
  return parts.join(" ");
}

// ---------- seniority signal checker (rule-based, offline) ----------

const OWNERSHIP =
  /\b(led|owned|own|architected|designed|decided|drove|initiated|proposed|defined|established|introduced|took ownership)\b|(הובלתי|החלטתי|תכננתי|אפיינתי|יזמתי|ייזמתי|הצעתי|הגדרתי|הטמעתי|לקחתי אחריות|אחראי על|אחראית על)/i;
const SCOPE =
  /\b(teams?|cross-team|cross-functional|org|organi[sz]ation|company-wide|production|customers?|users?|stakeholders?|roadmap)\b|(צוות|צוותים|רוחבי|ארגון|לקוחות|משתמשים|פרודקשן|בעלי עניין|מפת דרכים)/i;
const METRIC = /\d|%|\b(percent|ms|hours?|days?|weeks?|x faster)\b|(אחוז|שעות|ימים|שבועות|פי )/i;
const TRADEOFF =
  /\b(trade-?offs?|instead of|rather than|alternatives?|options?|chose|pros|cons|cost of|at the expense)\b|(במקום|חלופה|חלופות|אפשרויות|שיקול|שיקולים|פשרה|בחרתי|יתרונות|חסרונות|על חשבון)/i;
const INFLUENCE =
  /\b(convinced|aligned|persuaded|mentored|coached|negotiated|got buy-in|buy-in|presented|wrote a (?:doc|proposal|rfc)|rfc)\b|(שכנעתי|יישרתי קו|חנכתי|ליוויתי|הצגתי|כתבתי מסמך|הסכמה|תיאמתי)/i;
const REFLECTION =
  /\b(learned|learnt|lesson|would do differently|next time|in hindsight|retro(?:spective)?|post-?mortem)\b|(למדתי|לקח|הייתי עושה אחרת|בפעם הבאה|בדיעבד|תחקיר)/i;
const I_WORDS = /\b(I|I'm|I've|my|me)\b|(אני|עשיתי|הובלתי|כתבתי|בניתי|החלטתי|שלי|הצעתי|תכננתי)/g;
const WE_WORDS = /\b(we|our|us)\b|(אנחנו|עשינו|בנינו|שלנו|החלטנו)/gi;

export interface SignalCheck {
  id: SignalId;
  ok: boolean;
}

/** Which seniority signals the answer shows. Purely lexical — a hint for self-review, not a grade. */
export function checkSignals(f: Partial<StarFields>, wanted: readonly SignalId[] = SIGNALS): SignalCheck[] {
  const n = normalizeStar(f);
  const all = `${n.situation} ${n.task} ${n.action} ${n.result}`;
  const iCount = (n.action.match(I_WORDS) ?? []).length;
  const weCount = (n.action.match(WE_WORDS) ?? []).length;
  const test: Record<SignalId, boolean> = {
    ownership: OWNERSHIP.test(all),
    scope: SCOPE.test(all),
    metric: METRIC.test(n.result),
    tradeoff: TRADEOFF.test(all),
    influence: INFLUENCE.test(all),
    reflection: REFLECTION.test(all),
    firstPerson: !!n.action && iCount >= weCount && iCount > 0,
  };
  return wanted.map((id) => ({ id, ok: test[id] }));
}
