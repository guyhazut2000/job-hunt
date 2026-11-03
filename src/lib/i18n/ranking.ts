import type { Locale } from "./dictionaries";
import type { HitPlace, PersonalReason, WeightKey } from "../ranking/personal";

const he = {
  title: "המיון האישי שלי",
  backToJobs: "חזרה למשרות",
  lead: "מילים שחשובות לך, מילים שלא, ומה הכי חשוב במיון. המשרות במיון “התאמה אישית” יסודרו לפי זה.",
  include: "מילים שאני רוצה",
  includeHint: "למשל: React, Node, פינטק, ניהול צוות. עברית ואנגלית נחשבות אותו דבר (ריאקט = React).",
  includePlaceholder: "הוסיפו מילה ולחצו Enter",
  exclude: "מילים שלא מעניינות אותי",
  excludeHint: "משרה עם המילה בכותרת, בטכנולוגיות או בשם החברה תוסתר במיון האישי. אזכור בתיאור לא מסתיר.",
  excludePlaceholder: "למשל: PHP, Angular, משמרות",
  add: "הוספה",
  remove: "הסרת {term}",
  weight: "חשיבות",
  weightLabels: ["", "רגיל", "חשוב", "חשוב מאוד"] as string[],
  must: "חובה",
  mustHint: "חובה = משרה בלי המילה הזו לא תופיע במיון האישי",
  weightsTitle: "מה הכי חשוב לי במיון",
  weightNames: {
    match: "התאמה לפרופיל",
    keywords: "המילים שלי",
    recency: "משרה טרייה",
    response: "סיכוי לתגובה",
  } satisfies Record<WeightKey, string>,
  weightHelp: {
    match: "ציון ההתאמה הקיים (כישורים, תפקיד, בכירות, מיקום)",
    keywords: "כמה מהמילים שבחרת מופיעות, ואיפה (כותרת שווה יותר מתיאור)",
    recency: "משרות חדשות מקבלות יותר תשומת לב",
    response: "החברה ענתה לך בעבר, המשרה טרייה, ומעט פערי דרישות",
  } satisfies Record<WeightKey, string>,
  weightLevels: ["לא משנה", "קצת", "בינוני", "הרבה"] as string[],
  defaultSort: "להשתמש ב“התאמה אישית” כמיון ברירת המחדל בעמוד המשרות",
  save: "שמירה",
  saving: "שומר…",
  saved: "נשמר",
  error: "לא הצלחנו לשמור. נסו שוב.",
  preview: "לצפייה במשרות לפי המיון האישי",
  honest:
    "זו הערכה שקופה לפי כללים פשוטים, לא תחזית. “סיכוי לתגובה” מבוסס רק על מה שידוע לנו: תגובות קודמות של החברה אליך, גיל המשרה ופערי הדרישות.",
  why: "למה {score}?",
  whyTitle: "למה המשרה גבוהה במיון האישי",
  personalScore: "ציון אישי",
  noReasons: "אין סיבות בולטות — הציון נשען בעיקר על גיל המשרה.",
  settingsLink: "הגדרת המיון האישי",
  emptyPrefs: "עוד לא בחרת מילים. המיון האישי עובד גם כך (פרופיל + טריות), אבל עם מילים הוא מדויק יותר.",
  hiddenCount: "{n} משרות הוסתרו לפי המילים שלך (חובה / לא מעניין)",
  places: { title: "בכותרת", tech: "בטכנולוגיות", company: "בשם החברה", text: "בתיאור" } satisfies Record<
    HitPlace,
    string
  >,
  reasons: {
    keyword: "“{term}” {place}",
    mustMissing: "חסרה מילת חובה: “{term}”",
    match: "התאמה לפרופיל {score}%",
    fresh: "פורסמה {days}",
    responded: "החברה כבר ענתה לך בעבר",
    gaps: "פערי דרישות: {missing}",
  },
  today: "היום",
  daysAgo: "לפני {n} ימים",
  noGaps: "אין פערים בכישורים",
  points: "+{n}",
};

type Strings = typeof he;

const en: Strings = {
  title: "My personal ranking",
  backToJobs: "Back to jobs",
  lead: "Words that matter to you, words that don't, and what matters most. Jobs under the “Personal fit” sort follow this.",
  include: "Words I want",
  includeHint: "E.g. React, Node, fintech, team lead. Hebrew and English count as the same (ריאקט = React).",
  includePlaceholder: "Add a word and press Enter",
  exclude: "Words I'm not interested in",
  excludeHint:
    "A job with the word in its title, tech or company name is hidden from the personal sort. A mention in the description doesn't hide it.",
  excludePlaceholder: "E.g. PHP, Angular, shifts",
  add: "Add",
  remove: "Remove {term}",
  weight: "Importance",
  weightLabels: ["", "Normal", "Important", "Very important"],
  must: "Must",
  mustHint: "Must = jobs without this word won't appear in the personal sort",
  weightsTitle: "What matters most in the ranking",
  weightNames: {
    match: "Profile match",
    keywords: "My words",
    recency: "Fresh posting",
    response: "Chance of a reply",
  },
  weightHelp: {
    match: "The existing match score (skills, role, seniority, location)",
    keywords: "How many of your words appear, and where (title counts more than description)",
    recency: "New postings get more attention",
    response: "The company replied to you before, the posting is fresh, few requirement gaps",
  },
  weightLevels: ["Ignore", "A little", "Medium", "A lot"],
  defaultSort: "Use “Personal fit” as the default sort on the jobs page",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save. Try again.",
  preview: "See jobs in my personal order",
  honest:
    "A transparent rule-of-thumb estimate, not a prediction. “Chance of a reply” only uses what we know: the company's past replies to you, the posting's age and requirement gaps.",
  why: "Why {score}?",
  whyTitle: "Why this job ranks high for you",
  personalScore: "Personal score",
  noReasons: "No standout reasons — the score mostly reflects the posting's age.",
  settingsLink: "Personal ranking settings",
  emptyPrefs: "No words chosen yet. The personal sort still works (profile + freshness), but words make it sharper.",
  hiddenCount: "{n} jobs hidden by your words (must / not interested)",
  places: {
    title: "in the title",
    tech: "in the tech stack",
    company: "in the company name",
    text: "in the description",
  },
  reasons: {
    keyword: "“{term}” {place}",
    mustMissing: "Missing must-have: “{term}”",
    match: "Profile match {score}%",
    fresh: "Posted {days}",
    responded: "The company replied to you before",
    gaps: "Requirement gaps: {missing}",
  },
  today: "today",
  daysAgo: "{n} days ago",
  noGaps: "no skill gaps",
  points: "+{n}",
};

export const rankingStrings = (locale: Locale): Strings => (locale === "en" ? en : he);
export type RankingStrings = Strings;

export const fillR = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));

/** One reason → display text (without the points). */
export function reasonText(r: PersonalReason, s: Strings): string {
  switch (r.key) {
    case "keyword":
      return fillR(s.reasons.keyword, { term: r.term, place: s.places[r.place] });
    case "mustMissing":
      return fillR(s.reasons.mustMissing, { term: r.term });
    case "match":
      return fillR(s.reasons.match, { score: r.score });
    case "fresh":
      return fillR(s.reasons.fresh, { days: r.days === 0 ? s.today : fillR(s.daysAgo, { n: r.days }) });
    case "responded":
      return s.reasons.responded;
    case "gaps":
      return r.missing === 0 ? s.noGaps : fillR(s.reasons.gaps, { missing: r.missing });
  }
}
