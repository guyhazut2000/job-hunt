# עוזר פניות בלינקדין (Outreach assistant) — #86

Route: `/outreach` (link from the dashboard's outreach section).

## What it does

- **"יום בלי כוח" queue**: N ready drafts (default 5, setting 3–10), one per company:
  saved jobs → a peer (referral), applied → team lead, fresh matches in your target roles → recruiter.
  Companies you wrote to in the last 21 days are skipped.
  Each card: LinkedIn **people-search** link ("פתח בלינקדין", labelled `מקור חיצוני · לא מאומת`),
  a connection note ≤ 300 chars (he/en) with live char count, copy button, "שפר עם AI" (via `guardedLLM`, cached,
  template fallback), optional name (with voice input) + profile URL, and **"סימנתי שנשלח"** which logs a Contact (status SENT).
- **Tracker**: manually entered contacts, statuses נשלחה בקשה / התקבלה / הגיב / הפנה, with sent / last-change dates.
  One-tap next-status buttons per row (נשלחה בקשה → התקבלה / הגיב/ה, התקבלה → הגיב/ה, הגיב/ה → הפנה/תה),
  row checkboxes + "בחר הכל" and a bulk "עדכן" (max 100, one transaction, own contacts only) — #95.
- **"התקבלה?" check**: halfway to the nudge (`max(1, floor(N/2))` days after sending, while still "נשלחה בקשה"),
  the row gets a "לבדוק אם התקבלה" chip and the cron sends one `FOLLOW_UP` notification
  (dedupe `outreach:<id>:check:<day>`). It stops once the nudge is due or the status changes — #95.
- **Daily goal + streak** (Israel time): goal 1–20/day, streak counts consecutive days that met the goal
  (yesterday's streak stays alive until today ends), 7-day strip.
- **Follow-ups**: accepted → next day ("thanks + the ask"); unanswered request → after N days (2–14, default 5).
  Due ones show at the top with he/en drafts (template or AI) and "סימנתי שעשיתי פולואפ".
  The notifications cron (`runOutreachFollowUps`) creates a `FOLLOW_UP` notification once per contact/step (dedupe key).

## Hard limits (by design)

- **Nothing is ever sent automatically.** The app only drafts text and opens LinkedIn search URLs; you send yourself.
- No LinkedIn scraping, fetching, API automation or browser automation.

## Code

- `src/lib/outreach/assistant.ts` — pure: goal/streak, follow-up due, status timestamps, queue picking.
- `src/lib/outreach/followup.ts` — follow-up templates + AI.
- `src/lib/outreach/server.ts` — dashboard loader. `src/app/outreach/actions.ts` — server actions.
- `src/lib/notifications/outreach.ts` — reminders. UI in `src/components/outreach/assistant/`.
- Migration `20261103160000_outreach_assistant` (additive): `ContactStatus.ACCEPTED`, `Contact.sentAt/statusAt/followedUpAt`, `OutreachPrefs`.
- Tests: `tests/outreach-assistant.test.ts`, `tests/outreach-status-friction.test.ts`.

## Known gaps

- Streak/history comes from saved contacts — deleting a contact removes it from past counts.
- LinkedIn "accepted" / "replied" can't be detected; you update the status yourself.
