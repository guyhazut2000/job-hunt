import type { Lang } from "./checklist";

/**
 * Copy-only drafts for the final stage. The app never sends anything: every draft is shown in a textarea with a
 * copy button and the user sends it themselves. Placeholders the user must fill stay in [brackets].
 */

const nm = (s: string | null | undefined, fb: string) => (s && s.trim() ? s.trim() : fb);

export function refereeRequestDraft(
  p: { refereeName: string; myName?: string | null; role?: string | null; company?: string | null },
  lang: Lang,
): string {
  const role = nm(p.role, lang === "he" ? "[התפקיד]" : "[role]");
  const company = nm(p.company, lang === "he" ? "[החברה]" : "[company]");
  const me = nm(p.myName, lang === "he" ? "[השם שלך]" : "[your name]");
  if (lang === "he")
    return `היי ${p.refereeName},
אני בשלבים מתקדמים לתפקיד ${role} ב-${company}, ובקרוב יבקשו ממני ממליצים.
יהיה לי כבוד אם תסכים/י שאתן את הפרטים שלך. זה בדרך כלל שיחה קצרה של 10–15 דקות.
אם זה מתאים, אשלח לך לפני כן כמה נקודות על התפקיד ועל מה שעבדנו עליו יחד, כדי שיהיה לך קל.
ואם זה לא מסתדר עכשיו – לגמרי בסדר, תודה בכל מקרה.
${me}`;
  return `Hi ${p.refereeName},
I'm in the final stages for a ${role} role at ${company}, and they'll soon ask for references.
Would you be willing to be one of them? It's usually a short 10–15 minute call.
If so, I'll send you a few notes on the role and what we worked on together beforehand to make it easy.
And if the timing doesn't work, totally fine — thank you either way.
${me}`;
}

export function refereeBriefDraft(
  p: {
    refereeName: string;
    myName?: string | null;
    role?: string | null;
    company?: string | null;
    when?: string | null;
  },
  lang: Lang,
): string {
  const role = nm(p.role, lang === "he" ? "[התפקיד]" : "[role]");
  const company = nm(p.company, lang === "he" ? "[החברה]" : "[company]");
  const me = nm(p.myName, lang === "he" ? "[השם שלך]" : "[your name]");
  const when = p.when ? (lang === "he" ? ` (צפוי ב-${p.when})` : ` (expected ${p.when})`) : "";
  if (lang === "he")
    return `היי ${p.refereeName}, תודה שוב שהסכמת!
${company} עשויים להתקשר אלייך בקרוב לגבי תפקיד ${role}${when}.
כמה נקודות שיכולות לעזור:
• על התפקיד: [2–3 משפטים על מה התפקיד דורש]
• פרויקט שעבדנו עליו יחד: [שם הפרויקט, מה עשיתי, מה התוצאה]
• חוזקות שכדאי להדגיש: [למשל עבודת צוות, עצמאות, איכות קוד]
• אם ישאלו על נקודה לשיפור: [משהו אמיתי שעבדתי עליו]
אשמח לשמוע אחרי השיחה איך היה.
${me}`;
  return `Hi ${p.refereeName}, thanks again for agreeing!
${company} may call you soon about the ${role} role${when}.
A few notes that may help:
• About the role: [2–3 sentences on what it needs]
• A project we worked on together: [name, what I did, the result]
• Strengths worth mentioning: [e.g. teamwork, ownership, code quality]
• If they ask about something to improve: [something real I worked on]
I'd love to hear how it went afterwards.
${me}`;
}

export function refereeThanksDraft(
  p: { refereeName: string; myName?: string | null; company?: string | null },
  lang: Lang,
) {
  const company = nm(p.company, lang === "he" ? "[החברה]" : "[company]");
  const me = nm(p.myName, lang === "he" ? "[השם שלך]" : "[your name]");
  if (lang === "he")
    return `היי ${p.refereeName},
רציתי להגיד תודה גדולה על הזמן ועל ההמלצה ל-${company}. זה באמת עזר.
[עדכון: איך זה נגמר / מה הלאה]
אם אוכל לעזור לך במשהו – אני כאן.
${me}`;
  return `Hi ${p.refereeName},
A big thank you for your time and the reference for ${company}. It really helped.
[Update: how it went / what's next]
If I can ever return the favor, I'm here.
${me}`;
}

export function resignationLetterDraft(
  p: {
    myName?: string | null;
    managerName?: string | null;
    employer?: string | null;
    noticeDate: string;
    lastDay: string;
  },
  lang: Lang,
): string {
  const me = nm(p.myName, lang === "he" ? "[השם שלך]" : "[your name]");
  const mgr = nm(p.managerName, lang === "he" ? "[שם המנהל/ת]" : "[manager name]");
  const emp = nm(p.employer, lang === "he" ? "[שם החברה]" : "[company name]");
  if (lang === "he")
    return `לכבוד ${mgr}
${emp}

הנדון: הודעה על התפטרות

ברצוני להודיע על התפטרותי מתפקידי ב-${emp}.
הודעה זו נמסרת בכתב ביום ${p.noticeDate}, ויום העבודה האחרון שלי יהיה ${p.lastDay}, בהתאם לתקופת ההודעה המוקדמת.
אני מתחייב/ת להעביר את תחומי האחריות שלי באופן מסודר ולסייע בחפיפה עם מי שימשיך/תמשיך אותי.
תודה על התקופה, על ההזדמנויות ועל מה שלמדתי כאן.

בברכה,
${me}`;
  return `To ${mgr}
${emp}

Subject: Notice of resignation

I am writing to give notice of my resignation from my position at ${emp}.
This notice is given in writing on ${p.noticeDate}, and my last working day will be ${p.lastDay}, in line with the notice period.
I will hand over my responsibilities in an orderly way and help with the transition to whoever takes over.
Thank you for the time here, the opportunities and everything I learned.

Best regards,
${me}`;
}

/** To a company whose process you are leaving because you accepted another offer. */
export function withdrawalDraft(p: { company: string; role: string; myName?: string | null }, lang: Lang): string {
  const me = nm(p.myName, lang === "he" ? "[השם שלך]" : "[your name]");
  if (lang === "he")
    return `שלום,
רציתי לעדכן שקיבלתי הצעה אחרת והחלטתי לקבל אותה, ולכן אני מבקש/ת לסיים את התהליך לתפקיד ${p.role} ב-${p.company}.
תודה רבה על הזמן ועל השיחות – נהניתי להכיר את הצוות, ואשמח להישאר בקשר.
${me}`;
  return `Hello,
I wanted to let you know that I've accepted another offer, so I'd like to withdraw from the process for the ${p.role} role at ${p.company}.
Thank you for your time and the conversations — I enjoyed meeting the team and would be glad to stay in touch.
${me}`;
}

/** Thank-you to the company whose offer you accepted. */
export function acceptThanksDraft(p: { company: string; role: string; myName?: string | null }, lang: Lang): string {
  const me = nm(p.myName, lang === "he" ? "[השם שלך]" : "[your name]");
  if (lang === "he")
    return `שלום,
תודה רבה על ההצעה לתפקיד ${p.role} ב-${p.company} – אני שמח/ה לאשר שאני מקבל/ת אותה.
אשמח לדעת מה הצעדים הבאים: חתימה על החוזה, תאריך התחלה ומה כדאי להכין ליום הראשון.
מחכה להתחיל!
${me}`;
  return `Hello,
Thank you for the offer for the ${p.role} role at ${p.company} — I'm happy to confirm that I accept.
Please let me know the next steps: signing the contract, the start date and anything to prepare for day one.
Looking forward to starting!
${me}`;
}
