import type { CvLanguage, RequirementKind } from "@/lib/cv-tailor/types";
import type { Locale } from "./dictionaries";

const he = {
  kicker: "קורות חיים",
  title: "קו״ח מותאמים למשרה",
  lead: "גרסה של קורות החיים שלך שמדגישה את מה שהמשרה מחפשת. מסדרים ומנסחים מחדש רק את מה שכבר כתוב אצלך. לא ממציאים ניסיון, כישורים או תאריכים.",
  forJob: "עבור {title} · {company}",
  generate: "יצירת קו״ח מותאמים",
  regenerate: "יצירת גרסה חדשה",
  generating: "יוצר…",
  language: "שפת הקו״ח",
  langAuto: "לפי המשרה ({lang})",
  langHe: "עברית",
  langEn: "English",
  pasteLabel: "תיאור המשרה",
  pasteHint: "למועמדות שנוספה ידנית אין דף משרה. הדבק כאן את תיאור המשרה כדי שנדע מה להדגיש.",
  pastePlaceholder: "הדבק את דרישות המשרה…",
  needsText: "צריך להדביק את תיאור המשרה",
  noBase: "עוד אין לנו קורות חיים או פרופיל מקצועי למלא מהם. העלה קו״ח או מלא את הפרופיל, ואז חזור לכאן.",
  noBaseCta: "לפרופיל",
  notFound: "המשרה או המועמדות לא נמצאו.",
  versions: "גרסאות",
  version: "גרסה {n}",
  noVersions: "עוד לא נוצרה גרסה למשרה הזו.",
  source: {
    ai: "נוסח עם AI",
    offline: "סידור בסיסי (בלי AI)",
    limited: "סידור בסיסי (מכסת AI נוצלה)",
    edited: "נערך ידנית",
  },
  remaining: "נותרו לך {n} קריאות AI היום. יצירה אחת = קריאה אחת.",
  aiOff: "ה-AI כבוי כאן, אז הגרסה מסודרת לפי רלוונטיות בלי ניסוח מחדש.",
  rules:
    "ה-AI רק מסדר, מדגיש ומנסח מחדש. חברות, תפקידים ותאריכים נלקחים תמיד מהקו״ח שלך, וניסוח שמוסיף טכנולוגיה או מספר שלא מופיעים אצלך נדחה אוטומטית.",
  reverted: "{n} ניסוחים נדחו כי הוסיפו פרטים שלא מופיעים בקו״ח שלך, ונשאר הנוסח המקורי.",
  matchTitle: "התאמה לדרישות",
  matchScore: "{n}% מהדרישות שזיהינו מכוסות",
  matchNone: "לא זיהינו דרישות שאפשר לבדוק אוטומטית במודעה הזו.",
  covered: "מכוסה",
  missing: "חסר",
  evidenceIn: "מופיע ב: {where}",
  evidenceSkills: "כישורים",
  evidenceSummary: "תקציר",
  req: {
    years: "{n} שנות ניסיון",
    degree: "תואר אקדמי",
    language: "{name}",
  },
  suggestionsTitle: "הצעות להשלמה",
  suggestionsNote: "רק אם זה נכון. ההצעות לא נכנסות לקו״ח, צריך להוסיף בעצמך בעריכה.",
  sugg: {
    tech: "המשרה מבקשת {label} ולא מצאנו את זה בקו״ח. אם עבדת עם זה, הוסף שורה בתפקיד הרלוונטי.",
    years: "המשרה מבקשת {label} שנות ניסיון. אם יש ניסיון רלוונטי שלא מופיע (פרויקטים, צבא, פרילנס), כדאי לציין אותו.",
    degree: "המשרה מזכירה תואר. אם יש לך תואר או לימודים רלוונטיים, ודא שהם מופיעים בפרופיל.",
    language: "המשרה מבקשת {label}. אם אתה שולט בשפה, הוסף אותה לשפות בפרופיל.",
    summary: "אין תקציר בקו״ח. שתי שורות שמסכמות מי אתה ומה אתה מחפש עוזרות מאוד.",
  },
  tabCompare: "השוואה לקו״ח המקורי",
  tabEdit: "עריכה",
  tabPreview: "תצוגה",
  baseCol: "המקור",
  tailoredCol: "המותאם",
  legendAdd: "נוסח חדש",
  legendDel: "הוסר מהנוסח",
  movedUp: "הוקדם",
  save: "שמירה כגרסה חדשה",
  saving: "שומר…",
  saved: "נשמר",
  saveError: "השמירה נכשלה. בדוק את השדות ונסה שוב.",
  exportPdf: "ייצוא ל-PDF",
  print: "הדפסה / שמירה כ-PDF",
  printHint: "בחלון ההדפסה בחר ״שמירה כ-PDF״.",
  backToJob: "חזרה למשרה",
  backToEditor: "חזרה לעריכה",
  lockedNote: "חברה, תפקיד ותאריכים נעולים. משנים אותם בפרופיל.",
  skillsHint: "מופרד בפסיקים, הראשונים הכי רלוונטיים",
  addBullet: "הוספת שורה",
  removeBullet: "הסרת שורה",
  docsTitle: "קו״ח מותאמים למשרות",
  docsEmpty: "עוד אין. בדף של משרה לחץ ״קו״ח מותאם״.",
  docsCount: "{n} גרסאות",
  open: "פתיחה",
  jobCta: "קו״ח מותאם",
  appCta: "קו״ח מותאם",
  delete: "מחיקת הגרסה",
};

