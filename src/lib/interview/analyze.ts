/** Offline answer analysis (no AI): STAR parts, numbers, trade-offs, complexity, edge cases. */
export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

const has = (re: RegExp, s: string) => re.test(s);

const STAR_RE = {
  s: /\b(when|while|at my|in my (last|previous)|our (team|company|product)|we had|there was|back in|the situation)\b|כש|כאשר|בתפקיד|בחברה|בצוות|היה לנו|היה מצב|באותה תקופה|בפרויקט/i,
  t: /\b(my (goal|task|job|role|responsibility)|i was (asked|responsible|tasked)|needed to|had to|the goal)\b|המשימה|הייתי אחראי|הייתי אחראית|הייתי צריך|הייתי צריכה|היעד|המטרה|התבקשתי|נדרשתי/i,
  a: /\b(i (built|wrote|led|designed|implemented|created|decided|proposed|talked|reached|set up|introduced|refactored|migrated|fixed|organized|organised|analy[sz]ed|started|added|automated|optimi[sz]ed|replaced|rewrote|profiled|measured|tested|mentored|convinced|suggested|took))\b|בניתי|כתבתי|הובלתי|תכננתי|יישמתי|החלטתי|הצעתי|דיברתי|פניתי|הקמתי|שיניתי|תיקנתי|ארגנתי|ניתחתי|התחלתי|עשיתי|הוספתי|החלפתי|שכתבתי|מדדתי|בדקתי|שכנעתי/i,
  r: /\b(result|outcome|as a result|so that|which (led|reduced|increased|cut|saved)|reduced|increased|improved|saved|cut|grew|launched|shipped|delivered)\b|\d+\s?%|התוצאה|בסוף|כתוצאה|הצלחנו|הצלחתי|ירד|עלה|שיפר|חסכ|קיצר|הגדיל|הקטין|השקנו|סיימנו/i,
};

export function starParts(text: string): Record<"s" | "t" | "a" | "r", boolean> {
  return {
    s: has(STAR_RE.s, text),
    t: has(STAR_RE.t, text),
    a: has(STAR_RE.a, text),
    r: has(STAR_RE.r, text),
  };
}

export const hasNumber = (s: string) => /\d/.test(s);
export const mentionsTradeoff = (s: string) =>
  /trade-?off|\bbut\b|however|instead|alternative|downside|pros?\b|cons?\b|depends|לעומת|אבל|חיסרון|יתרון|תלוי|במקום|חלופה/i.test(
    s,
  );
export const mentionsComplexity = (s: string) =>
  /O\s?\(|\b(linear|logarithmic|quadratic|constant (time|space)|n log n)\b|לינארי|לוגריתמי|ריבועי|סיבוכיות/i.test(s);
export const mentionsEdges = (s: string) =>
  /edge case|empty|null|duplicate|negative|overflow|single element|zero|ריק|ריקה|כפיל|שלילי|גלישה|איבר אחד|אפס|מקרה קצה|מקרי קצה/i.test(
    s,
  );
export const mentionsExample = (s: string) =>
  /\b(i (used|built|worked|had)|we (used|built|had)|in (my|our) (project|team|company)|for example|at \w+)\b|לדוגמה|למשל|בפרויקט|השתמשתי|השתמשנו|עבדתי|בנינו/i.test(
    s,
  );
export const mentionsSteps = (s: string) =>
  /\b(first|then|next|finally|step)\b|ראשית|קודם|אחר כך|לאחר מכן|בסוף|שלב/i.test(s);

/** Share of expected keywords (case-insensitive; multi-word = all words present) found in the text. */
export function coverage(text: string, expected: string[]): number {
  if (!expected.length) return 0;
  const low = text.toLowerCase();
  const hit = expected.filter((e) =>
    e
      .toLowerCase()
      .split(/[\s-]+/)
      .filter((w) => w.length > 1)
      .every((w) => low.includes(w)),
  ).length;
  return hit / expected.length;
}
