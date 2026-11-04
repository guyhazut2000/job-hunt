import { z } from "zod";

/**
 * Israeli hi-tech employment-contract checklist. Every legal number below is taken from the cited official
 * source (Knesset law text, gov.il, Bituach Leumi, WIPO Lex official law text, or Kol Zchut, which quotes the
 * law and the Ministry of Labor). Items without a statutory minimum say so. Not legal advice.
 */

export type Lang = "he" | "en";
type T = Record<Lang, string>;

export interface Source {
  label: T;
  url: string;
}

export interface ContractItem {
  id: string;
  title: T;
  /** Plain-language explanation. */
  explain: T;
  /** What to look for in the contract. */
  look: T;
  /** The legal minimum, or null when the law sets none (contractual). */
  minimum: T | null;
  /** A question to ask the employer before signing when this item is unclear or worrying. */
  ask: T;
  sources: Source[];
  /** Words that suggest the clause is present in pasted contract text (offline heuristic). */
  keywords: string[];
}

const KZ = (slug: string, he: string, en = "Kol Zchut"): Source => ({
  label: { he: `כל זכות: ${he}`, en: `${en} (Hebrew)` },
  url: `https://www.kolzchut.org.il/he/${slug}`,
});

export const SOURCES = {
  noticeLaw: {
    label: {
      he: 'חוק הודעה מוקדמת לפיטורים ולהתפטרות, התשס"א-2001 (נוסח הכנסת)',
      en: "Prior Notice of Dismissal and Resignation Law, 2001 (Knesset text)",
    },
    url: "https://fs.knesset.gov.il/15/law/15_lsr_300368.pdf",
  },
  noticeKz: KZ("הודעה_מוקדמת_להתפטרות", "הודעה מוקדמת להתפטרות", "Kol Zchut: notice on resignation"),
  nonCompete: KZ(
    "איסור_הגבלת_עובד_לעבוד_אצל_מעסיק_אחר_לאחר_סיום_עבודתו_(הסכם_אי_תחרות)",
    "הסכם אי-תחרות",
    "Kol Zchut: non-compete",
  ),
  patents: {
    label: { he: 'חוק הפטנטים, התשכ"ז-1967 (WIPO Lex)', en: "Patents Law 5727-1967 (WIPO Lex)" },
    url: "https://www.wipo.int/wipolex/en/text/495414",
  },
  tax102: {
    label: {
      he: "רשות המסים: סעיף 102 – הקצאת מניות לעובדים (gov.il)",
      en: "Israel Tax Authority: section 102 employee equity (gov.il, Hebrew)",
    },
    url: "https://www.gov.il/BlobFolder/dynamiccollectorresultitem/represent-info-191123-1/he/IncomeTax_represent-info-191123-1.pdf",
  },
  pension: KZ("חובת_ביטוח_פנסיוני_לעובדים", "חובת ביטוח פנסיוני לעובדים", "Kol Zchut: mandatory pension"),
  section14: KZ("סעיף_14_לחוק_פיצויי_פיטורים", "סעיף 14 לחוק פיצויי פיטורים", "Kol Zchut: section 14"),
  severance: KZ("פיצויי_פיטורים", "פיצויי פיטורים", "Kol Zchut: severance pay"),
  kh: KZ("קרן_השתלמות", "קרן השתלמות", "Kol Zchut: keren hishtalmut"),
  overtime: KZ(
    "גמול_גלובלי_עבור_עבודה_בשעות_נוספות,_שבת_וחג",
    "גמול גלובלי לשעות נוספות",
    "Kol Zchut: global overtime",
  ),
  vacation: KZ("חופשה_שנתית", "חופשה שנתית", "Kol Zchut: annual leave"),
  vacation5: KZ(
    "חישוב_מספר_ימי_החופשה_השנתית_לעובדים_במקומות_עבודה_שבהם_מונהג_שבוע_עבודה_בן_5_ימים",
    "ימי חופשה בשבוע עבודה של 5 ימים",
    "Kol Zchut: leave days in a 5-day week",
  ),
  sick: KZ("דמי_מחלה", "דמי מחלה", "Kol Zchut: sick pay"),
  havraa: KZ("דמי_הבראה", "דמי הבראה", "Kol Zchut: recreation pay"),
  terms: KZ("הודעה_על_תנאי_העבודה", "הודעה על תנאי העבודה", "Kol Zchut: written terms notice"),
  termsLaw: {
    label: {
      he: 'חוק הודעה לעובד (תנאי עבודה), התשס"ב-2002 (נוסח הכנסת)',
      en: "Notice to Employee (Terms of Employment) Law, 2002 (Knesset text)",
    },
    url: "https://fs.knesset.gov.il/15/law/15_lsr_300476.pdf",
  },
  hearing: KZ("שימוע_לפני_פיטורים", "שימוע לפני פיטורים", "Kol Zchut: hearing before dismissal"),
  travel: KZ("החזר_הוצאות_נסיעה", "החזר הוצאות נסיעה", "Kol Zchut: travel reimbursement"),
  carTax: {
    label: {
      he: "רשות המסים: מחשבון שווי שימוש ברכב (gov.il)",
      en: "Israel Tax Authority: company-car benefit calculator (gov.il)",
    },
    url: "https://www.gov.il/he/service/itc-mm_usecar10",
  },
  unemployment: {
    label: { he: "ביטוח לאומי: דמי אבטלה למי שהתפטר", en: "Bituach Leumi: unemployment after resigning (Hebrew)" },
    url: "https://www.btl.gov.il/benefits/Unemployment/Pages/nesibothafsakatavoda.aspx",
  },
} satisfies Record<string, Source>;

