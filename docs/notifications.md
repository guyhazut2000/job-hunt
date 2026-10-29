# Notifications

In-app notification center (bell + `/notifications`), saved searches that alert on new jobs, follow-up
reminders, and two optional outbound channels: **web push** and **Telegram**. Settings live at
`/settings/notifications`.

## What triggers a notification

| Kind               | When                                                                                      | Dedupe key                     |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------ |
| `JOB_MATCH`        | A saved search has new jobs (`Job.createdAt` after the search's `lastCheckedAt`).         | `search:<id>:<iso>`            |
| `SAVED_JOB_CLOSED` | A job you saved (application status `SAVED`) became inactive in the last 3 days.          | `closed:<applicationId>`       |
| `FOLLOW_UP`        | An application is still `APPLIED` and untouched for N days (default 7, 1–60).             | `followup:<id>:<date>`         |
| `INTERVIEW`        | ~24h and ~2h before an `Application.interviewAt` you set on the tracker.                  | `interview:<id>:<iso>:<stage>` |
| `LEARNING`         | In your study slot, if you haven't studied today: streak, reviews, stalled stage.         | `learning:<day>`               |
| `DIGEST`           | Once a day after your digest hour — see [digest.md](digest.md). Telegram only by default. | `digest:<day>`                 |
| `SYSTEM`           | Test notifications from the settings page. In-site only by default.                       | —                              |

Saved searches with a "match ≥" / fit filter only alert on jobs scoring at or above it (default 65)
when the user has a scorable profile. One new job links straight to the job; several are grouped
into one notification that links to the search sorted by newest.

Kinds and channels are stored as strings, so adding a new kind needs no enum migration.

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

- `/api/cron/ingest` — after ingest, runs saved-search alerts and flushes deliveries.
- `/api/cron/notify` at `30 5 * * *` and `0 15 * * *` UTC (07:30 / 17:00 Israel in winter) — runs
  searches, follow-ups, closed-job alerts and flushes deliveries deferred by quiet hours.

- `/api/cron/hourly` — listed 24 times in `vercel.json` (`0 H * * *` for each hour; a Hobby cron may
  run once a day, so one entry per hour). Runs interview reminders, study reminders, daily digests and
  flushes deliveries.

All require `Authorization: Bearer $CRON_SECRET`.

### Timing honesty (Hobby crons)

Hobby crons fire **somewhere inside** the scheduled hour, not on the minute, so two "hourly" runs can
be up to ~2h apart. The reminders are built around that:

- Interview: the "24h" reminder is sent on the first run 3–27h before, the "2h" one on the first run
  0–3h before — so expect it **1–3h** before, never after the interview.
- Study: sent on the first run between your hour and +3h on a scheduled weekday (Israel time).
- Digest: generated on the first run at/after your digest hour, so it arrives up to ~1h late.

If an hourly run is missed entirely (platform hiccup), the next one catches up within those windows.
For minute-precise reminders you would need an external scheduler (e.g. a free cron-job.org job
calling `/api/cron/hourly` every 15 min with the bearer secret) — not set up.

### Study / interview / digest settings

`/settings/notifications` has per-feature on/off: study reminders (hour, weekdays, idle-days
threshold), interview reminders, and the daily digest (hour). Channels per kind are in the same
table as the other kinds. Interview dates are entered on the tracker card (`/dashboard`) in Israel time.

## Environment

| Variable                  | Purpose                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`        | Web push public key (sent to the browser).                                            |
| `VAPID_PRIVATE_KEY`       | Web push private key — server only, mark **sensitive**.                               |
| `VAPID_SUBJECT`           | `mailto:` contact for push services (default `mailto:notifications@job-hunt.local`).  |
| `TELEGRAM_BOT_TOKEN`      | Enables the Telegram channel. Without it the UI says "not configured".                |
| `TELEGRAM_BOT_USERNAME`   | Bot username without `@`, used for the one-tap `t.me/<bot>?start=CODE` link.          |
| `TELEGRAM_WEBHOOK_SECRET` | Shared secret Telegram sends in `X-Telegram-Bot-Api-Secret-Token`.                    |
| `APP_URL`                 | Public base URL for links in push/Telegram (falls back to the Vercel production URL). |

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
