# Notifications

In-app notification center (bell + `/notifications`), saved searches that alert on new jobs, follow-up
reminders, and two optional outbound channels: **web push** and **Telegram**. Settings live at
`/settings/notifications`.

## What triggers a notification

| Kind               | When                                                                              | Dedupe key               |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------ |
| `JOB_MATCH`        | A saved search has new jobs (`Job.createdAt` after the search's `lastCheckedAt`). | `search:<id>:<iso>`      |
| `SAVED_JOB_CLOSED` | A job you saved (application status `SAVED`) became inactive in the last 3 days.  | `closed:<applicationId>` |
| `FOLLOW_UP`        | An application is still `APPLIED` and untouched for N days (default 7, 1–60).     | `followup:<id>:<date>`   |
| `SYSTEM`           | Test notifications from the settings page. In-site only by default.               | —                        |

Saved searches with a "match ≥" / fit filter only alert on jobs scoring at or above it (default 65)
when the user has a scorable profile. One new job links straight to the job; several are grouped
into one notification that links to the search sorted by newest.

Kinds and channels are stored as strings, so adding a new kind needs no enum migration.

## Delivery

`notify()` always writes the in-site row, then queues a `NotificationDelivery` per enabled external
channel with `nextAttemptAt` pushed past quiet hours. `processDeliveries()`:

- re-checks quiet hours (Israel time, `22:00–07:00` by default, optional Shabbat Fri 16:00 → Sat 20:00);
- skips rows older than 2 days and anything over the per-user hourly cap (default 6);
- retries with backoff 5 → 10 → 20 → 40 min, marking `FAILED` after 5 attempts;
- deletes a channel on a permanent error (push 404/410, Telegram 403 / chat not found).

## Schedule (Vercel Hobby: daily crons only)

- `/api/cron/ingest` — after ingest, runs saved-search alerts and flushes deliveries.
- `/api/cron/notify` at `30 5 * * *` and `0 15 * * *` UTC (07:30 / 17:00 Israel in winter) — runs
  searches, follow-ups, closed-job alerts and flushes deliveries deferred by quiet hours.

Both require `Authorization: Bearer $CRON_SECRET`.

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
