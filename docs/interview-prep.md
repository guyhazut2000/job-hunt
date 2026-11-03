# Interview prep page per application (#93)

`/prep/[id]` (application id) — one page that gathers everything for the next interview at one company.
Linked from every tracker card on `/dashboard` ("הכנה לראיון").

## Sections

| Section                    | What it shows                                                                                                                                                               | Code                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| סקירה                      | Status, next interview date/note, tech stack, link to the posting on the company site, company page                                                                         | `src/app/prep/[id]/page.tsx`                                 |
| סיכום AI · **לא מאומת**    | 2–4 sentence overview + 3–5 focus points, built only from the posting text and the stages. Always labelled "לא מאומת". Template fallback without AI.                        | `src/components/prep/PrepSummaryCard.tsx`, `generateSummary` |
| שלבי התהליך                | Editable list (kind, title, date, done, note, reorder, add/remove). Default: the user's own hiring process for the company → the official one → a typical process.          | `src/components/prep/PrepEditor.tsx`                         |
| סיפורים להביא (הסיפור שלי) | The user's work stories; pre-selected ones match the suggested topics (exact `kind:itemId`) or mention the job's tech.                                                      | `suggestStories` in `src/lib/prep/plan.ts`                   |
| נושאי DS&A                 | Data structures / patterns suggested from keywords in the stack + description; core array/hash-map/two-pointers/sliding-window for coding stages. Links to the learn pages. | `suggestTopics`                                              |
| שאלות לשאול את החברה       | Static bank per stage kind (general + each stage), plus your own (typed or voice). Tick "שאלתי".                                                                            | `defaultQuestions`                                           |
| סימולציית ראיון            | Link to `/interview?app=<id>` — the simulation scoped to this application/job.                                                                                              |                                                              |
| סיכום אחרי ראיון           | Stage, date, rating 1–5, outcome (מחכה / עברתי / לא עברתי), what they asked / went well / to improve (voice input). Saved per application; listed with delete.              | `src/components/prep/DebriefSection.tsx`                     |

Nothing is saved until "שמירה" (stages, stories, topics, questions). The AI summary is saved when generated.

## Data

- `InterviewPrep` (one per application, `applicationId` unique): `stages` JSON, `storyIds`, `topics`
  (`ds:<id>` / `pattern:<id>`), `questions` JSON, `summary` JSON `{text, focus, source, at}`.
- `InterviewDebrief`: `stageKind`, `happenedAt`, `rating`, `asked`, `wentWell`, `improve`, `outcome`.
- Migration `20261103233500_interview_prep` (additive). JSON fields are validated with zod (`src/lib/prep/plan.ts`);
  server actions in `src/app/prep/actions.ts` check ownership of the application and of each story id.

## AI

Feature `interview_prep` via `guardedLLM` (daily limits apply). Prompt gets title, company, tech stack, stage
titles and the first 1,500 characters of the posting only. The answer is accepted only if it matches the
schema, has no placeholders and names the company or a word from the title; otherwise the template is used.
On a limit error the template is shown with "הגעתם למכסת ה-AI היומית".

## Stats

`/stats` → "ראיונות (מסיכומים אחרי ראיון)": number of debriefs, average rating, passed / failed / waiting,
per stage (count, average, passed/decided) and the three latest "what to improve" notes (`debriefStats`).

## Tests

`tests/interview-prep.test.ts` — default stages, topic and story suggestions, question bank, summary
template/AI validation, `generatePrepSummary` (mock/ai/invalid/limited), debrief stats and the server actions'
ownership checks.
