# Notifications

In-app notification center (bell + `/notifications`), saved searches and followed companies that
alert on new jobs, scan-failure alerts, follow-up reminders, and two optional outbound channels: **web push** and **Telegram**. Settings live at
`/settings/notifications`.

## What triggers a notification

| Kind                | When                                                                                                                                                                    | Dedupe key                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `JOB_MATCH`         | A saved search has new jobs (`Job.createdAt` after the search's `lastCheckedAt`).                                                                                       | `search:<id>:<iso>`             |
| `COMPANY_JOBS`      | A company you follow published new jobs (not already sent to you by a saved search).                                                                                    | `company:<followId>:<iso>`      |
| `SCAN_FAILED`       | A company's feed failed 3 scans in a row — once per outage. Push off by default.                                                                                        | `scanfail:<companyId>:<streak>` |
| `SAVED_JOB_CLOSED`  | A job you saved or applied to (`SAVED`/`APPLIED`/`SCREENING`/`INTERVIEW`) became inactive in the last 3 days.                                                           | `closed:<applicationId>`        |
| `SAVED_JOB_UPDATED` | The employer edited such a job (title, location, work mode, pay or description) in the last 3 days.                                                                     | `updated:<applicationId>:<iso>` |
| `STAGE_CHANGE`      | An application moved to `SCREENING`/`INTERVIEW`/`OFFER`, or you marked a new hiring stage; adds the next stage of the company's published process. Push off by default. | `stage:<applicationId>:<status  | stage>:<key>` |
| `WHATS_NEW`         | A `src/lib/whats-new.ts` entry flagged `announce`, within 7 days of its date. In-site only by default.                                                                  | `whatsnew:<entryId>`            |
| `FOLLOW_UP`         | An application is still `APPLIED` and untouched for N days (default 7, 1–60).                                                                                           | `followup:<id>:<date>`          |
| `INTERVIEW`         | ~24h and ~2h before an `Application.interviewAt` you set on the tracker.                                                                                                | `interview:<id>:<iso>:<stage>`  |
| `LEARNING`          | In your study slot, if you haven't studied today: streak, reviews, stalled stage.                                                                                       | `learning:<day>`                |
| `DIGEST`            | Once a day after your digest hour — see [digest.md](digest.md). Telegram only by default.                                                                               | `digest:<day>`                  |
| `SYSTEM`            | Test notifications from the settings page. In-site only by default.                                                                                                     | —                               |

Saved searches with a "match ≥" / fit filter only alert on jobs scoring at or above it (default 65)
when the user has a scorable profile. One new job links straight to the job; several are grouped
into one notification that links to the search sorted by newest.

Kinds and channels are stored as strings, so adding a new kind needs no enum migration.

### Saved-job updates (`SAVED_JOB_CLOSED`, `SAVED_JOB_UPDATED`)

Every ingest computes `Job.contentHash` (`src/lib/jobs/content-hash.ts`): a short per-field SHA-1 of
the normalized title, location, work mode, pay and description, so whitespace/case-only edits don't
count and no old text is stored. When a re-scan sees a different hash, `upsertJob` stamps
`Job.contentChangedAt` and `Job.changedFields`; the notify cron (`runSavedJobUpdated`) then tells
everyone with that job saved or in progress, naming the fields ("pay, description"). The first hash
on an existing row is a baseline, not a change. List-only sources (Workday, SmartRecruiters…) only
re-read details for new postings, so their edits are not detected — closures are.

### Hiring-stage changes (`STAGE_CHANGE`)

The hourly cron (`runStageChanges`, `src/lib/notifications/stage-change.ts`) looks back 26h at
`ApplicationStatusChange` rows to `SCREENING`/`INTERVIEW`/`OFFER` that still hold (not undone or
overwritten) and at applications whose `currentStage` was set. The body says what comes next in the
company's official hiring process (job-level, else company-level; `nextStage()`) and points at the job
page to prepare. Changes made by the email scan (`EMAIL_AUTO`) already get an `EMAIL_UPDATE` notice, so
they are not repeated.

### What's new (`WHATS_NEW`)

`/whats-new` (link in "More" and on `/notifications`) lists `src/lib/whats-new.ts`, newest first. Add an
entry in the same PR as a feature; set `announce: true` only for changes worth a notification. The notify
cron sends each announced entry once per user (skipping users who joined after it).

### Instant or daily digest, per kind

Each kind has an "instant / in the daily digest" select in `/settings/notifications`
(`NotificationPreference.modes`, `{ "<KIND>": "digest" }`; default instant). A kind set to digest is
still written in-site at once, but gets no push/Telegram delivery (`data.delivery = "digest"`); the next
daily digest lists it in a "🔔 Held for the digest" section. New-job kinds (`JOB_MATCH`, `COMPANY_JOBS`)
are already summed in the digest's jobs section, so they are not listed twice. `INTERVIEW` and `DIGEST`
are always instant. If the digest itself is off, held kinds are only in-site (the settings page warns).

**No email digest.** The app's Gmail access is read-only (`gmail.readonly`, for status detection), and
sending mail would need an SMTP/transactional provider (an extra account, domain verification/DNS,
and a sender reputation to maintain) — not "free and simple". The digest goes to the site and Telegram
(and web push) instead.

### Followed companies (`COMPANY_JOBS`)

"Follow" / "Following" on a company page (signed-in users; up to 100 companies) creates a
`CompanyFollow` row. Following starts **now**: only jobs whose `Job.createdAt` is after the follow's
`lastCheckedAt` are alerted. After each scan, `runFollowedCompanyAlerts()` sends one grouped
notification per followed company (one job → links to the job, several → links to the company page),
then moves `lastCheckedAt`. Jobs the user already got in a `JOB_MATCH` alert in the same window are
left out, so one job never alerts twice. The list (with unfollow) is under "Companies I follow" in
`/settings/notifications`; channels per kind are in the usual table. The daily digest counts both
kinds as "new jobs".

### Scan failures (`SCAN_FAILED`)

`ingestCompany` already counts consecutive failures per company (`Company.syncFailures`, reset on
success). `runScanFailureAlerts()` picks AUTO companies with `syncFailures >= 3` whose last error is
from the last 2 days and records a `ScanFailureAlert(companyId, streakKey)` — the streak key is the
company's last successful sync (`lastSyncedAt` or `never`), which stays the same for the whole outage.
The unique key makes it race-safe and **one alert per outage, not per scan**: a company failing for a
week is reported once; if it recovers and breaks again, that's a new streak and a new alert.

- **Admins** (`User.role = ADMIN`) get one grouped notification per run listing the newly failing
  companies and their errors (links to `/admin`, which lists failing feeds).
- **Followers** of a failing company get one notification each ("we can't read their jobs right now —
  check their careers page"), linking to the company page, which shows the careers link and the
  failing-feed notice. Admins who follow it are covered by the grouped one.
- Push is off by default for this kind (Telegram + in-site on); the hourly cap and quiet hours apply.
- If the whole fast-scan request fails (app down, 5xx, bad secret), the GitHub Actions run fails and
  GitHub emails the repo owner — that is the "scanner itself is broken" alert.

## Delivery

`notify()` always writes the in-site row, then queues a `NotificationDelivery` per enabled external
channel with `nextAttemptAt` pushed past quiet hours. `processDeliveries()`:

- re-checks quiet hours (Israel time, `22:00–07:00` by default, optional Shabbat Fri 16:00 → Sat 20:00);
- skips rows older than 2 days and anything over the per-user hourly cap (default 6) — `INTERVIEW`
  and `DIGEST` are exempt from the cap;
- skips rows whose `data.expiresAt` has passed (an interview reminder deferred by quiet hours past the
  interview itself is never sent; if the deferral already lands after it, only the in-site row is written);
- sends `data.telegramHtml` verbatim to Telegram when present (the daily digest);
- retries with backoff 5 → 10 → 20 → 40 min, marking `FAILED` after 5 attempts;
- deletes a channel on a permanent error (push 404/410, Telegram 403 / chat not found).

## Schedule (Vercel Hobby: daily crons only)

- `/api/cron/ingest` — after ingest, runs saved-search, followed-company and scan-failure alerts and
  flushes deliveries.
- `/api/cron/scan` — the **fast scan**, every 15 min in the daytime from GitHub Actions (below).
- `/api/cron/notify` at `30 5 * * *` and `0 15 * * *` UTC (07:30 / 17:00 Israel in winter) — runs
  searches, followed companies, scan failures, follow-ups, saved-job closed/updated alerts, what's-new
  announcements and flushes deliveries
  deferred by quiet hours.

- `/api/cron/hourly` — listed 24 times in `vercel.json` (`0 H * * *` for each hour; a Hobby cron may
  run once a day, so one entry per hour). Runs interview reminders, hiring-stage changes, study reminders, daily digests and
  flushes deliveries.

All require `Authorization: Bearer $CRON_SECRET` (`/api/cron/scan` also accepts
`$SCAN_TRIGGER_SECRET`).

## Fast scan

Vercel Hobby crons run at most once a day each, so new jobs used to wait up to a day. The fast scan
uses **GitHub Actions' scheduler** (free) to call the app more often:

- `.github/workflows/fast-scan.yml` runs `*/15 5-19 * * *` UTC (07:00–21:45 Israel in winter,
  08:00–22:45 in summer) plus a manual "Run workflow" button. It sends one `POST /api/cron/scan` with
  `Authorization: Bearer $SCAN_TRIGGER_SECRET` and fails (→ GitHub email) on a non-200 response. The
  runner never gets database credentials.
- `/api/cron/scan` (`maxDuration` 120 s) refreshes the **stalest** AUTO boards for 45 s
  (`FAST_SCAN_BUDGET_MS`, same `ingestAllDetailed` as the daily crons, without the sources sync),
  then immediately runs saved-search, followed-company and scan-failure alerts and flushes the send
  queue. Boards it didn't reach are first in line next time, so every board is visited in rotation.
- Only **stale** boards are scanned: synced more than an hour ago (`FAST_SCAN_STALE_MS`), never synced,
  or failing. Boards the daily run or an earlier tick just read are counted as `fresh` and skipped.
- The response summary: `companies` scanned this tick, `remaining` = stale boards it didn't reach
  (the real backlog, per provider in `remainingByProvider`), `fresh` = skipped as recently synced.
  Before this filter `remaining` counted every board the tick didn't get to (e.g. 152–154 of ~337 on
  every tick, even right after a full daily run), because each tick re-read already-fresh boards.
  Comeet (~170 boards, one shared host, ~40 boards per tick) is usually the only provider with a
  backlog.
- If an ingest run (daily cron or a previous fast scan) started in the last 6 minutes and hasn't
  finished, the tick is skipped (`{"skipped":"scan in progress"}`).
- Typical latency from "posted on the company's ATS" to your phone: ~15–40 min in the daytime
  (rotation + GitHub's schedule delay). Overnight only the daily crons run; quiet hours hold
  push/Telegram until morning anyway.

### Free-tier budget (why every 15 min, daytime only)

| Resource                    | Free limit                       | Fast scan cost (estimate)                                                                                                            |
| --------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Actions              | Unlimited on a **public** repo   | ~60 runs/day × <1 min. If the repo goes private: ~60 billed min/day ≈ 1,800 of the 2,000 free min/month — reduce to `*/30`.          |
| Vercel function duration    | 300 s max (Hobby)                | 45 s scan + alerts, `maxDuration` 120 s.                                                                                             |
| Vercel active CPU           | 4 CPU-h/month                    | The scan is mostly waiting on HTTP; a few CPU-seconds per run → roughly 1.5–3 CPU-h/month. Watch the Usage page.                     |
| Vercel memory / invocations | 360 GB-h, 1M invocations         | ~60 × ~50 s × 2 GB ≈ 50 GB-h/month; invocations negligible.                                                                          |
| Neon compute                | 100 CU-h/month (0.25 CU ≈ 400 h) | Keeps the DB awake most of the 15 daytime hours (it suspends after 5 idle min): ≈ 6–9 h/day ≈ 45–70 CU-h/month with everything else. |

Tuning: change the `cron:` line in the workflow (e.g. `*/30` halves every cost above, or widen the
hours) or `FAST_SCAN_BUDGET_MS`. To pause it, disable the workflow in the GitHub Actions tab (or
remove the repo secret — the job then exits with a warning). Scheduled workflows are paused by
GitHub after 60 days without repo activity; re-enable them in the Actions tab.

Not chosen: running the scan on the Actions runner itself (would need `DATABASE_URL` as a GitHub
secret — more exposure) and Vercel Pro crons (paid).

### Timing honesty (Hobby crons)

Hobby crons fire **somewhere inside** the scheduled hour, not on the minute, so two "hourly" runs can
be up to ~2h apart. The reminders are built around that:

- Interview: the "24h" reminder is sent on the first run 3–27h before, the "2h" one on the first run
  0–3h before — so expect it **1–3h** before, never after the interview.
- Study: sent on the first run between your hour and +3h on a scheduled weekday (Israel time).
- Digest: generated on the first run at/after your digest hour, so it arrives up to ~1h late.

If an hourly run is missed entirely (platform hiccup), the next one catches up within those windows.
For minute-precise reminders you would need an external scheduler calling `/api/cron/hourly` more
often — not set up (new-job alerts do get one: the fast scan below).

### Study / interview / digest settings

`/settings/notifications` has per-feature on/off: study reminders (hour, weekdays, idle-days
threshold), interview reminders, and the daily digest (hour). Channels per kind are in the same
table as the other kinds. Interview dates are entered on the tracker card (`/dashboard`) in Israel time.

## Environment

| Variable                  | Purpose                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`        | Web push public key (sent to the browser).                                                                                      |
| `VAPID_PRIVATE_KEY`       | Web push private key — server only, mark **sensitive**.                                                                         |
| `VAPID_SUBJECT`           | `mailto:` contact for push services (default `mailto:notifications@job-hunt.local`).                                            |
| `TELEGRAM_BOT_TOKEN`      | Enables the Telegram channel. Without it the UI says "not configured".                                                          |
| `TELEGRAM_BOT_USERNAME`   | Bot username without `@`, used for the one-tap `t.me/<bot>?start=CODE` link.                                                    |
| `TELEGRAM_WEBHOOK_SECRET` | Shared secret Telegram sends in `X-Telegram-Bot-Api-Secret-Token`.                                                              |
| `APP_URL`                 | Public base URL for links in push/Telegram (falls back to the Vercel production URL).                                           |
| `SCAN_TRIGGER_SECRET`     | Bearer secret for `/api/cron/scan`; the same value is the GitHub Actions repo secret `SCAN_TRIGGER_SECRET`. Mark **sensitive**. |

Generate VAPID keys once with `npx web-push generate-vapid-keys` and store them in Vercel
(Production + Preview). Never commit them.

## Setting up Telegram

1. In Telegram, open **@BotFather** → `/newbot` → pick a name and a username ending in `bot`.
2. Copy the token BotFather gives you.
3. In Vercel → Project → Settings → Environment Variables add `TELEGRAM_BOT_TOKEN` (sensitive),
   `TELEGRAM_BOT_USERNAME`, and a random `TELEGRAM_WEBHOOK_SECRET` (e.g. `openssl rand -hex 24`,
   letters/digits/`_`/`-` only). Redeploy.
4. Register the webhook (once):

   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://job-hunt-nine-orcin.vercel.app/api/telegram/webhook&secret_token=<SECRET>
   ```

5. In the app: **Notification settings → Connect Telegram**, tap the link (or send `/start CODE`
   to the bot). Codes are 8 characters, stored hashed, and expire after 15 minutes. `/stop` in the
   chat disconnects.

The webhook returns 404 when Telegram isn't configured, 401 on a bad secret, and otherwise always
200 so Telegram doesn't retry. Only private chats are accepted.
