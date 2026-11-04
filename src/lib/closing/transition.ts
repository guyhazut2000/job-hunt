import { z } from "zod";
import type { Lang } from "./checklist";

/** Transition plan stored in OfferClosing.transition: notice inputs, handover + first-day checklists, 30/60/90. */

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

const checkItem = z.object({ id: z.string().max(40), text: z.string().max(300), done: z.boolean().catch(false) });

export const transitionSchema = z.object({
  currentStart: z.string().max(10).catch(""),
  payBasis: z.enum(["monthly", "hourly"]).catch("monthly"),
  contractNoticeDays: z.coerce.number().int().min(0).max(365).nullable().catch(null),
  noticeDate: z.string().max(10).catch(""),
  newStart: z.string().max(10).catch(""),
  employer: z.string().max(120).catch(""),
  manager: z.string().max(120).catch(""),
  handover: z.array(checkItem).max(60).nullable().catch(null),
  firstDay: z.array(checkItem).max(60).nullable().catch(null),
  plan: z
    .object({ d30: z.string().max(3000), d60: z.string().max(3000), d90: z.string().max(3000) })
    .nullable()
    .catch(null),
});
export type Transition = z.infer<typeof transitionSchema>;

const HANDOVER: Record<Lang, string[]> = {
  he: [
    "רשימת כל הפרויקטים והמשימות הפתוחות, עם סטטוס ובעלים חדש",
    "מסמך חפיפה: ארכיטקטורה, איפה הקוד, איך מריצים ומפרסמים",
    "גישות וסיסמאות משותפות – להעביר דרך הכלים של החברה ולא בצ'אט",
    "פגישות חפיפה עם מי שממשיך/ה, כולל on-call ותקלות נפוצות",
    "להודיע ללקוחות או לצוותים שעובדים איתך מי איש הקשר החדש",
    "להחזיר ציוד (מחשב, כרטיס כניסה) ולקבל אישור",
    "לבדוק תלוש אחרון: יתרת חופשה, הבראה ושכר עד היום האחרון",
    "לקבל טופס 161 ומכתב שחרור כספי פיצויים, ולבדוק את קופת הפנסיה",
    "לשמור עותק אישי של מסמכי ההעסקה והתלושים (לא קוד או מידע של החברה)",
  ],
  en: [
    "List every open project and task with status and a new owner",
    "Handover doc: architecture, where the code lives, how to run and deploy",
    "Access and shared credentials — hand over through company tools, not chat",
    "Handover sessions with your successor, including on-call and common incidents",
    "Tell the customers or teams you work with who their new contact is",
    "Return equipment (laptop, badge) and get a receipt",
    "Check the final payslip: vacation balance, recreation pay and pay up to the last day",
    "Get form 161 and the severance release letter, and check your pension fund",
    "Keep a personal copy of your employment documents and payslips (not company code or data)",
  ],
};

const FIRST_DAY: Record<Lang, string[]> = {
  he: [
    "לוודא שקיבלת חוזה חתום ותאריך התחלה בכתב",
    "להעביר פרטי בנק, טופס 101 ופרטי קופת פנסיה וקרן השתלמות (אפשר להמשיך את הקיימות)",
    "לברר שעה, מקום, איש קשר ומה להביא ביום הראשון",
    "לברר איזה ציוד מקבלים ואם צריך להגדיר משהו מראש",
    "לרשום שמות של מנהל/ת וצוות ולהכין שאלות לפגישה הראשונה",
    "לעדכן את LinkedIn רק אחרי שהתחלת (או כשנוח לך)",
  ],
  en: [
    "Make sure you have a signed contract and a written start date",
    "Send bank details, form 101 and pension / keren hishtalmut details (you can keep your existing funds)",
    "Find out the time, place, contact person and what to bring on day one",
    "Ask what equipment you get and whether anything needs setting up beforehand",
    "Note your manager's and team's names and prepare questions for the first 1:1",
    "Update LinkedIn only after you start (or whenever you prefer)",
  ],
};

const PLAN: Record<Lang, { d30: string; d60: string; d90: string }> = {
  he: {
    d30: "ללמוד: להכיר את הצוות, המוצר והקוד. להריץ את הסביבה, לסגור משימה קטנה ראשונה, ולהבין מה מצופה ממני.",
    d60: "לתרום: לקחת אחריות על פיצ'ר או רכיב, לשפר משהו קטן שמפריע לצוות, ולקבל פידבק ראשון מהמנהל/ת.",
    d90: "להוביל: להוביל משימה מקצה לקצה, להציע שיפור משמעותי, ולסכם עם המנהל/ת יעדים לרבעון הבא.",
  },
  en: {
    d30: "Learn: meet the team, the product and the code. Get the environment running, ship a first small task, and understand what's expected.",
    d60: "Contribute: own a feature or component, fix something small that bothers the team, and get first feedback from your manager.",
    d90: "Lead: drive a task end to end, propose a meaningful improvement, and agree on next-quarter goals with your manager.",
  },
};

const toItems = (prefix: string, texts: string[]): CheckItem[] =>
  texts.map((text, i) => ({ id: `${prefix}${i + 1}`, text, done: false }));

/** Stored transition JSON, with defaults for anything the user has not edited yet (in their language). */
export function parseTransition(raw: unknown, lang: Lang) {
  const t = transitionSchema.parse(raw && typeof raw === "object" ? raw : {});
  return {
    ...t,
    handover: t.handover ?? toItems("h", HANDOVER[lang]),
    firstDay: t.firstDay ?? toItems("f", FIRST_DAY[lang]),
    plan: t.plan ?? PLAN[lang],
  };
}
export type TransitionView = ReturnType<typeof parseTransition>;

/** Toggle an item; returns a new list. */
export function toggleItem(items: CheckItem[], id: string, done: boolean): CheckItem[] {
  return items.map((i) => (i.id === id ? { ...i, done } : i));
}

/** Add a custom item with a fresh id. */
export function addItem(items: CheckItem[], text: string, prefix: string): CheckItem[] {
  const t = text.trim().slice(0, 300);
  if (!t) return items;
  const n = items.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), 0) + 1;
  return [...items, { id: `${prefix}${n}`, text: t, done: false }];
}

export function removeItem(items: CheckItem[], id: string): CheckItem[] {
  return items.filter((i) => i.id !== id);
}
