import type { L } from "./types";

/** Interview method: what to do, in order, out loud. Original content. */
export interface PracticeStep {
  id: string;
  title: L;
  /** Rough share of a 45-minute interview. */
  minutes: string;
  points: L[];
  /** A line you can actually say. */
  say: L;
}

export const INTERVIEW_STEPS: PracticeStep[] = [
  {
    id: "clarify",
    title: { he: "1. להבהיר", en: "1. Clarify" },
    minutes: "2–5",
    points: [
      { he: "לחזור על השאלה במילים שלך", en: "Restate the problem in your own words" },
      {
        he: "טווחי קלט: גודל n, ערכים שליליים, כפילויות, קלט ריק",
        en: "Input ranges: size n, negatives, duplicates, empty input",
      },
      {
        he: "מה מחזירים: ערך, אינדקס, רשימה? מה אם אין תשובה?",
        en: "What to return: a value, an index, a list? What if there's no answer?",
      },
      { he: "האם הקלט ממוין? מותר לשנות אותו?", en: "Is the input sorted? May I modify it?" },
    ],
    say: {
      he: '"לפני שאני מתחיל – יכולים להיות מספרים שליליים? ומה להחזיר אם אין זוג כזה?"',
      en: '"Before I start: can there be negative numbers? And what should I return if no pair exists?"',
    },
  },
  {
    id: "examples",
    title: { he: "2. דוגמאות", en: "2. Examples" },
    minutes: "2–3",
    points: [
      {
        he: "לפתור דוגמה קטנה ביד, כולל התשובה המצופה",
        en: "Solve a small example by hand, including the expected answer",
      },
      { he: "להוסיף מקרה קצה אחד משלך", en: "Add one edge case of your own" },
      {
        he: "לשים לב מה עשית בראש – זה לרוב האלגוריתם",
        en: "Notice what you did in your head: it's often the algorithm",
      },
    ],
    say: {
      he: '"בוא ננסה [2, 7, 11] עם יעד 9 – התשובה צריכה להיות 0 ו-1."',
      en: '"Let\'s try [2, 7, 11] with target 9: the answer should be 0 and 1."',
    },
  },
  {
    id: "brute",
    title: { he: "3. קודם brute force", en: "3. Brute force first" },
    minutes: "2–3",
    points: [
      { he: "להגיד את הפתרון הנאיבי ואת הסיבוכיות שלו", en: "State the naive solution and its complexity" },
      {
        he: "לזהות איפה העבודה המיותרת (לולאה פנימית, חישוב חוזר)",
        en: "Spot the wasted work (an inner loop, repeated computation)",
      },
      {
        he: "לא חייבים לכתוב אותו – רק לוודא שיש תשובה נכונה",
        en: "You don't have to code it: just make sure a correct answer exists",
      },
    ],
    say: {
      he: '"הנאיבי הוא לבדוק כל זוג, O(n²). הבזבוז הוא שאני מחפש שוב ושוב את ההשלמה."',
      en: '"Naively I check every pair, O(n²). The waste is searching for the complement again and again."',
    },
  },
  {
    id: "optimize",
    title: { he: "4. לשפר עם הצ'קליסט", en: "4. Optimise with the checklist" },
    minutes: "5–10",
    points: [
      {
        he: "לעבור על שאלות הצ'קליסט: קלט, ממוין, מה מבקשים, n",
        en: "Walk the checklist: input, sorted, what's asked, n",
      },
      { he: "להתאים את הסיבוכיות לגודל n לפי הטבלה", en: "Match the target complexity to n using the table" },
      { he: "להסכים עם המראיין על הגישה לפני שכותבים", en: "Agree on the approach with the interviewer before coding" },
    ],
    say: {
      he: '"n עד 10^5, אז אני צריך O(n log n) לכל היותר. hash map של מה שראיתי ייתן O(n) – זה בסדר שאתחיל ככה?"',
      en: '"n goes up to 10^5, so I need O(n log n) at most. A hash map of what I\'ve seen gives O(n). OK if I start with that?"',
    },
  },
  {
    id: "code",
    title: { he: "5. לכתוב קוד נקי", en: "5. Write clean code" },
    minutes: "10–15",
    points: [
      { he: "שמות ברורים, פונקציות עזר קטנות", en: "Clear names, small helper functions" },
      { he: "לספר מה אתה כותב ולמה", en: "Narrate what you're writing and why" },
      { he: "אם נתקעת על פרט – להשאיר TODO ולהמשיך", en: "Stuck on a detail? Leave a TODO and keep going" },
    ],
    say: {
      he: '"אני שומר ב-seen את האינדקס של כל ערך, ולפני ההוספה בודק אם ההשלמה כבר שם."',
      en: '"I store each value\'s index in seen, and before inserting I check whether the complement is already there."',
    },
  },
  {
    id: "test",
    title: { he: "6. לבדוק", en: "6. Test" },
    minutes: "3–5",
    points: [
      { he: "להריץ ביד את הדוגמה מהשלב השני, שורה אחרי שורה", en: "Dry-run the example from step 2, line by line" },
      {
        he: "מקרי קצה: ריק, איבר אחד, הכול זהה, ערכים קיצוניים",
        en: "Edge cases: empty, one element, all equal, extreme values",
      },
      { he: "off-by-one בגבולות של לולאות וחיפוש בינארי", en: "Off-by-one at loop bounds and binary search" },
    ],
    say: {
      he: '"בוא נבדוק מערך עם איבר אחד – הלולאה לא מוצאת זוג ומחזירה [-1, -1], כמו שסיכמנו."',
      en: '"Let\'s check a one-element array: the loop finds no pair and returns [-1, -1], as we agreed."',
    },
  },
  {
    id: "complexity",
    title: { he: "7. סיבוכיות ושיפורים", en: "7. Complexity and follow-ups" },
    minutes: "2–3",
    points: [
      { he: "זמן וזיכרון, כולל רקורסיה ומבני עזר", en: "Time and space, including recursion and helper structures" },
      {
        he: "מה אפשר לשפר אם הקלט היה ממוין / זרם / ענק",
        en: "What changes if the input were sorted / a stream / huge",
      },
    ],
    say: {
      he: '"O(n) זמן ו-O(n) זיכרון. אם היה ממוין, שני מצביעים היו נותנים O(1) זיכרון."',
      en: '"O(n) time and O(n) space. If it were sorted, two pointers would give O(1) space."',
    },
  },
];

