import { parseLocation } from "@/lib/geo/geocode";
import type { JobDomain } from "@/lib/jobs/domains";
import type { SearchJobsInput } from "./data";

/**
 * Deterministic intent parser for offline mode (no API key / LLM_PROVIDER=mock) and tests:
 * turns a Hebrew/English message into one tool call. The live model does this itself; this keeps
 * the chat useful (and testable) without it.
 */

export type Intent =
  | { tool: "search_jobs"; input: SearchJobsInput }
  | { tool: "explain_match"; input: { jobId?: string; jobQuery?: string } }
  | { tool: "company_info"; input: { company: string } };

const DOMAIN_WORDS: [RegExp, JobDomain][] = [
  [/\b(back[\s-]?end)\b|בק[\s-]?אנד|בקאנד/i, "backend"],
  [/\b(front[\s-]?end)\b|פרונט[\s-]?אנד|פרונטאנד|פרונט/i, "frontend"],
  [/\b(full[\s-]?stack)\b|פול[\s-]?סטאק|פולסטאק|פולסטק/i, "fullstack"],
  [/\b(mobile|ios|android)\b|מובייל/i, "mobile"],
  [/\b(devops|sre|platform)\b|דבאופס/i, "devops"],
  [/\b(data scien\w*|machine learning|ml|ai)\b|דאטה סיינס|למידת מכונה/i, "data-science"],
  [/\b(data engineer\w*)\b|הנדסת נתונים|דאטה/i, "data-eng"],
  [/\b(analyst|analytics|bi)\b|אנליסט|ניתוח נתונים/i, "analytics"],
  [/\b(qa|automation)\b|בדיקות|אוטומציה/i, "qa"],
  [/\b(security|cyber)\b|סייבר|אבטחת מידע/i, "security"],
  [/\b(embedded|firmware)\b|אמבדד|קושחה/i, "embedded"],
  [/\b(product manager|product)\b|מנהל[\s/]?ת? מוצר|מוצר/i, "product"],
  [/\b(design|ux|ui)\b|עיצוב|מעצב/i, "design"],
];

