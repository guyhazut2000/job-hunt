import type { Locale } from "./dictionaries";
import type { RecId } from "@/lib/coach/build";

/** Strings for the weekly coach (/coach, the WEEKLY_COACH notification). Templates use {var}. */
const en = {
  nav: "Weekly coach",
  kicker: "Your job search",
  title: "Weekly coach",
  lead: "Every Sunday: what happened last week in your search, where it is stuck, and three concrete next steps. Built only from your tracker, email-detected status changes and outreach; the numbers are shown under each step.",
  weekOf: "Week {from}–{to}",
  partialBadge: "This week so far",
  previewNote: "Not generated yet for this week: this is computed now from your current data.",
  generatedAt: "Generated {at}",
  regenerate: "Refresh now",
  regenerated: "Updated",
  regenerating: "Refreshing…",
  failed: "Something went wrong. Try again.",
  thisWeekTitle: "This week so far",
  aiBadge: "Phrased by AI · numbers from your data",
  offlineBadge: "Rule-based",
  limitedBadge: "Rule-based (daily AI limit reached)",
  numbersTitle: "The numbers",
  applied: "Applications sent",
  prevApplied: "previous week: {n}",
  responses: "Responses",
  interviews: "Reached interviews",
  rejections: "Rejections",
  responseRate: "Overall response rate",
  responseRateSmall: "— (from {min} applications)",
  responseRateOf: "{responded} of {applied}",
  stuckTitle: "Stuck",
  stuckNone: "Nothing stuck",
  stuckLine: "{count} stuck · most at “{stage}”",
  stuckDays: "{days} days at “{stage}”",
  bottleneck: "Biggest drop-off",
  bottleneckLine: "{from} → {to}: {rate}%",
  bottleneckNone: "Not enough data yet",
  outreach: "Outreach",
  outreachLine: "{sent} sent (previous week {prevSent}) · {replies} replies · {followUps} follow-ups",
  outreachWaiting: "{n} waiting over {days} days with no follow-up",
  recsTitle: "Three steps for this week",
  basis: "Based on",
  open: "Open",
  emptyTitle: "Nothing to coach yet",
  emptyBody: "Once you save or apply to jobs, or send outreach messages, your weekly summary shows up here.",
  emptyCta: "Find jobs",
  stage: { APPLIED: "Applied", SCREENING: "Screening", INTERVIEW: "Interview" } as Record<string, string>,
  step: {
    applied: "applied",
    responded: "response",
    interviewed: "interview",
    offered: "offer",
  } as Record<string, string>,
  basisLabel: {
    count: "count",
    stageCount: "at that stage",
    stage: "stage",
    days: "days without movement",
    applied: "applications",
    target: "target",
    saved: "saved jobs",
    prev: "the week before",
    rate: "rate",
    responded: "responses",
    interviewed: "interviews",
    from: "from",
    to: "to",
    sent: "messages sent",
    replies: "replies",
    skill: "skill",
    jobs: "jobs missing it",
    total: "jobs analyzed",
    debriefs: "weak debriefs",
  } as Record<string, string>,
  rec: {
    follow_up_stuck: {
      title: "Follow up on {count} stuck applications",
      detail:
        "{stageCount} are stuck at “{stage}”; the oldest hasn't moved in {days} days. A short follow-up or closing them keeps the board honest.",
    },
    complete_profile: {
      title: "Complete your profile",
      detail: "Without a profile the personal match and alerts can't rank jobs for you.",
    },
    apply_saved: {
      title: "Apply to jobs you already saved",
      detail: "{applied} applications last week (target {target}); {saved} saved jobs are waiting on the tracker.",
    },
    apply_more: {
      title: "Send {target} applications this week",
      detail: "{applied} last week (the week before: {prev}). Start from the jobs with the highest personal match.",
    },
    boost_response: {
      title: "Change the approach: response rate is {rate}%",
      detail:
        "{responded} responses out of {applied} applications. Ask for a referral or send a tailored CV instead of applying cold.",
    },
    interview_prep: {
      title: "Prepare for interviews",
      detail:
        "The biggest drop-off is {from} → {to} ({rate}%). Practice with an interview simulation before the next one.",
    },
    close_skill_gap: {
      title: "Close your top skill gap: {skill}",
      detail:
        "{skill} is missing from your profile in {jobs} of {total} jobs you target, saved or applied to ({debriefs} weak interview debriefs mention it). The gap page has a study plan.",
    },
    outreach_follow_up: {
      title: "Follow up with {count} contacts",
      detail: "{count} outreach messages have waited over {days} days with no reply and no follow-up.",
    },
    outreach_more: {
      title: "Reach out to {target} people",
      detail:
        "{sent} outreach messages last week ({replies} replies). People at the company are the fastest way to a response.",
    },
    keep_pace: {
      title: "Keep the pace",
      detail: "{applied} applications last week (the week before: {prev}). Check the new high-match jobs.",
    },
    review_stats: {
      title: "Review your stats",
      detail: "{applied} applications, {responded} responses, {interviewed} interviews so far: see which sources work.",
    },
    practice_interview: {
      title: "Practice an interview",
      detail: "{interviewed} applications reached interviews so far. A practice round now pays off later.",
    },
  } as Record<RecId, { title: string; detail: string }>,
  notifTitle: "Your weekly coach: {applied} applications, {responses} responses",
  notifBody: "This week: {first}",
};
export type CoachStrings = typeof en;

