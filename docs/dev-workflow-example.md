# דוגמה מלאה: ביטול מחיקת מועמדות (PR #74), שלב אחרי שלב

> המסמך הזה מיישם את [הצ'קליסט](dev-workflow-checklist.md) על פיצ'ר אמיתי מהפרויקט:
> הודעת "המועמדות נמחקה · בטל" בדשבורד ([PR #74](https://github.com/guyhazut2000/job-hunt/pull/74),
> commit `99c9925`). הוא כתוב כמו יומן עבודה, לפי סדר השלבים.

**איך לקרוא את המסמך:** כל מה שלא מסומן הוא עובדה מה-PR, מה-commit או מהקוד ב-`master`: נתיבי קבצים,
שמות בדיקות, מספרים, זמנים. קטעים שמסומנים **🔶 להמחשה** הם שחזור או דוגמה שנכתבו כדי להראות את דרך
החשיבה (למשל ניסוח ה-issue או פקודות שלא נשמרו בלוג). הם לא מתיימרים להיות תיעוד מדויק של מה שקרה.
הזמנים הם בשעון ישראל.

---

## שלב 1: הבקשה והגדרת הצלחה

**מאיפה זה הגיע.** בסבב בדיקת האיכות על כל האתר (PRs #69–#72) עלה ממצא: מחיקת מועמדות בדשבורד מתבצעת
מיד בלחיצה על סמל הפח, בלי אישור ובלי דרך לבטל. לחיצה בטעות מוחקת את המועמדות, ואיתה היסטוריית
הסטטוסים, ההערות, טיוטות הפולואפ, קורות החיים המותאמים וסימולציות הראיון.

**החלטת מוצר.** זו לא החלטה טכנית בלבד, ולכן היא הוצגה לגיא כאפשרות לבחירה, יחד עם "טען עוד" בעמוד
החברות ושדרוג ספריות. גיא בחר את שלושתן.

**ניסוח הבעיה במשפט אחד:** כשאני מוחק מועמדות בטעות, אין לי דרך להחזיר אותה.

**קריטריוני הצלחה** (מתוך ה-PR ובדיקות ה-E2E שלו):

1. לחיצה על המחיקה מסתירה את הכרטיס מיד, ומציגה הודעה "המועמדות נמחקה · בטל".
2. "בטל" בתוך חלון הזמן מחזיר את הכרטיס **עם כל הנתונים שלו**, והוא נשאר גם אחרי רענון.
3. אם לא לוחצים "בטל", המועמדות נמחקת אחרי החלון (7 שניות), ולא חוזרת אחרי רענון.
4. אם עוזבים את העמוד בזמן שהמחיקה ממתינה, המחיקה מתבצעת ולא "נתקעת".
5. ההודעה נגישה (קורא מסך, מקלדת), עובדת ב-RTL, ולא מוסתרת מאחורי סרגל הניווט התחתון במובייל.

**לא כלול (non-goals):** סל מחזור, שחזור אחרי ימים, ביטול של פעולות אחרות.

🔶 **להמחשה:** ל-PR #74 לא נפתח issue, והוא לא מקושר לאחד. לפי הצ'קליסט היה נכון לפתוח issue קצר, למשל:

```bash
gh issue create --title "Undo for deleting an application" --body $'Deleting an application is instant and irreversible.\n\nSuccess criteria:\n- [ ] delete hides the card and shows an undo toast\n- [ ] undo restores it with history/notes/drafts\n- [ ] no undo → deleted after the window\n- [ ] leaving the page commits pending deletes'
```

ואז ה-PR היה אומר `Closes #N`.

---

## שלב 2: קריאת הקוד

הקבצים שנקראו לפני שנכתבה שורה, ומה למדנו מכל אחד:

| קובץ                           | מה גילינו                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/Kanban.tsx`    | הלוח הוא client component. המחיקה הייתה `useOptimistic` עם `remove: true`, ומיד אחריה `await removeApplication(i.id)`.                                   |
| `src/app/actions.ts`           | `removeApplication(id)` היא server action: `requireUser()`, ואז `db.application.deleteMany({ where: { id, userId } })` ו-`revalidatePath("/dashboard")`. |
| `src/app/dashboard/page.tsx`   | העמוד מעביר ל-`Kanban` את כל הטקסטים מהמילון (`t.dashboard.remove` וכו').                                                                                |
| `src/lib/i18n/dictionaries.ts` | כל טקסט ב-UI מגיע מהמילון, בעברית ובאנגלית. טקסט חדש צריך להיכנס לשתי השפות.                                                                             |
| `prisma/schema.prisma`         | ב-`Application` יש `@@unique([userId, jobId])`, ולמועמדות יש נתונים קשורים (היסטוריה, הערות, טיוטות) שנמחקים איתה.                                       |
| `src/features/registry.ts`     | לפי הכלל ב-`docs/features.md`, שינוי משמעותי בפיצ'ר קיים מקבל שורת `updates`.                                                                            |

**שלוש עובדות שקבעו את התכנון:**

1. המחיקה היא `deleteMany` אמיתית. ברגע שהיא רצה, אין ממה לשחזר.
2. ב-`src` יש בערך 40 שאילתות על טבלת המועמדויות (ה-PR מציין "37+").
3. `@@unique([userId, jobId])`: אי אפשר שתהיה שורה "מחוקה" ושורה חדשה לאותה משרה.

🔶 **להמחשה**, פקודות מהסוג שמשמשות לקריאה כזו:

```bash
rg -n "removeApplication" src
rg -n "model Application" -A 40 prisma/schema.prisma
rg -c "db\.application\." src | awk -F: '{s+=$2} END {print s}'
```

---

## שלב 3: תוכנית ופירוק

**שלוש חלופות נשקלו:**

| חלופה                                                   | יתרון                                           | חיסרון                                                                                                        | הכרעה     |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| 🔶 חלון אישור ("למחוק?")                                | פשוט                                            | מוסיף חיכוך לכל מחיקה, ואנשים לוחצים "כן" אוטומטית. זה לא באמת מציל מטעות. (נימוק להמחשה)                     | נדחתה     |
| Soft delete (עמודת `deletedAt`)                         | אפשר לשחזר גם אחרי זמן רב                       | migration, סינון ב-37+ שאילתות (כל אחת שתישכח תציג מועמדות "מחוקות"), והתנגשות עם `@@unique([userId, jobId])` | נדחתה     |
| **מחיקה מושהית** (להסתיר מיד ולמחוק בפועל אחרי 7 שניות) | בלי שינוי סכמה ובלי migration, שחזור מלא ומיידי | צריך לטפל בעזיבת העמוד בזמן ההמתנה                                                                            | **נבחרה** |

**התוכנית (PR אחד, כי כל החלקים תלויים זה בזה וקטנים):**

1. מודול לוגיקה טהור `src/lib/applications/pending-delete.ts`: תור מחיקות מושהות (`schedule`, `undo`, `flush`, `pending`) ופונקציה לאימות גוף הבקשה (`parseRemoveIds`).
2. API route חדש `src/app/api/applications/remove/route.ts` למחיקה בזמן עזיבת העמוד.
3. `Kanban.tsx`: להסתיר, להציג הודעה, לבטל, ולבצע `flush` ביציאה.
4. טקסטים במילון, אנימציית ספירה לאחור ב-`globals.css`, ושורה ברישום הפיצ'רים.
5. בדיקות: `tests/delete-undo.test.ts`.

---

## שלב 4: ענף ותיקייה

הענף בפועל: `feat/delete-undo`. ה-PR נפתח ב-10:03.

🔶 **להמחשה**, ההקמה לפי הצ'קליסט:

```bash
git fetch origin
git worktree add -b feat/delete-undo ../job-hunt-delete-undo origin/master
cd ../job-hunt-delete-undo && npm ci
```

---

## שלב 5: מסד הנתונים

**ההחלטה: אין שינוי סכמה ואין migration.** זה היתרון המרכזי של המחיקה המושהית. כל עוד הטיימר רץ, השורה
לא נגעה במסד, ולכן "בטל" לא צריך לשחזר שום דבר. הוא פשוט מבטל את הטיימר.

שתי החלטות אבטחה ב-route החדש (מהקוד בפועל):

- `auth()` בתחילת ה-route. בלי משתמש מחובר מוחזר `401`.
- המחיקה מסוננת לפי המשתמש, `deleteMany({ where: { id: { in: ids }, userId } })`, כך שאי אפשר למחוק מועמדות של מישהו אחר גם אם שולחים מזהה שלה.
- `parseRemoveIds` מקבל רק מערך של 1–50 מחרוזות בתבנית `^[a-z0-9]{10,40}$`, ומסיר כפילויות. כל קלט אחר מקבל `400`.

---

## שלב 6: מימוש ובדיקות

### החלטות מימוש (מהקוד ב-`master`)

- **הפרדה בין לוגיקה ל-UI.** `createPendingDeleteQueue` מקבל `commit`, `delayMs`, `setTimer` ו-`clearTimer` כפרמטרים. ככה הבדיקות שולטות בזמן ולא מחכות 7 שניות אמיתיות.
- **קבוע אחד לחלון:** `UNDO_DELETE_MS = 7000`. גם הקוד וגם אנימציית הספירה לאחור (`animationDuration`) משתמשים בו, כך שהם לא יכולים להתפצל.
- **שתי דרכים לבצע את המחיקה:**
  - בזמן רגיל, כשהטיימר נגמר: server action `removeApplication(id)`. אם היא נכשלת, הכרטיס חוזר להופיע ולא "מעמיד פנים" שנמחק.
  - כשעוזבים את העמוד (`pagehide`, `visibilitychange` ל-hidden, או unmount כשמנווטים בתוך האפליקציה): `fetch(..., { keepalive: true })` ל-`/api/applications/remove`. server action לא שורד את פריקת העמוד, ובקשת keepalive כן.
  - אם גם זה נכשל, השורה פשוט נשארת. שום דבר לא אובד.
- **שינוי בדפוס הקיים.** `useOptimistic` נשאר רק לשינוי סטטוס. המחיקה עברה ל-state נפרד (`hidden`), כי עכשיו צריך גם להחזיר כרטיס ולא רק להעלים אותו.
- **נגישות ו-RTL:**
  - ההודעה בתוך `role="status"` ו-`aria-live="polite"`.
  - הפוקוס עובר לכפתור "בטל", כי כפתור הפח נעלם יחד עם הכרטיס.
  - גובה כפתור 44px לפחות (`min-h-11`).
  - שם המשרה מוצג עם `dir="auto"`.
  - פס הספירה לאחור מתחיל מהצד הנכון (`origin-left rtl:origin-right`).
  - במובייל ההודעה יושבת מעל סרגל הניווט התחתון (`--bottom-nav-h` + `safe-area-inset-bottom`).
- **טקסטים** במילון בשתי השפות: `deletedToast` ("המועמדות נמחקה" / "Application deleted") ו-`undoDelete` ("בטל" / "Undo").

### הבדיקות שנכתבו: `tests/delete-undo.test.ts` (8 בדיקות)

```text
pending delete queue (undo window)
  ✓ uses a 6–8 second undo window
  ✓ deletes only after the window
  ✓ undo cancels the delete — nothing is ever sent
  ✓ undo after the delete ran reports false
  ✓ keeps independent timers per card and ignores double clicks
  ✓ flush (page left) commits everything pending at once, then nothing more
parseRemoveIds (keep-alive delete body)
  ✓ accepts a list of cuid-like ids, de-duplicated
  ✓ rejects junk
```

שימו לב איך כל בדיקה ממפה לקריטריון: "deletes only after the window" לקריטריון 3, "undo cancels" לקריטריון 2,
"flush" לקריטריון 4, ו-"rejects junk" לאבטחת ה-route.

**לפני ה-PR עברו מקומית:** lint, format, typecheck, כל 1047 הבדיקות, ו-`next build`.

---

## שלב 7: בדיקה כמו משתמש ומדידות

בדיקת E2E עם Playwright מול `next start` (build של production), על מסד נתונים מקומי. אלה התוצאות שדווחו
ב-PR:

| תרחיש                           | תוצאה                                        |
| ------------------------------- | -------------------------------------------- |
| מחיקה                           | הכרטיס נעלם (13 ← 12 כרטיסים) וההודעה מופיעה |
| "בטל"                           | חזרה ל-13, ונשאר 13 גם אחרי רענון            |
| המתנה של 8.5 שניות בלי ביטול    | אחרי רענון הכרטיס לא קיים                    |
| ניווט החוצה בזמן שהמחיקה ממתינה | המחיקה בוצעה                                 |
| מובייל 390px ומחשב              | אין שגיאות ב-console                         |

**צילומי מסך** (שמורים מחוץ לריפו, בתיקיית העבודה):
`desktop-01-toast.png`, `desktop-02-after-undo.png`, `desktop-03-committed.png`,
`mobile-01-toast.png`, `mobile-02-after-undo.png`.

**מה נמדד ולמה:** כאן המדד הוא נכונות (מספר הכרטיסים לפני ואחרי כל פעולה ואחרי רענון) ולא ביצועים.
ב-PR המקביל, "טען עוד" בעמוד החברות (#73), המדד היה גודל העמוד: מ-5.4MB ל-355KB.

🔶 **להמחשה**, שלד של בדיקת ה-E2E (לא הקוד המקורי):

```ts
await page.goto("http://localhost:3100/dashboard");
const cards = page.locator("[data-testid=kanban-remove]");
const before = await cards.count();
await cards.first().click();
await expect(page.getByTestId("undo-delete-toast")).toBeVisible();
expect(await cards.count()).toBe(before - 1);
await page.getByTestId("undo-delete").click();
await page.reload();
expect(await cards.count()).toBe(before);
```

ה-`data-testid` (`kanban-remove`, `undo-delete-toast`, `undo-delete`) נוספו לקוד בדיוק כדי לאפשר בדיקה כזו.

---

## שלב 8: PR, CI, מיזוג ובדיקה באתר

**ה-PR:** "feat(dashboard): undo for deleting an application". נפתח ב-10:03, 8 קבצים, 296 שורות נוספו ו-16 נמחקו.

תמצית הגוף בפועל:

> Deleting an application on the dashboard now hides the card and shows a toast "המועמדות נמחקה · בטל"
> for 7 seconds with a countdown bar. בטל restores the card. Nothing is deleted until the timer ends.
>
> How it works: the delete is delayed, not soft. There is no schema change and no migration. A soft delete
> would mean filtering 37+ application queries, and it clashes with `@@unique([userId, jobId])`. …
>
> Tests: `tests/delete-undo.test.ts` (8 tests …). E2E (Playwright on next start, local DB): …
>
> Registry: the applications-board update is added.

**CI:** שתי ריצות ירוקות, שהסתיימו ב-10:07 וב-10:08. Vercel Preview Comments ירוק.

**מיזוג:** ב-10:12 (squash, commit `99c9925`), לפי ההרשאה הקבועה למזג כשה-CI ירוק. סדר המיזוג באותו
סבב: #73 ("טען עוד"), אחריו #74, ואז שדרוגי הספריות #75 ו-#76, כל אחד בנפרד.

**בדיקה באתר החי:** אחרי המיזוג נבדק שה-deploy עלה, ושהעמוד באתר עובד. התרחיש המלא דורש משתמש
מחובר עם מועמדויות אמיתיות, ולכן הוא **לא נבדק** בחשבון של גיא. הוא הועבר אליו כבדיקה לביצוע בעצמו
(ראו הסיכום למטה). זה בדיוק מה שהצ'קליסט דורש: לכתוב במפורש מה לא נבדק.

🔶 **להמחשה**, פקודות הבדיקה אחרי מיזוג:

```bash
gh pr checks 74
gh pr merge 74 --squash --delete-branch
vercel ls job-hunt --prod | head -3        # מצב READY ל-commit 99c9925
curl -s -o /dev/null -w "%{http_code}\n" https://job-hunt-nine-orcin.vercel.app/dashboard
```

---

## שלב 9: שדרוגים

לא היו שדרוגים בפיצ'ר הזה, וזה מכוון: שדרוגי הספריות (`maplibre-gl` ב-#75, `vitest` ב-#76) נעשו
ב-PRs נפרדים, אחד-אחד, אחרי #74. שלוש ספריות לא שודרגו, והסיבה תועדה:

- **Prisma:** התיקון קיים רק ב-7, וזה שינוי ב-82 קבצים, לחולשה בכלי פיתוח שמשתמש באתר לא מגיע אליה.
- **ESLint:** השדרוג דורש מעבר ל-Next 16.
- **shadcn:** אין עדיין גרסה מתוקנת.

---

## שלב 10: תיעוד, ניקוי וסיכום

- **רישום הפיצ'רים** (`src/features/registry.ts`): הרשומה של לוח המועמדויות קיבלה את `prs: [1, 74]`, מילות
  חיפוש `undo` ו-`ביטול`, ושורת `updates`: "מחיקת מועמדות אפשר לבטל תוך 7 שניות מההודעה שקופצת". היא
  מופיעה ב-`/features` תחת "מה חדש".
- **הערות בקוד** מסבירות למה: למה מחיקה מושהית ולא soft delete (בראש `pending-delete.ts`), ולמה keepalive
  ולא server action (ב-route ובקומפוננטה).
- **ניקוי:** שרת ה-`next start`, ה-worktree והמסד המקומי נסגרים בסוף הסבב.

**הסיכום שנשלח לגיא** (מתוך ההודעה בפועל, מקוצר):

> **מחיקת מועמדות** (PR #74) מציגה עכשיו הודעה "המועמדות נמחקה · בטל" למשך 7 שניות. לחיצה על "בטל"
> מחזירה את המועמדות במלואה.
>
> כדאי לבדוק כשאתה מחובר: בדשבורד, למחוק מועמדות, ללחוץ "בטל" ולרענן. המועמדות צריכה לחזור עם כל
> הפרטים שלה.

---

## מה אפשר ללמוד מהדוגמה

1. **ההחלטה החשובה התקבלה בשלב 2, לא בשלב 6.** קריאת הסכמה והשאילתות הראתה ש-soft delete יקר ומסוכן,
   ומחיקה מושהית חסכה migration שלמה.
2. **לוגיקה טהורה שאפשר לבדוק.** הטיימר הוזרק, וכך 8 בדיקות רצות במילישניות.
3. **מקרה הקצה שכמעט נשכח:** עזיבת העמוד באמצע ההמתנה. בלי `flush` ו-keepalive, מחיקות היו "נעלמות"
   ומשתמשים היו רואים את המועמדות חוזרת.
4. **כנות בסיכום.** מה שלא נבדק בחשבון אמיתי נכתב במפורש כ"כדאי שתבדוק".
5. **מה היה אפשר לעשות טוב יותר:** לפתוח issue ולקשר אליו עם `Closes #N` (שלב 1 בצ'קליסט).