const LEVEL_WORDS: [RegExp, NonNullable<SearchJobsInput["level"]>[number]][] = [
  [/\b(junior|entry|graduate)\b|ג'וניור|גוניור|ג׳וניור|סטודנט|ללא ניסיון|מתחיל/i, "ENTRY"],
  [/\b(intern|internship)\b|התמחות|סטאז'/i, "INTERN"],
  [/\b(senior|sr\.?)\b|סניור|בכיר/i, "SENIOR"],
  [/\b(lead|staff|principal)\b|ליד|ראש צוות/i, "LEAD"],
  [/\b(manager)\b|מנהל צוות|מנהל פיתוח/i, "MANAGER"],
];

const WHY = /למה|מדוע|מתאים|מתאימה|התאמה|חסר|חסרים|חסרות|סיכוי|\bwhy\b|\bfit\b|\bmatch\b|missing|\bgap\b|\black\b/i;
const COMPANY_Q =
  /תהליך|גיוס|ראיון|ראיונות|ביקורות|מה ידוע|ספר לי על|על חברת|interview|hiring|process|reviews|tell me about|about the company/i;
/** Asking for a list of jobs (vs. about one job). */
const LIST = /משרות|תמצא|מצא|חפש|תראה|\bjobs\b|\broles\b|positions|openings|\bfind\b|\bsearch\b|\bshow\b/i;
const SEARCH = /משרות|משרה|עבודה|תמצא|מצא|חפש|תראה|\bjobs?\b|\broles?\b|positions?|openings?|find|search|show/i;

function commute(text: string): Pick<SearchJobsInput, "maxCommuteMinutes" | "commuteMode" | "commuteFrom"> {
  const out: Pick<SearchJobsInput, "maxCommuteMinutes" | "commuteMode" | "commuteFrom"> = {};
  const min = text.match(
    /(?:עד|תוך|פחות מ-?|up to|within|under|max(?:imum)?)\s*(\d{1,3})\s*(?:דק(?:ות|'|׳)?|min(?:utes?)?)/i,
  );
  const hours = text.match(/(?:עד|תוך|up to|within)\s*(שעה|hour)/i);
  if (min) out.maxCommuteMinutes = Math.min(180, Math.max(5, Number(min[1])));
  else if (hours) out.maxCommuteMinutes = 60;
  if (
    /ברכבת|רכבת|בתחבורה ציבורית|תחבורה ציבורית|באוטובוס|ברכבת קלה|\b(train|transit|bus|public transport)\b/i.test(text)
  )
    out.commuteMode = "transit";
  else if (/ברכב|באוטו|נהיגה|\b(car|drive|driving)\b/i.test(text)) out.commuteMode = "car";
  if (out.maxCommuteMinutes || out.commuteMode) {
    const from = originIn(text);
    if (from) out.commuteFrom = from;
  }
  return out;
}

/** "from Haifa" / "מחיפה" / "מתל אביב": a word-initial מ (or "from") glued to a known place. */
function originIn(text: string): string | undefined {
  const words = text.split(/[\s,.;!?()]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const rest = /^from$/i.test(w) ? null : w.startsWith("מ") && w.length > 2 ? w.slice(1) : undefined;
    if (rest === undefined) continue;
    for (const len of [2, 1]) {
      const cand =
        rest === null ? words.slice(i + 1, i + 1 + len).join(" ") : [rest, ...words.slice(i + 1, i + len)].join(" ");
      const p = cand.length >= 2 ? parseLocation(cand)[0] : undefined;
      if (p && p.precision !== "hq" && (len === 1 || startsName(cand, p)))
        return /[\u0590-\u05FF]/.test(cand) ? p.he : p.label;
    }
  }
  return undefined;
}

/** Hebrew prefixes (ב/ל/מ/ה/ו/ש) glued to a city name: "בחיפה" → "חיפה". */
function cityIn(text: string): string | undefined {
  const words = text.split(/[\s,.;!?()]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (isOriginWord(words, i)) continue;
    for (const len of [2, 1]) {
      const raw = words.slice(i, i + len).join(" ");
      for (const cand of [raw, raw.replace(/^[בלהוש]/, "")]) {
        if (cand.length < 2 || /^\d/.test(cand)) continue;
        const p = parseLocation(cand)[0];
        // Return the canonical place name (parseLocation is lenient about surrounding words/prefixes).
        if (p && p.precision !== "hq" && (len === 1 || startsName(cand, p)))
          return /[\u0590-\u05FF]/.test(cand) ? p.he : p.label;
      }
    }
  }
  return undefined;
}

/** "מחיפה" (from Haifa) or the word after "from" is a commute origin, not the job's city. */
function isOriginWord(words: string[], i: number): boolean {
  if (i > 0 && /^from$/i.test(words[i - 1])) return true;
  const w = words[i];
  if (!w.startsWith("מ") || w.length < 3) return false;
  const whole = parseLocation(w)[0];
  const rest = parseLocation(w.slice(1))[0];
  return Boolean(rest && whole && rest.key === whole.key && !parseLocationExact(w));
}

/**
 * Two-word candidates must start with the place's own name ("תל אביב", "Tel Aviv"), so a lenient
 * parse of "שרות בחיפה" (from "משרות בחיפה") doesn't read as an origin.
 */
function startsName(cand: string, p: { he: string; label: string }): boolean {
  const first = cand.split(" ")[0].toLowerCase();
  return p.he.startsWith(first) || p.label.toLowerCase().startsWith(first);
}

/** True when the word itself is a place name (e.g. "מודיעין"), not a מ-prefixed one. */
function parseLocationExact(w: string): boolean {
  const p = parseLocation(w)[0];
  return Boolean(p && (p.he === w || p.label.toLowerCase() === w.toLowerCase()));
}

const ORDINALS: [RegExp, number][] = [
  [/הראשונה|הראשון|\bfirst\b|\b1st\b|הכי מתאימה/i, 1],
  [/השנייה|השניה|השני|\bsecond\b|\b2nd\b/i, 2],
  [/השלישית|השלישי|\bthird\b|\b3rd\b/i, 3],
  [/הרביעית|הרביעי|\bfourth\b/i, 4],
  [/החמישית|החמישי|\bfifth\b/i, 5],
];

/** Job ids shown in the latest assistant turn (from the stored memos: "1) Title @ Co id=…"). */
export function shownJobIds(history: { role: string; content: string }[]): string[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== "assistant") continue;
    const ids = [...m.content.matchAll(/id=([a-z0-9]{8,40})/gi)].map((x) => x[1]);
    if (ids.length) return ids;
  }
  return [];
}

export function parseIntent(text: string, companies: string[] = [], shown: string[] = []): Intent {
  const t = text.trim();
  const named = companies
    .filter(
      (c) =>
        c.length >= 2 &&
        new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(t),
    )
    .sort((a, b) => b.length - a.length)[0];

  if (WHY.test(t) && !LIST.test(t)) {
    const id = t.match(/\b(c[a-z0-9]{20,30})\b/)?.[1];
    if (id) return { tool: "explain_match", input: { jobId: id } };
    const nth = ORDINALS.find(([re]) => re.test(t))?.[1];
    if (nth && shown[nth - 1]) return { tool: "explain_match", input: { jobId: shown[nth - 1] } };
    // Only Latin words (titles, tech) and company names make a useful job query; else "best match".
    const latin = (t.match(/[A-Za-z][A-Za-z0-9+#.]{1,20}/g) ?? []).filter(
      (w) => !WHY.test(w) && !/^(the|this|job|role|me|does|do|i|am|what|my|for|it)$/i.test(w),
    );
    const q = [...new Set([...(named ? [named] : []), ...latin])].join(" ").slice(0, 100);
    return { tool: "explain_match", input: q ? { jobQuery: q } : {} };
  }
  if (named && (COMPANY_Q.test(t) || !SEARCH.test(t))) return { tool: "company_info", input: { company: named } };

  const input: SearchJobsInput = { ...commute(t) };
  const domain = DOMAIN_WORDS.filter(([re]) => re.test(t)).map(([, d]) => d);
  if (domain.length) input.domain = [...new Set(domain)].slice(0, 2);
  const level = LEVEL_WORDS.filter(([re]) => re.test(t)).map(([, l]) => l);
  if (level.length) input.level = [...new Set(level)];
  if (/מרחוק|remote/i.test(t)) input.workMode = ["REMOTE"];
  else if (/היברידי|hybrid/i.test(t)) input.workMode = ["HYBRID"];
  if (named) input.company = named;
  const city = cityIn(input.commuteFrom ? t.replace(new RegExp(`(from\\s+|מ)${input.commuteFrom}`, "i"), " ") : t);
  if (city) input.city = city;
  // Latin tech words left over (e.g. "React", "Python") become the free-text query.
  if (!input.domain) {
    const tech = (t.match(/[A-Za-z][A-Za-z0-9+#.]{1,20}/g) ?? []).filter(
      (w) =>
        !/^(jobs?|roles?|in|at|up|to|min|minutes?|find|show|search|me|the|for|by|from|train|car|bus|remote|hybrid|junior|senior)$/i.test(
          w,
        ),
    );
    if (tech.length) input.query = tech.slice(0, 3).join(" ");
  }
  return { tool: "search_jobs", input };
}
