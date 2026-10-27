import type { Dictionary, Locale } from "./dictionaries";
import type { SalaryFamily, SalaryLevel } from "@/lib/salary/reference";

const he = {
  chipEstimate: "הערכה",
  chipPosted: "מהמודעה",
  chipAria: "טווח שכר חודשי ברוטו",
  sectionTitle: "שכר",
  monthlyGross: "ברוטו לחודש, שכר בסיס",
  p25: "רבעון תחתון",
  median: "חציון",
  p75: "רבעון עליון",
  basis: {
    posted: "הטווח מופיע במודעה עצמה",
    reports: "הערכה: סקרי שכר משולבים עם דיווחים אנונימיים מהחברה",
    reference: "הערכה לפי סקרי שכר בהייטק הישראלי, לפי תחום ובכירות",
  },
  confidence: { high: "אמינות גבוהה", medium: "אמינות בינונית", low: "אמינות נמוכה" },
  adjustments: {
    tier: {
      established: "החברה גדולה או ציבורית, לכן הוספנו כ-{pct}% (הערכה)",
      early: "החברה בשלב מוקדם, לכן הורדנו כ-{pct}% (הערכה, בדרך כלל מפוצה באופציות)",
      growth: "",
    },
    intern: "משרת סטודנט: הערכנו לפי {pct}% משכר ג'וניור במשרה מלאה",
    executive: "תפקיד הנהלה בכירה: הערכה גסה בלבד",
    marketReports: "שולבו {n} דיווחים אנונימיים על התפקיד בשוק",
    companyReports: "שולבו {n} דיווחים אנונימיים מהחברה",
  },
  foreignPosted: "במודעה מופיע טווח במטבע זר ({raw}), הוא לא מומר לשקלים",
  ask: {
    title: "כמה לבקש",
    range: "בקשה פותחת מומלצת",
    noProfile: "אם אתם עונים על כל הדרישות, כדאי לפתוח בין החציון לרבעון העליון.",
    completeProfile: "כדאי להשלים שנות ניסיון בפרופיל כדי לקבל המלצה אישית",
    position: {
      below: "לפי שנות הניסיון שלכם אתם בתחתית הטווח לתפקיד הזה",
      lower: "לפי שנות הניסיון שלכם אתם בחלק התחתון של הטווח",
      middle: "לפי שנות הניסיון שלכם אתם באמצע הטווח",
      upper: "לפי שנות הניסיון שלכם אתם בחלק העליון של הטווח",
      above: "יש לכם יותר ניסיון ממה שהתפקיד דורש בדרך כלל, אז אפשר לבקש מעל החציון",
      unknown: "",
    },
    expectation: {
      underselling: "הציפייה שלכם בפרופיל ({want}) נמוכה מהטווח, ייתכן שאתם מוכרים את עצמכם בזול",
      aligned: "הציפייה שלכם בפרופיל ({want}) בתוך הטווח",
      stretch: "הציפייה שלכם ({want}) מעל הטווח, אבל אפשר להגיע אליה עם משא ומתן טוב",
      aboveBand: "הציפייה שלכם ({want}) גבוהה בהרבה מהטווח, ייתכן שהמשרה לא תתאים",
    },
    levelUp: "התפקיד בדרג נמוך מהדרג שלכם, וייתכן שהשכר יהיה נמוך מהציפייה",
    levelDown: "התפקיד בדרג גבוה מהדרג שלכם, ולכן הטווח שמוצג אופטימי עבורכם",
    tip: "שווה לבקש את כל החבילה: אופציות או RSU, בונוס, קרן השתלמות ורכב.",
  },
  sources: "מקורות",
  sourceReports: "דיווחי שכר אנונימיים של משתמשים (מוצגים רק כשיש לפחות 5)",
  sourcePosting: "טווח השכר שמופיע במודעה",
  disclaimer:
    "זו הערכה בלבד ולא הצעת שכר. הנתונים מבוססים על סקרים ציבוריים ועל ממוצעים, והשכר בפועל תלוי בתפקיד, בניסיון, במיקום ובמשא ומתן. שכר הבסיס לא כולל הון, בונוסים ועמלות.",
  companyTitle: "מדרגות שכר משוערות",
  companyLead: "לפי התפקידים הפתוחים בחברה. הערכה, לא נתון רשמי של החברה.",
  colRole: "תפקיד",
  colLevel: "דרג",
  colBand: "טווח (p25–p75)",
  colOpen: "משרות",
  report: {
    title: "דיווח שכר אנונימי",
    lead: "עובדים או עבדתם כאן? דיווח אנונימי יעזור לדייק את ההערכות. אנחנו לא שומרים את השם או את המייל שלכם, וההערכות מציגות רק ממוצעים של לפחות 5 דיווחים.",
    family: "תחום",
    level: "דרג",
    years: "שנות ניסיון (רשות)",
    gross: "שכר בסיס חודשי ברוטו (₪)",
    submit: "שליחת דיווח",
    sending: "שולח…",
    ok: "תודה! הדיווח נשמר. ההערכה תשתנה כשיצטברו מספיק דיווחים.",
    updated: "הדיווח הקודם שלך על תפקיד זה בחברה עודכן.",
    loginHint: "צריך להתחבר כדי לדווח. ההתחברות נועדה רק למניעת ספאם, והדיווח עצמו נשמר בלי פרטים מזהים.",
    login: "התחברות",
    errors: {
      invalid: "יש לבדוק את השדות",
      outOfRange: "הסכום לא נראה כמו שכר חודשי ברוטו לתפקיד הזה. יש לבדוק שהזנתם סכום חודשי ולא שנתי.",
      rate: "הגעת למגבלת הדיווחים היומית. אפשר לנסות שוב מחר.",
      not_found: "החברה לא נמצאה",
    },
    privacy: "נשמרים רק: חברה, תחום, דרג, שנות ניסיון ושכר.",
  },
};