export const CONTRACT_ITEMS: ContractItem[] = [
  {
    id: "salary",
    title: { he: "רכיבי השכר", en: "Salary components" },
    explain: {
      he: "השכר ברוטו, ממה הוא מורכב ומתי משולם. כל רכיב שלא כתוב בחוזה קשה לדרוש אחר כך.",
      en: "Gross salary, what it is made of and when it is paid. Anything not written down is hard to claim later.",
    },
    look: {
      he: "שכר בסיס ברוטו, תוספות קבועות, מועד תשלום, מה נחשב לחישוב פנסיה ופיצויים, ותאריך תחילת עבודה.",
      en: "Gross base pay, fixed add-ons, pay date, which components count toward pension and severance, and the start date.",
    },
    minimum: {
      he: "המעסיק חייב למסור הודעה בכתב על תנאי העבודה (כולל השכר ורכיביו) תוך 30 יום מתחילת העבודה; חוזה כתוב מלא יכול להחליף אותה.",
      en: "The employer must give written notice of the terms (including pay and its components) within 30 days of starting; a full written contract can replace it.",
    },
    ask: {
      he: "מה בדיוק השכר ברוטו, ואילו רכיבים ממנו נכללים בבסיס להפרשות פנסיה ופיצויים?",
      en: "What exactly is the gross salary, and which components count toward pension and severance contributions?",
    },
    sources: [SOURCES.terms, SOURCES.termsLaw],
    keywords: ["שכר", "ברוטו", "משכורת", "salary", "gross", "base pay"],
  },
  {
    id: "overtime",
    title: { he: "שעות נוספות גלובליות", en: "Global overtime" },
    explain: {
      he: "בהייטק נפוץ תשלום קבוע (גלובלי) על שעות נוספות במקום ספירה לפי שעה.",
      en: "Hi-tech contracts often pay a fixed (global) amount for overtime instead of counting hours.",
    },
    look: {
      he: "שהגמול הגלובלי מופיע כרכיב נפרד ואמיתי בתלוש ובחוזה, כמה שעות הוא מכסה, ואם החוזה טוען שאת/ה 'משרת אמון' שאין לה שעות נוספות.",
      en: "That global overtime is a real, separate component in the payslip and the contract, how many hours it covers, and whether the contract calls your role a 'position of trust' with no overtime.",
    },
    minimum: {
      he: "גמול גלובלי חייב להיות רכיב נפרד ואמיתי, ולא פחות ממה שהיית מקבל/ת לפי החוק (125% לשעתיים הראשונות ו-150% לשעות שאחריהן) על השעות שעבדת בפועל.",
      en: "Global overtime must be a real separate component and not less than the legal rate (125% for the first two extra hours, 150% after) for the hours actually worked.",
    },
    ask: {
      he: "כמה שעות נוספות בחודש מכסה הגמול הגלובלי, ואיך הוא מוצג בתלוש?",
      en: "How many overtime hours a month does the global payment cover, and how does it appear on the payslip?",
    },
    sources: [SOURCES.overtime],
    keywords: ["שעות נוספות", "גלובלי", "overtime", "global"],
  },
  {
    id: "bonus",
    title: { he: "בונוסים", en: "Bonuses" },
    explain: {
      he: "בונוס שנתי או בונוס חתימה הם חוזיים בלבד. החשוב הוא מה כתוב: יעדים, שיקול דעת, ומה קורה אם עוזבים.",
      en: "Annual and signing bonuses are purely contractual. What matters is the wording: targets, discretion, and what happens if you leave.",
    },
    look: {
      he: "האם הבונוס מובטח או 'לפי שיקול דעת', לפי אילו יעדים, מתי משולם, האם יש יחסיות אם עוזבים באמצע שנה, והאם בונוס חתימה צריך להחזיר.",
      en: "Guaranteed or discretionary, which targets, when it is paid, whether it is pro-rated if you leave mid-year, and whether a signing bonus must be paid back.",
    },
    minimum: null,
    ask: {
      he: "הבונוס מובטח או לפי שיקול דעת? מה היעדים, ומה קורה לבונוס אם אני עוזב/ת לפני מועד התשלום?",
      en: "Is the bonus guaranteed or discretionary? What are the targets, and what happens to it if I leave before it is paid?",
    },
    sources: [SOURCES.terms],
    keywords: ["בונוס", "מענק", "bonus", "signing"],
  },
  {
    id: "options",
    title: { he: "אופציות / RSU", en: "Options / RSUs" },
    explain: {
      he: "אופציות נותנות זכות לקנות מניות במחיר קבוע. סעיף 102 לפקודת מס הכנסה מאפשר מסלול מס מיטבי כשההקצאה נעשית דרך נאמן.",
      en: "Options give the right to buy shares at a fixed price. Section 102 of the Income Tax Ordinance allows a better tax route when the grant goes through a trustee.",
    },
    look: {
      he: "כמה אופציות ובאיזה מחיר מימוש, לוח הבשלה (vesting) ו-cliff, מסלול 102 דרך נאמן, כמה זמן יש לממש אחרי עזיבה, ומה קורה במיזוג או רכישה (acceleration).",
      en: "How many options and the strike price, the vesting schedule and cliff, section 102 trustee route, how long you have to exercise after leaving, and what happens on a merger or acquisition (acceleration).",
    },
    minimum: null,
    ask: {
      he: "מה מחיר המימוש, לוח ההבשלה וה-cliff? האם ההקצאה במסלול 102 דרך נאמן, וכמה זמן יש לממש אחרי סיום העבודה?",
      en: "What is the strike price, vesting schedule and cliff? Is the grant under section 102 via a trustee, and how long is the exercise window after leaving?",
    },
    sources: [SOURCES.tax102],
    keywords: ["אופציות", "אופציה", "הבשלה", "102", "option", "vesting", "cliff", "rsu", "equity"],
  },
  {
    id: "pension",
    title: { he: "פנסיה", en: "Pension" },
    explain: {
      he: "כל עובד/ת זכאי/ת לביטוח פנסיוני לפי צו ההרחבה. כדאי לוודא את האחוזים ואת מועד ההפרשה הראשונה.",
      en: "Every employee is entitled to pension insurance under the extension order. Check the rates and when the first deposit is made.",
    },
    look: {
      he: "אחוזי ההפרשה (עובד, מעסיק, פיצויים), על איזה שכר מופרש, ומתי מתחילים. אם כבר יש לך קרן פנסיה פעילה – מהיום הראשון.",
      en: "Contribution rates (employee, employer, severance), on which salary, and when it starts. If you already have an active fund, from day one.",
    },
    minimum: {
      he: 'סה"כ 18.5% מהשכר: 6% עובד, 6.5% מעסיק לתגמולים ו-6% מעסיק לפיצויים. מי שכבר מבוטח/ת בקופה – זכאי/ת מהיום הראשון (ההפרשה הראשונה אחרי 3 חודשים, רטרואקטיבית); מי שלא – אחרי 6 חודשים.',
      en: "18.5% of salary in total: 6% employee, 6.5% employer to benefits and 6% employer to severance. Already insured: from day one (first deposit after 3 months, retroactive); not insured: after 6 months.",
    },
    ask: {
      he: "מאיזה יום מתחילות ההפרשות לפנסיה, באילו אחוזים, ועל איזה שכר?",
      en: "From which day do pension contributions start, at what rates, and on which salary?",
    },
    sources: [SOURCES.pension],
    keywords: ["פנסיה", "פנסיוני", "תגמולים", "pension", "provident"],
  },
  {
    id: "section14",
    title: { he: "סעיף 14 (פיצויים)", en: "Section 14 (severance)" },
    explain: {
      he: "לפי סעיף 14, ההפרשות החודשיות לפיצויים באות במקום פיצויי פיטורים. הכסף שלך גם אם תתפטר/י.",
      en: "Under section 14, monthly severance contributions replace severance pay. The money is yours even if you resign.",
    },
    look: {
      he: "האם הסעיף חל, ובאיזה אחוז. 8.33% מחליף את הפיצויים במלואם; 6% מחליף רק חלק.",
      en: "Whether it applies and at what rate. 8.33% replaces severance in full; 6% replaces only part.",
    },
    minimum: {
      he: "ההפרשות מחליפות את פיצויי הפיטורים במלואם רק אם המעסיק מפריש 8.33% מדי חודש. סעיף 14 חל אוטומטית על ההפרשות לפי צו ההרחבה לפנסיה (מאז 2008).",
      en: "Contributions replace severance in full only if the employer deposits 8.33% every month. Section 14 applies automatically to contributions under the pension extension order (since 2008).",
    },
    ask: {
      he: "האם סעיף 14 חל, ומה אחוז ההפרשה לפיצויים – 6% או 8.33%?",
      en: "Does section 14 apply, and is the severance contribution 6% or 8.33%?",
    },
    sources: [SOURCES.section14, SOURCES.severance],
    keywords: ["סעיף 14", "פיצויים", "section 14", "severance"],
  },
  {
    id: "kh",
    title: { he: "קרן השתלמות", en: "Keren hishtalmut" },
    explain: {
      he: "חיסכון לטווח בינוני עם הטבת מס. אין חובה חוקית כללית לתת קרן השתלמות – זה תלוי בחוזה.",
      en: "A medium-term savings fund with a tax benefit. There is no general legal obligation to provide it; it depends on the contract.",
    },
    look: {
      he: "האם יש, באילו אחוזים (מעסיק/עובד), מאיזה מועד, ועל איזה שכר – מלא או עד התקרה הפטורה ממס.",
      en: "Whether there is one, at what rates (employer/employee), from when, and on which salary: full or up to the tax-exempt ceiling.",
    },
    minimum: {
      he: "אין חובה חוקית כללית. פטור ממס על הפקדות עד 7.5% מעסיק ו-2.5% עובד, עד תקרת שכר של 188,544 ₪ בשנה (15,712 ₪ בחודש) נכון ל-2026. משיכה פטורה ממס אחרי 6 שנים (או 3 שנים ללימודים).",
      en: "No general legal obligation. Tax-exempt deposits up to 7.5% employer and 2.5% employee, on salary up to 188,544 ₪ a year (15,712 ₪ a month) as of 2026. Tax-free withdrawal after 6 years (or 3 for study).",
    },
    ask: {
      he: "האם יש קרן השתלמות, מאיזה יום, ועל שכר מלא או עד התקרה?",
      en: "Is there a keren hishtalmut, from which day, and on the full salary or up to the ceiling?",
    },
    sources: [SOURCES.kh],
    keywords: ["קרן השתלמות", "השתלמות", "keren", "hishtalmut", "study fund"],
  },
  {
    id: "vacation",
    title: { he: "חופשה, מחלה והבראה", en: "Vacation, sick days and recreation pay" },
    explain: {
      he: "ימי חופשה, מחלה ודמי הבראה מוגדרים בחוק כמינימום. חוזה יכול לתת יותר, לא פחות.",
      en: "Vacation, sick days and recreation pay have legal minimums. A contract can give more, never less.",
    },
    look: {
      he: "כמה ימי חופשה בשנה (וצבירה), ימי מחלה, דמי הבראה, ואם יש ימי חופשה מרוכזים שהחברה קובעת.",
      en: "Vacation days per year (and carry-over), sick days, recreation pay, and any company-wide shutdown days.",
    },
    minimum: {
      he: "חופשה: בשבוע עבודה של 5 ימים, בשנים הראשונות 12 ימי עבודה (16 ימים כולל סופי שבוע) לפי צו ההרחבה. מחלה: 1.5 ימים לחודש עד 90; יום ראשון ללא תשלום, ימים 2–3 ב-50%, ומהיום הרביעי 100%. הבראה: אחרי שנת עבודה, 5 ימים בשנה הראשונה (451.5 ₪ ליום במגזר הפרטי ב-2026).",
      en: "Vacation: in a 5-day week, in the first years 12 working days (16 days including weekends) under the extension order. Sick: 1.5 days a month up to 90; day 1 unpaid, days 2–3 at 50%, from day 4 at 100%. Recreation pay: after one year, 5 days in year 1 (451.5 ₪ a day in the private sector in 2026).",
    },
    ask: {
      he: "כמה ימי חופשה ומחלה יש בשנה, האם אפשר לצבור, ואיך משולמים דמי הבראה?",
      en: "How many vacation and sick days a year, can they carry over, and how is recreation pay paid?",
    },
    sources: [SOURCES.vacation, SOURCES.vacation5, SOURCES.sick, SOURCES.havraa],
    keywords: ["חופשה", "מחלה", "הבראה", "vacation", "sick", "leave", "pto"],
  },
  {
    id: "trial",
    title: { he: "תקופת ניסיון", en: "Trial period" },
    explain: {
      he: "החוק לא מגדיר 'תקופת ניסיון'. גם בה חלות כל הזכויות: הודעה מוקדמת, פנסיה לפי הכללים ושימוע לפני פיטורים.",
      en: "The law does not define a 'trial period'. All rights still apply during it: notice, pension per the rules, and a hearing before dismissal.",
    },
    look: {
      he: "כמה זמן היא נמשכת, אם יש בה הודעה מוקדמת קצרה יותר מהחוק (אסור), ואם תנאים כמו אופציות או קרן השתלמות נדחים עד סופה.",
      en: "How long it lasts, whether it sets a shorter notice than the law (not allowed), and whether benefits like options or keren hishtalmut are deferred until it ends.",
    },
    minimum: {
      he: "אין הגדרה בחוק. ההודעה המוקדמת לפי החוק חלה מהיום הראשון, וחובת שימוע לפני פיטורים חלה על כל העובדים ללא קשר לוותק.",
      en: "Not defined by law. Statutory notice applies from day one, and a hearing before dismissal applies to every employee regardless of seniority.",
    },
    ask: {
      he: "האם יש תקופת ניסיון, כמה זמן, ואילו תנאים משתנים בסופה?",
      en: "Is there a trial period, how long, and which terms change when it ends?",
    },
    sources: [SOURCES.hearing, SOURCES.noticeKz],
    keywords: ["תקופת ניסיון", "ניסיון", "trial", "probation"],
  },
  {
    id: "notice",
    title: { he: "הודעה מוקדמת", en: "Notice period" },
    explain: {
      he: "כמה זמן מראש צריך להודיע על התפטרות (ומה המעסיק צריך לתת לך בפיטורים). חוזה יכול לקבוע תקופה ארוכה יותר.",
      en: "How far ahead you must announce a resignation (and what the employer owes you on dismissal). A contract can set a longer period.",
    },
    look: {
      he: "כמה ימים כתובים, האם זה סימטרי לשני הצדדים, והאם יש קנס או חובה לעבוד את כל התקופה.",
      en: "How many days are written, whether it is symmetric, and whether there is a penalty or a duty to work the whole period.",
    },
    minimum: {
      he: "שכר חודשי: בחצי השנה הראשונה יום לכל חודש; מהחודש ה-7 ועד סוף השנה 6 ימים ועוד 2.5 ימים לכל חודש; משנה שנייה – חודש. אותן תקופות חלות בהתפטרות, וההודעה חייבת להיות בכתב.",
      en: "Monthly pay: in the first 6 months one day per month; from month 7 to the end of year 1, 6 days plus 2.5 days per month; from year 2, one month. The same periods apply to resignation, and notice must be in writing.",
    },
    ask: {
      he: "מה תקופת ההודעה המוקדמת בחוזה, והאם היא זהה לשני הצדדים?",
      en: "What notice period does the contract set, and is it the same for both sides?",
    },
    sources: [SOURCES.noticeLaw, SOURCES.noticeKz],
    keywords: ["הודעה מוקדמת", "התפטרות", "notice", "resign", "termination"],
  },
  {
    id: "nonCompete",
    title: { he: "אי-תחרות", en: "Non-compete" },
    explain: {
      he: "סעיף שאוסר לעבוד אצל מתחרה אחרי שעוזבים. בתי הדין לעבודה בדרך כלל לא אוכפים אותו.",
      en: "A clause that bans working for a competitor after you leave. Labor courts usually don't enforce it.",
    },
    look: {
      he: "משך ההגבלה, אזור, הגדרת 'מתחרה', והאם מקבלים תמורה מיוחדת עבורה.",
      en: "Duration, geography, how 'competitor' is defined, and whether you get special consideration for it.",
    },
    minimum: {
      he: "הגבלה כזו בדרך כלל אינה תקפה, אלא אם היא מגינה על סוד מסחרי, ניתנה עבורה תמורה מיוחדת, העובד קיבל הכשרה מיוחדת על חשבון המעסיק, או שיש בה עניין של תום לב.",
      en: "Such a restriction is generally not valid unless it protects a trade secret, special consideration was paid for it, the employee got special training at the employer's cost, or good faith requires it.",
    },
    ask: {
      he: "מה בדיוק אוסר סעיף אי-התחרות, לכמה זמן, והאם יש תמורה עבורו?",
      en: "What exactly does the non-compete forbid, for how long, and is there consideration for it?",
    },
    sources: [SOURCES.nonCompete],
    keywords: ["אי תחרות", "אי-תחרות", "תחרות", "מתחרה", "non-compete", "noncompete", "compete", "solicit"],
  },
  {
    id: "ip",
    title: { he: "קניין רוחני (IP)", en: "Intellectual property" },
    explain: {
      he: "לפי חוק הפטנטים, 'אמצאת שירות' (המצאה שנוצרה בגלל השירות ובתקופתו) שייכת למעסיק, אלא אם הוסכם אחרת.",
      en: "Under the Patents Law, a 'service invention' (made because of and during the service) belongs to the employer unless agreed otherwise.",
    },
    look: {
      he: "שההגדרה מוגבלת לעבודה ולתקופת ההעסקה, מה עם פרויקטים צדדיים וקוד פתוח בזמן הפנוי, והאם יש ויתור על תמלוגים.",
      en: "That the definition is limited to your work and the employment period, what happens to side projects and open source in your own time, and whether you waive royalties.",
    },
    minimum: {
      he: "סעיף 132 לחוק הפטנטים: אמצאת שירות היא קניין המעסיק אם אין הסכם אחר. על תגמול לעובד מחליטה ועדת הפיצויים והתמלוגים לפי החוק.",
      en: "Patents Law s.132: a service invention is the employer's property absent another agreement. Employee compensation is decided by the statutory compensation and royalties committee.",
    },
    ask: {
      he: "האם סעיף הקניין הרוחני מכסה גם פרויקטים צדדיים או קוד פתוח בזמני הפנוי, ואפשר להחריג אותם?",
      en: "Does the IP clause also cover side projects or open source in my own time, and can they be carved out?",
    },
    sources: [SOURCES.patents],
    keywords: ["קניין רוחני", "המצאה", "אמצאה", "פטנט", "intellectual property", "invention", "ip ", "patent"],
  },
  {
    id: "confidentiality",
    title: { he: "סודיות", en: "Confidentiality" },
    explain: {
      he: "התחייבות לא לחשוף מידע של החברה. זה סביר, כל עוד ההגדרה לא רחבה מדי.",
      en: "A promise not to disclose company information. Reasonable, as long as the definition is not too broad.",
    },
    look: {
      he: "מה נחשב 'מידע סודי', לכמה זמן, והאם זה חוסם שימוש בידע מקצועי כללי.",
      en: "What counts as 'confidential', for how long, and whether it blocks using general professional know-how.",
    },
    minimum: null,
    ask: {
      he: "איך מוגדר 'מידע סודי', ולכמה זמן ההתחייבות חלה אחרי העזיבה?",
      en: "How is 'confidential information' defined, and how long does it apply after leaving?",
    },
    sources: [SOURCES.nonCompete],
    keywords: ["סודיות", "סודי", "confidential", "nda", "non-disclosure"],
  },
  {
    id: "carTravel",
    title: { he: "רכב ונסיעות", en: "Car and travel" },
    explain: {
      he: "רכב צמוד נחשב הטבה חייבת במס (שווי שימוש). בלי רכב – יש זכות להחזר הוצאות נסיעה.",
      en: "A company car is a taxable benefit (imputed value). Without one, you are entitled to travel reimbursement.",
    },
    look: {
      he: "רכב צמוד או החזר נסיעות, מי משלם דלק וחניה, ומה שווי השימוש שיתווסף לשכר לצורך מס.",
      en: "Company car or travel reimbursement, who pays fuel and parking, and the imputed value added to your taxable salary.",
    },
    minimum: {
      he: "החזר נסיעות לפי תעריף נסיעה מוזל באוטובוס עד תקרה יומית של 22.60 ₪, או חופשי-חודשי – הזול מביניהם. ההחזר חייב במס.",
      en: "Travel refund at the discounted bus fare up to a daily ceiling of 22.60 ₪, or a monthly pass, whichever is cheaper. The refund is taxable.",
    },
    ask: {
      he: "יש רכב צמוד או החזר נסיעות? מי משלם דלק וחניה, ומה שווי השימוש?",
      en: "Is there a company car or travel refund? Who pays fuel and parking, and what is the imputed value?",
    },
    sources: [SOURCES.travel, SOURCES.carTax],
    keywords: ["רכב", "נסיעות", "דלק", "חניה", "car", "travel", "fuel", "parking"],
  },
  {
    id: "remote",
    title: { he: "עבודה מהבית / היברידי", en: "Remote / hybrid" },
    explain: {
      he: "אין חוק כללי שמחייב עבודה מהבית. מה שלא כתוב – החברה יכולה לשנות.",
      en: "No general law requires remote work. Whatever is not written down, the company can change.",
    },
    look: {
      he: "כמה ימים מהבית, מקום העבודה הרשמי, ציוד וקצבת בית, והאם מותר לשנות את ההסדר באופן חד-צדדי.",
      en: "How many days from home, the official workplace, equipment or home allowance, and whether the arrangement can be changed unilaterally.",
    },
    minimum: null,
    ask: {
      he: "כמה ימים בשבוע מהבית, וזה כתוב בחוזה או רק מדיניות שיכולה להשתנות?",
      en: "How many days a week from home, and is it in the contract or just a policy that can change?",
    },
    sources: [SOURCES.terms],
    keywords: ["עבודה מהבית", "היברידי", "מרחוק", "remote", "hybrid", "home office", "wfh"],
  },
];

