# Work journal ("יומן עבודה")

`/cv/journal` — a tab in the documents hub. A place to write, daily or weekly, what you did at
work, so CV experience bullets come from real, recent work instead of memory.

## Flow

1. **Write an entry** — free text, a date (Israel calendar day, default today) and a role from the
   profile's experience (default: the current role = no end date, else the latest start).
   Stored in `WorkJournalEntry` (`roleKey` = normalized `company|title`).
2. **On save** (`journal_extract`, guarded: daily limits + prompt cache) the entry is read into
   achievements `{action, tech, systems, impact}` and **1–3 short follow-up questions** about the
   missing numbers / impact (time saved, volume, users, before/after). Tech is kept only when it is
   in the entry; an `impact` with a number the user didn't write is dropped. Rules fallback (AI
   off / limit / bad answer): one achievement per sentence (time leads like "ביום ראשון" / "On
   Sunday" removed), tech from the taxonomy, template questions picked by cues (automation,
   integration, bug fix, performance, no metric). The card shows whether AI or rules read it.
3. **Answers** are stored on the entry; their numbers count as the user's own facts.
4. **Suggest experience bullets** (`journal_bullets`): pick a role, a period (30 / 90 / 180 days,
   all, custom range) and optionally one of the top-matching jobs. All entries of that role in the
   period go into one call that returns 2–6 X-Y-Z bullets. Every bullet goes through
   `acceptJournalBullet`: numbers only from the entries + answers, technologies only from the
   entries or the CV, no pronoun, ≤ 300 chars, not a repeat of an existing bullet. Missing numbers
   are `[X%]` / `[N]` / `[מדד]` placeholders. If nothing survives, the rules bullets are shown
   (each achievement + a placeholder result clause, or the user's own answer in parentheses).
   Target-job keywords the user already has are passed as preferred wording; missing ones are only
   shown, never written in.
5. **Accept / edit / reject** — "Add to experience" appends the (edited) bullet to that role's
   description in the profile (an explicit user action); the CV builder then shows it as a bullet.
6. **CV builder** — experience step → "הצעות מיומן העבודה" (`assistJournalAction`): bullets from
   the last 6 months of each draft role's entries (max 3 roles = max 3 calls), draft-only like
   every other assist suggestion, labelled "from your work journal" with the source days.

## Reminders

`WorkJournalSettings` — **off by default**; weekly (default, Thursday 17:00 Israel) or daily, at or
after the chosen hour. The hourly cron (`runJournalReminders` in `runHourly`) sends a `JOURNAL`
notification (in-app + push / Telegram per the user's notification settings and quiet hours),
once per period, and skips it when an entry already exists in that period. The journal page also
shows an in-app nudge when nothing was written in the last 7 days. There is no outgoing email
infrastructure in the app, so there's no email reminder.

## Files

- `src/lib/journal/core.ts` — pure logic (sentences, rules reading, validation, reminders)
- `src/lib/journal/ai.ts` — prompts + guarded calls with fallbacks
- `src/lib/journal/server.ts`, `src/lib/journal/reminders.ts` — DB glue
- `src/app/cv/journal/` — page + server actions; `src/components/journal/WorkJournal.tsx`
- Tests: `tests/journal.test.ts`, e2e "work journal" in `e2e/signed-in.e2e.mjs`