type SalaryStrings = typeof he;

const en: SalaryStrings = {
  chipEstimate: "est.",
  chipPosted: "posted",
  chipAria: "Gross monthly salary range",
  sectionTitle: "Salary",
  monthlyGross: "gross per month, base salary",
  p25: "25th pct",
  median: "Median",
  p75: "75th pct",
  basis: {
    posted: "Range stated in the job posting",
    reports: "Estimate: salary surveys blended with anonymous reports for this company",
    reference: "Estimate from Israeli hi-tech salary surveys for this function and level",
  },
  confidence: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
  adjustments: {
    tier: {
      established: "Large or public company: +{pct}% (estimate)",
      early: "Early-stage company: −{pct}% (estimate, usually offset by equity)",
      growth: "",
    },
    intern: "Student position: estimated at {pct}% of a full-time junior salary",
    executive: "Senior leadership role: rough estimate only",
    marketReports: "Blended with {n} anonymous market reports",
    companyReports: "Blended with {n} anonymous reports from this company",
  },
  foreignPosted: "The posting lists a foreign-currency range ({raw}); not converted to ILS",
  ask: {
    title: "What to ask for",
    range: "Suggested opening ask",
    noProfile: "If you meet all requirements, open between the median and the 75th percentile.",
    completeProfile: "Add your years of experience to your profile for a personal recommendation",
    position: {
      below: "Your years of experience put you at the bottom of this role's range",
      lower: "Your years of experience put you in the lower part of the range",
      middle: "Your years of experience put you mid-range",
      upper: "Your years of experience put you in the upper part of the range",
      above: "You have more experience than this level usually requires, so ask above the median",
      unknown: "",
    },
    expectation: {
      underselling: "Your profile expectation ({want}) is below the range, so you may be underselling yourself",
      aligned: "Your profile expectation ({want}) is within the range",
      stretch: "Your expectation ({want}) is above the range but reachable with good negotiation",
      aboveBand: "Your expectation ({want}) is well above the range, so this role may not fit",
    },
    levelUp: "This role is below your level, so pay may fall short of your expectation",
    levelDown: "This role is above your level, so the range shown is optimistic for you",
    tip: "Negotiate the whole package: equity/RSUs, bonus, keren hishtalmut and car.",
  },
  sources: "Sources",
  sourceReports: "Anonymous user salary reports (shown only when there are at least 5)",
  sourcePosting: "Salary range stated in the posting",
  disclaimer:
    "This is an estimate, not an offer. It's based on public surveys and averages. Actual pay depends on the role, experience, location and negotiation. Base salary excludes equity, bonus and commission.",
  companyTitle: "Estimated salary bands",
  companyLead: "By this company's open roles. An estimate, not official company data.",
  colRole: "Role",
  colLevel: "Level",
  colBand: "Range (p25–p75)",
  colOpen: "Open",
  report: {
    title: "Report your salary anonymously",
    lead: "Work or worked here? An anonymous report makes estimates sharper. We don't store your name or email, and estimates only show aggregates of at least 5 reports.",
    family: "Function",
    level: "Level",
    years: "Years of experience (optional)",
    gross: "Gross monthly base salary (₪)",
    submit: "Submit report",
    sending: "Sending…",
    ok: "Thanks! Report saved. Estimates update once enough reports accumulate.",
    updated: "Your earlier report for this role at this company was updated.",
    loginHint:
      "Sign in to report. Sign-in only prevents spam; the report itself is stored without identifying details.",
    login: "Sign in",
    errors: {
      invalid: "Please check the fields",
      outOfRange:
        "That doesn't look like a gross monthly salary for this role. Check that you entered a monthly, not an annual, amount.",
      rate: "You've reached the daily report limit. Try again tomorrow.",
      not_found: "Company not found",
    },
    privacy: "Stored: company, function, level, years and salary. Nothing else.",
  },
};

