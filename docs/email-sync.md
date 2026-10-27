# Email sync: auto-detect job applications from Gmail

Users connect Gmail (read-only). A scanner finds application confirmations and status updates
(interview, rejection, offer) and matches each one to a company and job on the board. A
confident match is added to the Applications board with source `EMAIL` automatically. Anything
less certain goes to a **pending-review queue** on `/dashboard`, where the user approves it
(choosing a job, an existing application, or a custom title and company) or dismisses it.

Settings live at `/settings/email`: connect/disconnect, lookback (7/14/30/90 days or custom 1–365),
frequency (manual / daily / every 6 h), confidence level (strict 85 / balanced 70 / aggressive 50
points), a status-updates toggle, and **Scan now** with the last scan's time (Israel time) and a summary.

## How detection works

1. **Search (Gmail `q`)**: `newer_than:Nd -in:chats -in:sent` plus English and Hebrew phrases
   ("thank you for applying", "קיבלנו את מועמדותך", …) or ATS senders (Greenhouse, Lever, Comeet,
   Workday, SmartRecruiters, Ashby, LinkedIn jobs, …). At most 150 messages per scan.
2. **Metadata first**: the scanner fetches only `From`, `Subject`, `Date`, and Gmail's snippet
   (`format=metadata`). It fetches the plain-text body only when the snippet isn't enough to
   find the company or title (at most 25 per scan, truncated to 4,000 characters), uses it in
   memory, and never stores it.
3. **Classify → extract → fuzzy match → score** (`src/lib/email/*`): the kind is offer > rejected >
   interview > application. Company and title are extracted from the text, the sender name, or the
   domain, then matched against companies and jobs with token Dice similarity plus the company
   website domain. Points come from phrase location, an ATS sender, where the company was found,
   the company and job match, and whether a title was extracted.
4. **Act**:
   - At or above the threshold, a new application is created (`source=EMAIL`, `emailMessageId`,
     linked to the job, or `url` = the Gmail message link for a custom job). For a status update, the
     existing application's status moves forward only: it never goes backwards, never leaves
     REJECTED, and OFFER is never overwritten by REJECTED.
   - Between 40 and the threshold, the item goes to the review queue. Below 40 it is skipped.
   - Duplicates are recorded as `DUPLICATE`: the same message seen again (unique per
     user + provider + message) or an application that already exists for the job or company + title.

## Privacy

- Scope: `https://www.googleapis.com/auth/gmail.readonly` only. The app cannot send, delete, or modify mail.
- Stored per detected message: message id, thread id, sender, subject, date, the extracted company
  and title, the confidence, and the reasons. **No email bodies are stored.**
- The refresh token is encrypted at rest with AES-256-GCM (`EMAIL_TOKEN_ENC_KEY`). Access tokens are never stored.
- Disconnecting revokes the token at Google and deletes the account row. Users can also revoke
  access at https://myaccount.google.com/permissions.
- Logs never contain tokens or message content.

## Google Cloud setup

1. https://console.cloud.google.com → create (or select) a project, e.g. `job-hunt`.
2. **APIs & Services → Library → Gmail API → Enable**.
3. **OAuth consent screen** (Google Auth Platform → Branding / Audience / Data access):
   - User type **External**, publishing status **Testing**.
   - App name, support email, developer contact. Authorized domain: `vercel.app` (or your own domain).
   - Data access → add scope `.../auth/gmail.readonly`.
   - Audience → **Test users**: add every Gmail address that should be able to connect (max 100).
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URIs:
     - `https://job-hunt-nine-orcin.vercel.app/api/email/google/callback`
     - `http://localhost:3000/api/email/google/callback`
   - (Authorized JavaScript origins are not needed; the flow is server-side.)
5. Copy the client ID and secret into the env vars below.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name                   | Value                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth client ID                                                                        |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret                                                                    |
| `EMAIL_TOKEN_ENC_KEY`  | `openssl rand -base64 32` (keep it stable; rotating it invalidates connected accounts) |
| `GOOGLE_REDIRECT_URI`  | optional; only if the public origin differs from the request origin                    |
| `CRON_SECRET`          | already used by the ingest cron; Vercel sends it as `Authorization: Bearer …`          |

If any of the first three is missing, the feature is off: the settings page says "not configured", and the connect route and cron do nothing.

## Cron

`vercel.json` runs `/api/cron/email-sync` daily at `05:00 UTC` (07:00/08:00 Israel time). The route
checks `CRON_SECRET`, then scans only users whose frequency is due (DAILY ≥ 20 h since the last
scan, EVERY_6H ≥ 5 h). Manual users are never scanned by cron. The Hobby plan only allows daily
crons, so the every-6-hours option needs Pro with the schedule `0 */6 * * *`.

## Caveats

- `gmail.readonly` is a **restricted scope**. Testing mode works for up to 100 listed test users.
  Publishing to everyone requires Google verification, including a **CASA security assessment**.
- In Testing mode, Google **expires refresh tokens after 7 days**. The scan then records
  `reconnect_required`, and the user has to reconnect.
- The migration `20261027190000_email_sync` is additive only. Apply it after merging
  (`npx prisma migrate deploy` against prod), after #8's migration.

## Local demo without Gmail

`npx tsx scripts/email-sync-demo.ts demo@job-hunt.local --reset` runs the real pipeline on synthetic
emails (localhost DB only) to fill the review queue.
