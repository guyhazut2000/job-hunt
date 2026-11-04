# The final stage: from offer to signed contract (`/closing`, #111)

Everything after "they want me": home assignments, references, reading the contract, resigning in an
orderly way and wrapping up the search once you sign. **Nothing here sends anything.** Every message is a
draft you copy and send yourself; the contract checklist is information, **not legal advice**.

## Pages

| Route                  | What it does                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/closing`             | Hub: open offers (from `JobOffer`, linked to applications), counts of assignments/referees, start a closing from an application, archived batch with undo.                                                                                                                                        |
| `/closing/assignments` | Home assignments per application (`HomeAssignment`): description, link, received/due dates, estimated hours, status, submitted link, notes. Sorted by due date; `?app=` pre-selects the application (the "Home assignment" link on the tracker card).                                             |
| `/closing/references`  | Referees (`Referee`): relation, company, contact details, roles they fit, consent, last contacted. Link a referee to an application (`RefereeLink`) with an expected call time, mark briefed / called / thanked. Copy-only drafts: ask to be a reference, brief before the call, thank-you after. |
| `/closing/[offerId]`   | Per offer (`OfferClosing`): contract checklist, questions to ask before signing, optional pasted-text scan, notice/resignation calculator, resignation letter, handover + first-day lists, 30/60/90 plan, and "I accepted this offer".                                                            |

## Data (additive migration `20261104134921_final_stage`)

- `HomeAssignment`, `Referee`, `RefereeLink` (unique per referee+application), `OfferClosing` (one per
  `JobOffer`; `checklist`, `analysis`, `transition`, `acceptance` are JSON).
- `JobOffer.acceptedAt`, `Application.archivedAt`, `Application.archiveBatch`.
- Archived applications are hidden from the tracker, follow-up/interview/saved-job reminders, the daily
  digest and the weekly coach. `/stats` still counts them (they are history).

## Contract checklist (`src/lib/closing/checklist.ts`)

Each item has a plain explanation, what to look for, the legal minimum **only where the law sets one**, a
question to ask, and official sources (Knesset law texts, gov.il, Bituach Leumi, Kol Zchut, WIPO Lex). Items
without a statutory minimum (e.g. equity/section 102, IP assignment) show no number. Per-offer state:
`ok` / `concern` / `todo` + a note. "Questions before signing" is built from items marked `concern` or
`todo`.

**Updating numbers:** amounts that change yearly (recreation pay per day, travel cap, keren hishtalmut
ceiling) are in the item text with the year. Check the linked source each January and update the text and
the tests in `tests/closing.test.ts`.

### Pasted contract scan

`scanContract` (`src/lib/closing/server.ts`) runs through `guardedLLM("contract_review")` (daily quota,
kill switch). The model may only quote the pasted text; quotes that are not substrings of the text are
dropped. With the mock provider, on quota or on error it falls back to an offline keyword heuristic and
says so (`data-source`). The pasted text is **not stored**; only the per-item findings are.

## Notice and resignation (`src/lib/closing/notice.ts`)

Notice follows the Prior Notice Law: monthly employees – 1 day per completed month for the first 6 months,
then 6 days + 2.5 days per month for months 7–12, and a full month after a year; hourly employees per the
law's table (1 day per month in year 1, 14 days + 1 day per 2 months in year 2, 21 days + 1 day per 2 months
in year 3, a month from year 4). If the contract gives a longer period, the page uses it and says so. From
the planned start date at the new job it computes the latest day to resign. It also links Bituach Leumi on the 90-day unemployment wait after
resigning.

## "I accepted this offer"

One transaction: sets `JobOffer.acceptedAt`, archives the other open applications (`pickArchivable` – not
`REJECTED`, not already archived, not the accepted one) under one `archiveBatch`, optionally pauses job
alerts (high-match alerts and saved-search alerts; previous values are stored in `acceptance`), and records
everything in `OfferClosing.acceptance`. Status is never changed. Undo (30 days) restores exactly that
batch and the alert settings. Thank-you and withdrawal drafts are generated per company to copy.

## Reminders (`DEADLINE` kind, `src/lib/notifications/closing.ts`)

From the hourly cron: a home assignment ~a day (20–27h) and a few hours (0–4h) before its due time
(`assignment:<id>:<iso>:<day|hours>`), and "brief your referee" when an expected reference call is within
48h and the referee wasn't marked briefed (`referee-brief:<linkId>:<iso>`). Push and Telegram on by default;
per-kind channel settings in `/notifications/settings` apply.