const he: CoachStrings = {
  nav: "מאמן שבועי",
  kicker: "החיפוש שלך",
  title: "מאמן שבועי",
  lead: "בכל יום ראשון: מה קרה בשבוע שעבר בחיפוש, איפה זה תקוע, ושלושה צעדים ממשיים להמשך. מבוסס רק על הלוח שלך, עדכוני הסטטוס מהמייל והפניות; המספרים מופיעים מתחת לכל צעד.",
  weekOf: "שבוע {from}–{to}",
  partialBadge: "השבוע עד עכשיו",
  previewNote: "הסיכום לשבוע הזה עוד לא נוצר: זה חושב עכשיו מהנתונים הנוכחיים שלך.",
  generatedAt: "נוצר {at}",
  regenerate: "רענון עכשיו",
  regenerated: "עודכן",
  regenerating: "מרענן…",
  failed: "משהו השתבש. אפשר לנסות שוב.",
  thisWeekTitle: "השבוע עד עכשיו",
  aiBadge: "ניסוח AI · המספרים מהנתונים שלך",
  offlineBadge: "מבוסס כללים",
  limitedBadge: "מבוסס כללים (הגעת למכסת ה-AI היומית)",
  numbersTitle: "המספרים",
  applied: "הגשות",
  prevApplied: "שבוע קודם: {n}",
  responses: "תגובות",
  interviews: "הגיעו לראיון",
  rejections: "דחיות",
  responseRate: "אחוז תגובה כולל",
  responseRateSmall: "— (מ-{min} הגשות)",
  responseRateOf: "{responded} מתוך {applied}",
  stuckTitle: "תקועות",
  stuckNone: "אין תקועות",
  stuckLine: "{count} תקועות · רובן בשלב „{stage}”",
  stuckDays: "{days} ימים בשלב „{stage}”",
  bottleneck: "הנפילה הגדולה",
  bottleneckLine: "{from} ← {to}: {rate}%",
  bottleneckNone: "אין מספיק נתונים עדיין",
  outreach: "פניות",
  outreachLine: "{sent} נשלחו (שבוע קודם {prevSent}) · {replies} תגובות · {followUps} תזכורות",
  outreachWaiting: "{n} ממתינות יותר מ-{days} ימים בלי תזכורת",
  recsTitle: "שלושה צעדים לשבוע הזה",
  basis: "מבוסס על",
  open: "פתיחה",
  emptyTitle: "עוד אין על מה לאמן",
  emptyBody: "אחרי ששומרים או מגישים למשרות, או שולחים פניות, הסיכום השבועי יופיע כאן.",
  emptyCta: "חיפוש משרות",
  stage: { APPLIED: "הוגש", SCREENING: "סינון", INTERVIEW: "ראיון" },
  step: { applied: "הגשה", responded: "תגובה", interviewed: "ראיון", offered: "הצעה" },
  basisLabel: {
    count: "כמות",
    stageCount: "באותו שלב",
    stage: "שלב",
    days: "ימים בלי תזוזה",
    applied: "הגשות",
    target: "יעד",
    saved: "משרות שמורות",
    prev: "שבוע לפני",
    rate: "אחוז",
    responded: "תגובות",
    interviewed: "ראיונות",
    from: "מ",
    to: "אל",
    sent: "פניות שנשלחו",
    replies: "תגובות",
    skill: "מיומנות",
    jobs: "משרות שחסרה בהן",
    total: "משרות שנבדקו",
    debriefs: "סיכומי ראיון חלשים",
  },
  rec: {
    follow_up_stuck: {
      title: "לעקוב אחרי {count} הגשות תקועות",
      detail:
        "{stageCount} תקועות בשלב „{stage}”; הוותיקה לא זזה {days} ימים. הודעת מעקב קצרה, או סגירה שלהן, שומרת על לוח אמין.",
    },
    complete_profile: {
      title: "להשלים את הפרופיל",
      detail: "בלי פרופיל ההתאמה האישית וההתראות לא יכולות לדרג משרות בשבילך.",
    },
    apply_saved: {
      title: "להגיש למשרות שכבר שמרת",
      detail: "{applied} הגשות בשבוע שעבר (יעד {target}); {saved} משרות שמורות מחכות בלוח.",
    },
    apply_more: {
      title: "לשלוח {target} הגשות השבוע",
      detail: "{applied} בשבוע שעבר (שבוע לפני: {prev}). כדאי להתחיל מהמשרות עם ההתאמה האישית הגבוהה.",
    },
    boost_response: {
      title: "לשנות גישה: אחוז התגובה {rate}%",
      detail:
        "{responded} תגובות מתוך {applied} הגשות. עדיף לבקש חבר מביא חבר או לשלוח קורות חיים מותאמים במקום הגשה קרה.",
    },
    interview_prep: {
      title: "להתכונן לראיונות",
      detail: "הנפילה הגדולה היא {from} ← {to} ({rate}%). כדאי לתרגל בסימולציית ראיון לפני הבא בתור.",
    },
    close_skill_gap: {
      title: "לסגור את פער המיומנות המוביל: {skill}",
      detail:
        "{skill} חסר בפרופיל שלך ב־{jobs} מתוך {total} משרות היעד, השמורות וההגשות שלך (ו־{debriefs} סיכומי ראיון חלשים מזכירים אותו). בעמוד הפערים יש תוכנית לימוד.",
    },
    outreach_follow_up: {
      title: "לשלוח תזכורת ל-{count} אנשי קשר",
      detail: "{count} פניות ממתינות יותר מ-{days} ימים בלי תגובה ובלי תזכורת.",
    },
    outreach_more: {
      title: "לפנות ל-{target} אנשים",
      detail: "{sent} פניות בשבוע שעבר ({replies} תגובות). אנשים מהחברה הם הדרך המהירה לתגובה.",
    },
    keep_pace: {
      title: "לשמור על הקצב",
      detail: "{applied} הגשות בשבוע שעבר (שבוע לפני: {prev}). כדאי לבדוק את המשרות החדשות עם התאמה גבוהה.",
    },
    review_stats: {
      title: "לעבור על הסטטיסטיקות",
      detail: "{applied} הגשות, {responded} תגובות, {interviewed} ראיונות עד עכשיו: לבדוק אילו מקורות עובדים.",
    },
    practice_interview: {
      title: "לתרגל ראיון",
      detail: "{interviewed} הגשות הגיעו לראיון עד עכשיו. סבב תרגול עכשיו ישתלם אחר כך.",
    },
  },
  notifTitle: "המאמן השבועי: {applied} הגשות, {responses} תגובות",
  notifBody: "השבוע: {first}",
};

export function coachStrings(locale: Locale): CoachStrings {
  return locale === "en" ? en : he;
}
