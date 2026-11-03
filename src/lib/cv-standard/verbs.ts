/**
 * Action-verb detection for bullet starts (docs/cv-best-practices.md §4). Lists are intentionally
 * broad; on top of them English past tense ("-ed") and Hebrew first-person past ("-תי") count too,
 * so a valid verb we did not list is rarely flagged.
 */
const EN = `accelerate achieve administer analyze architect assess audit automate build built chair champion
coach collaborate complete conceive configure consolidate construct contribute convert coordinate create cut
debug decrease define deliver deploy design detect develop devise diagnose direct document double drive drove
eliminate enable engineer enhance establish evaluate execute expand expedite extend facilitate forecast form
formulate found generate grow grew guide halve handle head identify implement improve increase initiate innovate
install instrument integrate introduce invent launch lead led maintain manage map mentor merge migrate model
modernize monitor negotiate optimize orchestrate organize overhaul own oversee pilot pioneer plan prepare present
prioritize produce program prototype publish rebuild reduce refactor redesign replace research resolve restructure
revamp review rewrite rewrote roll run ran save scale schedule secure ship simplify solve spearhead speed
standardize streamline strengthen supervise support teach taught test train transform translate triage troubleshoot
unify upgrade use utilize validate win won write wrote`
  .split(/\s+/)
  .filter(Boolean);
const EN_SET = new Set(EN);

const HE = `פיתוח פיתחתי פיתח פיתחה מפתח מפתחת הובלת הובלה הובלתי הוביל הובילה מוביל מובילה בניית בנייה בניתי בנה בנתה
תכנון תכננתי תכנן תכננה עיצוב עיצבתי עיצב עיצבה אפיון אפיינתי איפיינתי אפיין שיפור שיפרתי שיפר שיפרה הקמת הקמה הקמתי
הקים הקימה ייעול ייעלתי ייעל צמצום צמצמתי צמצם הפחתת הפחתה הפחתתי הפחית הגדלת הגדלה הגדלתי הגדיל קיצור קיצרתי קיצר
יישום יישמתי יישם הטמעת הטמעה הטמעתי הטמיע ניהול ניהלתי ניהל ניהלה מנהל מנהלת כתיבת כתיבה כתבתי כתב כתבה
אוטומציה אוטומטיזציה הסבת הסבה הסבתי העברת העברתי העביר מיגרציה שדרוג שדרגתי שדרג ארכיטקטורה תחזוקת תחזוקה תחזקתי
ביצוע ביצעתי ביצע חקר חקרתי מחקר ניתוח ניתחתי ניתח אבחון אבחנתי איתור איתרתי איתר פתרון פתרתי פתר השקת השקה השקתי
השיק השיקה הדרכת הדרכה הדרכתי הדריך חניכת חניכה חנכתי חנך ליווי ליוויתי ליווה תיאום תיאמתי תיאם ריכוז ריכזתי ריכז
יזמתי יזם יזמה ייזום הגדרת הגדרתי הגדיר הטמענו בדיקות בדקתי בדק בדיקת שילוב שילבתי שילב אינטגרציה
אינטגרציית חיבור חיברתי חיבר הרחבת הרחבתי הרחיב איחוד איחדתי איחד סטנדרטיזציה כימות מדידה מדדתי השגת השגתי השיג
זכייה זכיתי זכה הצגת הצגתי הציג פרסום פרסמתי פרסם תרגום תרגמתי הובלתם הובלנו בנינו פיתחנו שיפרנו`
  .split(/\s+/)
  .filter(Boolean);
const HE_SET = new Set(HE);

const PRONOUN_EN = new Set(["i", "me", "my", "mine", "myself"]);

/** First word of a bullet, lowercased, punctuation and a leading Hebrew conjunction ו stripped. */
export function firstWord(text: string): string {
  const w =
    text
      .trim()
      .replace(/^[\s\-–•*·▪●"'“”(]+/, "")
      .split(/[\s,:;.()]+/)[0] ?? "";
  return w.toLowerCase();
}

/** Passive "duty" openers the research says to avoid — they describe a job, not an achievement. */
const WEAK = new Set([
  "worked",
  "helped",
  "assisted",
  "participated",
  "handled",
  "tasked",
  "involved",
  "responsible",
  "was",
  "were",
  "עבדתי",
  "עזרתי",
  "סייעתי",
  "השתתפתי",
  "הייתי",
  "טיפלתי",
]);

export function startsWithActionVerb(text: string): boolean {
  const w = firstWord(text);
  if (!w || WEAK.has(w) || WEAK.has(w.replace(/^ו(?=.{3,})/, ""))) return false;
  if (/^[a-z]/.test(w)) {
    if (EN_SET.has(w)) return true;
    for (const suf of ["ed", "d", "s", "es", "ing"])
      if (w.endsWith(suf) && EN_SET.has(w.slice(0, -suf.length))) return true;
    // led→lead, "-ied" (unified→unify), doubled consonant (shipped→ship)
    if (w.endsWith("ied") && EN_SET.has(`${w.slice(0, -3)}y`)) return true;
    if (/(.)\1ed$/.test(w) && EN_SET.has(w.slice(0, -3))) return true;
    return w.length > 4 && w.endsWith("ed");
  }
  const he = w.replace(/^ו(?=.{3,})/, "");
  if (HE_SET.has(w) || HE_SET.has(he)) return true;
  // First-person past (פיתחתי, שכתבתי…) — common Hebrew CV style.
  return /^[\u05d0-\u05ea]{3,}תי$/.test(he);
}

export function hasFirstPersonPronoun(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .some((t) => PRONOUN_EN.has(t));
}

/** A number, percent, multiplier or currency amount — the measurable part of the XYZ formula. */
export function hasMetric(text: string): boolean {
  return /\d/.test(text) || /[%₪$€×]/.test(text);
}