export const COMMUNICATION_TIPS: L[] = [
  { he: "לחשוב בקול – שתיקה ארוכה נראית כמו תקיעה", en: "Think out loud: long silence looks like being stuck" },
  { he: "רמז מהמראיין הוא מתנה – לקבל אותו ולהמשיך", en: "A hint from the interviewer is a gift: take it and move on" },
  {
    he: "להגיד tradeoffs במפורש: זמן מול זיכרון, פשטות מול מהירות",
    en: "Say tradeoffs explicitly: time vs memory, simplicity vs speed",
  },
  {
    he: "אם טעית – להגיד את זה ולתקן, זה נחשב יתרון",
    en: "If you made a mistake, say so and fix it: that counts in your favour",
  },
];

export const EDGE_CASES: L[] = [
  { he: "קלט ריק / איבר אחד", en: "Empty input / one element" },
  { he: "כל הערכים זהים", en: "All values equal" },
  { he: "ערכים שליליים ואפס", en: "Negative values and zero" },
  { he: "גלישה (overflow) בסכומים ומכפלות", en: "Overflow in sums and products" },
  { he: "כפילויות", en: "Duplicates" },
  { he: "גרף לא קשיר / מעגל", en: "Disconnected graph / a cycle" },
  { he: "עץ שהוא שרשרת (עומק n)", en: "A tree that's a chain (depth n)" },
];
