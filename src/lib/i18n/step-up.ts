import type { Locale } from "./dictionaries";
import type { MoveKind, Verdict } from "../career/ladder";

const he = {
  title: "משרות שדרוג",
  backToJobs: "חזרה למשרות",
  lead: "משרות שהן צעד אחד מעל התפקיד שלך היום — דרגה אחת למעלה, תפקיד רחב יותר, או המסלול הטכני (Staff / ארכיטקט). לכל משרה: מה חסר, והאם כדאי להגיש בכל זאת.",
  youAre: "לפי הפרופיל שלך:",
  nextStep: "הצעד הבא:",
  source: {
    override: "בחרת ידנית",
    years: "לפי {years} שנות ניסיון בפרופיל",
    profile: "לפי הדרגה שבפרופיל",
    default: "ברירת מחדל — אין בפרופיל ניסיון או דרגה",
  },
  roleSource: {
    override: "בחרת ידנית",
    targets: "מתפקיד היעד הראשון",
    experience: "מהתפקיד האחרון בניסיון",
    default: "ברירת מחדל",
  },
  notRight: "לא מדויק? בחרו:",
  levelLabel: "הדרגה שלי",
  roleLabel: "התפקיד שלי",
  reset: "איפוס לפי הפרופיל",
  tabs: { all: "הכול", level: "דרגה למעלה", broaden: "תפקיד רחב יותר", technical: "מסלול טכני" } satisfies Record<
    MoveKind | "all",
    string
  >,
  onlyApply: "רק פערים קטנים",
  moves: {
    level: "דרגה למעלה: {from} ← {to}",
    broaden: "תפקיד רחב יותר: {from} ← {to}",
    technical: "מסלול טכני: Staff / ארכיטקט / פלטפורמה",
  } satisfies Record<MoveKind, string>,
  levelFromReq: "הבכירות זוהתה לפי הדרישות ({years}+ שנים), לא לפי הכותרת",
  verdicts: {
    apply: "כדאי להגיש בכל זאת",
    stretch: "מתיחה — אפשרי עם הכנה",
    far: "פער גדול כרגע",
  } satisfies Record<Verdict, string>,
  gapsTitle: "ניתוח פערים",
  missingSkills: "טכנולוגיות שלא בפרופיל: {list}",
  noMissing: "כל הטכנולוגיות שבמשרה מופיעות בפרופיל",
  yearsGap: "חסרות בערך {n} שנות ניסיון לדרישה",
  yearsOk: "שנות הניסיון שלך עומדות בדרישה",
  leadershipGap: "מבקשים ניסיון בהובלה/חניכה — לא מופיע בפרופיל",
  advice: {
    apply:
      "הפערים קטנים. דרישות במודעה הן לרוב רשימת משאלות, ומגייסים מראיינים גם מי שעומד ברוב הדרישות. הגישו, והדגישו בקו״ח ובמכתב את מה שכן יש לכם.",
    stretch: "יש כמה פערים. אפשר להגיש אם יש לכם פרויקט או ניסיון קרוב שממלא אותם — כדאי לציין אותו במפורש.",
    far: "הפער כרגע גדול. שווה לשמור את המשרה כיעד ולסגור קודם את הפערים.",
  } satisfies Record<Verdict, string>,
  honest:
    "כללי אצבע, לא תחזית: הבכירות מזוהה מהכותרת ומשנות הניסיון שבמודעה, ושלבי הקריירה הם מפה שבנינו ידנית. הפערים מבוססים רק על מה שכתוב בפרופיל שלך.",
  count: "{n} משרות שדרוג",
  countApply: "{n} עם פערים קטנים",
  empty: "לא מצאנו כרגע משרות שהן צעד אחד מעלייך. נסו לשנות את הדרגה או התפקיד למעלה.",
  emptyTechnicalClosed:
    "המסלול הטכני נפתח מדרגת Mid ומעלה: מ-Mid לתפקידי פלטפורמה וארכיטקטורה בדרגת Senior, ומ-Senior לתפקידי Staff ו-Principal. בינתיים כדאי להסתכל על הלשונית דרגה למעלה.",
  emptyTechnical:
    "אין כרגע משרות פתוחות במסלול הטכני שמתאימות לדרגה ולתפקיד שלך. המסלול כולל משרות Staff, Principal, ארכיטקט ופלטפורמה, והוא מתעדכן בכל סריקה.",
  noProfile: "כדי למצוא משרות שדרוג צריך פרופיל עם ניסיון או דרגה.",
  toProfile: "להשלמת הפרופיל",
  showing: "מוצגות {shown} מתוך {total}",
  link: "משרות שדרוג",
};

type Strings = typeof he;

const en: Strings = {
  title: "Step-up jobs",
  backToJobs: "Back to jobs",
  lead: "Jobs one step above your role today — one level up, a broader role, or the technical track (Staff / architect). For each: what's missing, and whether to apply anyway.",
  youAre: "From your profile:",
  nextStep: "Next step:",
  source: {
    override: "chosen by you",
    years: "from {years} years of experience in your profile",
    profile: "from the level in your profile",
    default: "default — no experience or level in your profile",
  },
  roleSource: {
    override: "chosen by you",
    targets: "from your first target role",
    experience: "from your latest role",
    default: "default",
  },
  notRight: "Not right? Pick:",
  levelLabel: "My level",
  roleLabel: "My role",
  reset: "Reset to profile",
  tabs: { all: "All", level: "Level up", broaden: "Broader role", technical: "Technical track" },
  onlyApply: "Small gaps only",
  moves: {
    level: "Level up: {from} → {to}",
    broaden: "Broader role: {from} → {to}",
    technical: "Technical track: Staff / architect / platform",
  },
  levelFromReq: "Seniority read from the requirements ({years}+ years), not the title",
  verdicts: { apply: "Worth applying anyway", stretch: "A stretch — doable with prep", far: "Big gap for now" },
  gapsTitle: "Gap analysis",
  missingSkills: "Tech not in your profile: {list}",
  noMissing: "Every listed technology is in your profile",
  yearsGap: "About {n} years short of what they ask",
  yearsOk: "Your years of experience meet the ask",
  leadershipGap: "They ask for leading/mentoring — not in your profile",
  advice: {
    apply:
      "Small gaps. Job ads are usually wish lists and recruiters interview people who meet most of them. Apply, and lead with what you do have.",
    stretch: "A few gaps. Apply if you have a project or nearby experience that covers them — say so explicitly.",
    far: "The gap is big for now. Save it as a target and close the gaps first.",
  },
  honest:
    "Rules of thumb, not a prediction: seniority comes from the title and the years the ad asks for, and the career steps are a hand-made map. Gaps are based only on what your profile says.",
  count: "{n} step-up jobs",
  countApply: "{n} with small gaps",
  empty: "No jobs one step above you right now. Try changing the level or role above.",
  emptyTechnicalClosed:
    "The technical track opens from Mid: Mid → Senior platform / architecture roles, Senior → Staff / Principal. Meanwhile, look at the Level up tab.",
  emptyTechnical:
    "No open technical-track jobs (Staff, Principal, architect, platform) match your level and role right now. It refreshes with every scan.",
  noProfile: "Step-up jobs need a profile with experience or a level.",
  toProfile: "Complete your profile",
  showing: "Showing {shown} of {total}",
  link: "Step-up jobs",
};

export const stepUpStrings = (locale: Locale): Strings => (locale === "en" ? en : he);
export type StepUpStrings = Strings;
export const fillS = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