export const FAMILY_LABELS: Record<Locale, Record<SalaryFamily, string>> = {
  he: {
    backend: "פיתוח Backend",
    frontend: "פיתוח Frontend",
    fullstack: "פיתוח Full Stack",
    mobile: "פיתוח מובייל",
    devops: "DevOps / תשתיות",
    data: "דאטה ואנליטיקה",
    ml: "ML / AI / אלגוריתמיקה",
    qa: "QA ידני",
    qa_automation: "QA אוטומציה",
    security: "סייבר ואבטחה",
    hardware: "חומרה / Embedded",
    product: "ניהול מוצר",
    design: "עיצוב UX/UI",
    eng_management: "ניהול פיתוח",
    sales: "מכירות ופיתוח עסקי",
    marketing: "שיווק",
    customer: "הצלחת לקוח ותמיכה",
    operations: "תפעול ופרויקטים",
    finance: "כספים",
    people: "משאבי אנוש וגיוס",
    legal: "משפטי",
    other: "אחר",
  },
  en: {
    backend: "Backend engineering",
    frontend: "Frontend engineering",
    fullstack: "Full-stack engineering",
    mobile: "Mobile engineering",
    devops: "DevOps / infrastructure",
    data: "Data & analytics",
    ml: "ML / AI / algorithms",
    qa: "Manual QA",
    qa_automation: "QA automation",
    security: "Security & cyber",
    hardware: "Hardware / embedded",
    product: "Product management",
    design: "UX/UI design",
    eng_management: "Engineering management",
    sales: "Sales & BD",
    marketing: "Marketing",
    customer: "Customer success & support",
    operations: "Operations & projects",
    finance: "Finance",
    people: "HR & recruiting",
    legal: "Legal",
    other: "Other",
  },
};

export const LEVEL_LABELS: Record<Locale, Record<SalaryLevel | "INTERN", string>> = {
  he: {
    INTERN: "סטודנט",
    JUNIOR: "ג'וניור (0–2)",
    MID: "מנוסה (3–5)",
    SENIOR: "סניור (6+)",
    LEAD: "ראש צוות",
    MANAGER: "מנהל/ת",
  },
  en: {
    INTERN: "Student",
    JUNIOR: "Junior (0–2)",
    MID: "Mid (3–5)",
    SENIOR: "Senior (6+)",
    LEAD: "Team lead",
    MANAGER: "Manager",
  },
};

export function salaryStrings(locale: Locale): SalaryStrings {
  return locale === "he" ? he : en;
}

/** For components that only receive the main dictionary. */
export function localeOf(t: Dictionary): Locale {
  return t.dateLocale.startsWith("he") ? "he" : "en";
}

export type { SalaryStrings };