export const ITEM_IDS = CONTRACT_ITEMS.map((i) => i.id);

/** Per-offer state for one item. */
export const itemStateSchema = z.object({
  status: z.enum(["todo", "ok", "concern"]).catch("todo"),
  note: z.string().max(1000).catch(""),
});
export type ItemState = z.infer<typeof itemStateSchema>;
export type ChecklistState = Record<string, ItemState>;

/** Parse stored JSON into a full state for every known item (unknown ids dropped, missing ones = todo). */
export function parseChecklist(raw: unknown): ChecklistState {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: ChecklistState = {};
  for (const id of ITEM_IDS) out[id] = itemStateSchema.parse(obj[id] ?? {});
  return out;
}

/** Return a new state with one item updated (unknown ids are ignored). */
export function setItem(state: ChecklistState, id: string, patch: Partial<ItemState>): ChecklistState {
  if (!ITEM_IDS.includes(id)) return state;
  return { ...state, [id]: itemStateSchema.parse({ ...state[id], ...patch }) };
}

export function checklistProgress(state: ChecklistState) {
  const vals = ITEM_IDS.map((id) => state[id]?.status ?? "todo");
  const ok = vals.filter((v) => v === "ok").length;
  const concern = vals.filter((v) => v === "concern").length;
  return { total: vals.length, ok, concern, todo: vals.length - ok - concern, done: ok + concern };
}

/**
 * Questions to ask before signing: every item marked "concern" first (with the user's note), then items not
 * checked yet. Items marked ok are skipped.
 */
export function questionsToAsk(state: ChecklistState, lang: Lang): { id: string; question: string; note: string }[] {
  const pick = (s: ItemState["status"]) =>
    CONTRACT_ITEMS.filter((i) => (state[i.id]?.status ?? "todo") === s).map((i) => ({
      id: i.id,
      question: i.ask[lang],
      note: state[i.id]?.note ?? "",
    }));
  return [...pick("concern"), ...pick("todo")];
}

export function questionsText(state: ChecklistState, lang: Lang): string {
  return questionsToAsk(state, lang)
    .map((q, i) => `${i + 1}. ${q.question}${q.note ? ` (${q.note})` : ""}`)
    .join("\n");
}