type Strings = typeof he;

const en: Strings = {
  kicker: "CV",
  title: "CV tailored to a job",
  lead: "A version of your CV that puts what this job is looking for up front. It only reorders and rephrases what your CV already says. No invented experience, skills or dates.",
  forJob: "For {title} · {company}",
  generate: "Create tailored CV",
  regenerate: "Create a new version",
  generating: "Creating…",
  language: "CV language",
  langAuto: "Match the job ({lang})",
  langHe: "עברית",
  langEn: "English",
  pasteLabel: "Job description",
  pasteHint:
    "This application was added by hand, so there is no job page. Paste the job description so we know what to emphasise.",
  pastePlaceholder: "Paste the job requirements…",
  needsText: "Paste the job description first",
  noBase:
    "We don't have a CV or professional profile to work from yet. Upload a CV or fill in your profile, then come back.",
  noBaseCta: "Go to profile",
  notFound: "Job or application not found.",
  versions: "Versions",
  version: "Version {n}",
  noVersions: "No version for this job yet.",
  source: {
    ai: "Rephrased with AI",
    offline: "Basic reorder (no AI)",
    limited: "Basic reorder (AI allowance used)",
    edited: "Edited by you",
  },
  remaining: "{n} AI calls left today. One version = one call.",
  aiOff: "AI is off here, so the version is reordered by relevance without rephrasing.",
  rules:
    "The AI only reorders, emphasises and rephrases. Companies, titles and dates always come from your CV, and any rephrasing that adds a technology or number your CV doesn't mention is rejected automatically.",
  reverted:
    "{n} rephrasings were rejected because they added details your CV doesn't have; the original wording was kept.",
  matchTitle: "Requirements match",
  matchScore: "{n}% of the requirements we found are covered",
  matchNone: "We couldn't find requirements to check automatically in this posting.",
  covered: "Covered",
  missing: "Missing",
  evidenceIn: "Found in: {where}",
  evidenceSkills: "skills",
  evidenceSummary: "summary",
  req: {
    years: "{n} years of experience",
    degree: "Academic degree",
    language: "{name}",
  },
  suggestionsTitle: "Gaps to consider",
  suggestionsNote: "Only if true. Suggestions are not added to the CV; add them yourself in the editor.",
  sugg: {
    tech: "The job asks for {label} and we didn't find it in your CV. If you've worked with it, add a line under the relevant role.",
    years:
      "The job asks for {label} years of experience. If you have relevant experience that isn't listed (projects, army, freelance), mention it.",
    degree: "The job mentions a degree. If you have one or relevant studies, make sure they're in your profile.",
    language: "The job asks for {label}. If you speak it, add it to the languages in your profile.",
    summary: "Your CV has no summary. Two lines on who you are and what you're looking for help a lot.",
  },
  tabCompare: "Compare with original",
  tabEdit: "Edit",
  tabPreview: "Preview",
  baseCol: "Original",
  tailoredCol: "Tailored",
  legendAdd: "New wording",
  legendDel: "Removed wording",
  movedUp: "Moved up",
  save: "Save as new version",
  saving: "Saving…",
  saved: "Saved",
  saveError: "Saving failed. Check the fields and try again.",
  exportPdf: "Export PDF",
  print: "Print / save as PDF",
  printHint: "In the print dialog choose “Save as PDF”.",
  backToJob: "Back to job",
  backToEditor: "Back to editor",
  lockedNote: "Company, title and dates are locked. Change them in your profile.",
  skillsHint: "Comma separated, most relevant first",
  addBullet: "Add line",
  removeBullet: "Remove line",
  docsTitle: "CVs tailored to jobs",
  docsEmpty: "None yet. On a job page, press “Tailored CV”.",
  docsCount: "{n} versions",
  open: "Open",
  jobCta: "Tailored CV",
  appCta: "Tailored CV",
  delete: "Delete version",
};

export type CvTailorStrings = Strings;

export function cvTailorStrings(locale: Locale): Strings {
  return locale === "en" ? en : he;
}

/** Headings printed inside the CV itself — in the CV's language, not the UI's. */
export const CV_HEADINGS: Record<
  CvLanguage,
  {
    headline: string;
    summary: string;
    experience: string;
    skills: string;
    education: string;
    languages: string;
    present: string;
  }
> = {
  he: {
    headline: "כותרת",
    summary: "תקציר",
    experience: "ניסיון תעסוקתי",
    skills: "כישורים",
    education: "השכלה",
    languages: "שפות",
    present: "היום",
  },
  en: {
    headline: "Headline",
    summary: "Summary",
    experience: "Experience",
    skills: "Skills",
    education: "Education",
    languages: "Languages",
    present: "Present",
  },
};

export function requirementLabel(t: Strings, kind: RequirementKind, label: string): string {
  if (kind === "years") return t.req.years.replace("{n}", label);
  if (kind === "degree") return t.req.degree;
  if (kind === "language") return t.req.language.replace("{name}", label);
  return label;
}
