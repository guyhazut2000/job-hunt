import type { Locale } from "@/lib/i18n";

const en = {
  title: "Suggested skills",
  lead: "Skills your {n} best-matching jobs ask for that your profile doesn't list yet. Adding the ones you really have raises your CV's keyword match, the part of an ATS score skills can move.",
  honest:
    "Add only skills you actually have and can talk about in an interview. For the rest, the skill-gaps study plan is the better place.",
  gapsLink: "Skill gaps and study plan",
  coverage: "Your skills cover {n}% of these jobs' keywords",
  sourceAi: "Read with AI",
  sourceRules: "Rules-based reading (AI off)",
  aiLoading: "Reading the postings with AI…",
  limited: "The daily AI quota is used up, so this is the rules-based reading. Try refreshing later.",
  updated: "Updated {time}",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  askedBy: "{jobs} of {total} jobs ({share}%)",
  required: "Required in {n}",
  preferred: "Nice to have in {n}",
  impact: { high: "High ATS impact", medium: "Medium ATS impact", low: "Low ATS impact" },
  gain: "+{gain} keyword-match points on average in those jobs",
  inCv: "Already in your experience; list it under skills too",
  example: "e.g.",
  add: "Add to my skills",
  adding: "Adding…",
  added: "Added to your skills",
  dismiss: "Not relevant",
  dismissLabel: "Hide {skill}",
  dismissed: "{n} hidden",
  restore: "Show hidden",
  none: "Your skills already cover everything these jobs ask for.",
  noProfile: "Add a few skills to your profile first; suggestions compare your best-matching jobs with them.",
  noJobs:
    "No jobs match your profile well enough yet. Set target roles in preferences, or check back after the next scan.",
  noJobsCta: "Browse jobs",
  method:
    "How it's calculated: the {n} active jobs with the highest match score; each posting's required and nice-to-have skills are read (with AI when available), folded to one name (k8s = Kubernetes) and compared with your skills. Ranked by how many jobs ask for the skill. Cached for the day and recomputed when the job set changes.",
  error: "Couldn't load suggestions right now.",
};
export type SkillSuggestStrings = typeof en;

const he: SkillSuggestStrings = {
  title: "כישורים מומלצים להוספה",
  lead: "כישורים ש־{n} המשרות הכי מתאימות לך מבקשות ועדיין לא מופיעים בפרופיל. הוספה של מה שבאמת יש לך מעלה את התאמת מילות המפתח בקורות החיים, החלק בציון ה־ATS שכישורים משפיעים עליו.",
  honest: "כדאי להוסיף רק כישורים שבאמת יש לך ושאפשר לדבר עליהם בראיון. לכל השאר יש את תוכנית הלימוד בפערי המיומנויות.",
  gapsLink: "לפערי מיומנויות ותוכנית לימוד",
  coverage: "הכישורים שלך מכסים {n}% ממילות המפתח במשרות האלה",
  sourceAi: "נקרא עם AI",
  sourceRules: "קריאה לפי כללים, בלי AI",
  aiLoading: "קוראים את המודעות עם AI…",
  limited: "מכסת ה־AI היומית נגמרה, ולכן זו קריאה לפי כללים. אפשר לרענן מאוחר יותר.",
  updated: "עודכן {time}",
  refresh: "רענון",
  refreshing: "מרעננים…",
  askedBy: "{jobs} מתוך {total} משרות, {share}%",
  required: "דרישה ב־{n}",
  preferred: "יתרון ב־{n}",
  impact: { high: "השפעה גבוהה על ATS", medium: "השפעה בינונית על ATS", low: "השפעה נמוכה על ATS" },
  gain: "\u2066+{gain}\u2069 נקודות התאמת מילות מפתח בממוצע במשרות האלה",
  inCv: "כבר מופיע בניסיון שלך; כדאי להוסיף גם לרשימת הכישורים",
  example: "למשל",
  add: "הוספה לכישורים שלי",
  adding: "מוסיפים…",
  added: "נוסף לכישורים שלך",
  dismiss: "לא רלוונטי",
  dismissLabel: "הסתרת {skill}",
  dismissed: "{n} הוסתרו",
  restore: "הצגת המוסתרים",
  none: "הכישורים שלך כבר מכסים את כל מה שהמשרות האלה מבקשות.",
  noProfile: "קודם צריך להוסיף כמה כישורים לפרופיל; ההמלצות משוות אותם למשרות הכי מתאימות לך.",
  noJobs: "עדיין אין משרות שמתאימות מספיק לפרופיל. אפשר להגדיר תפקידי יעד בהעדפות, או לחזור אחרי הסריקה הבאה.",
  noJobsCta: "למשרות",
  method:
    "איך זה מחושב: {n} המשרות הפעילות עם ציון ההתאמה הגבוה ביותר. מכל מודעה נקראים כישורי החובה והיתרון, עם AI כשאפשר, מאוחדים לשם אחד, למשל k8s ו־Kubernetes, ומושווים לכישורים שלך. הדירוג לפי מספר המשרות שמבקשות את הכישור. התוצאה נשמרת ליום ומחושבת מחדש כשרשימת המשרות משתנה.",
  error: "לא הצלחנו לטעון המלצות כרגע.",
};

export const skillSuggestStrings = (locale: Locale | string): SkillSuggestStrings => (locale === "he" ? he : en);
export const fillS = (s: string, p: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? `{${k}}`));
