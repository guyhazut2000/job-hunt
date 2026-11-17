# Activity log (`/admin/activity`)

An in-app audit log of what users do, visible **only** to the owner account.

## What is recorded

| Event                | When                                                     |
| -------------------- | -------------------------------------------------------- |
| `sign_in`            | Successful credentials sign-in (Auth.js `events.signIn`) |
| `sign_in_failed`     | Wrong email/password (the attempted email is kept)       |
| `sign_out`           | Log out (Auth.js `events.signOut`)                       |
| `sign_up`            | New account                                              |
| `page_view`          | A signed-in user opens a page (client beacon, see below) |
| `job_saved`          | Job saved to the tracker                                 |
| `application_status` | Manual application status change                         |
| `cv_uploaded`        | CV uploaded                                              |

Each row has the time, user (id + email copied at write time), pathname (never the query string),
approximate location from Vercel's `x-vercel-ip-country` / `-country-region` / `-city` headers,
coarse device/OS/browser parsed from the user-agent, and `ipHash` — the first 16 hex chars of
`sha256(AUTH_SECRET + ":" + ip)`. **Raw IPs are never stored.**

## Page views

`ActivityBeacon` (rendered by the root layout for signed-in users only) sends
`navigator.sendBeacon("/api/activity", {"path": "/jobs"})` on each client navigation. Repeat views of
the same path within 30 s are skipped (sessionStorage). The server validates the path (no `/_next`,
`/api`, static files, query strings), drops bots by user-agent, ignores guests and `/admin/activity`
itself, and always answers `204`. Prefetches never fire it (only real navigations change the pathname).

## Access

`ACTIVITY_LOG_VIEWERS` (comma-separated emails) — defaults to `guyhazut2000@gmail.com`. The page
returns 404 for any other signed-in user (including other `ADMIN`s) and redirects guests to login.
`GET /api/activity` returns the same data as JSON and `403` for everyone else.

## Retention

The hourly cron (`/api/cron/hourly`) deletes rows older than 90 days. Deleting a user cascades to their rows.

## Failure mode

`recordActivity` never throws: if the insert fails (e.g. a preview deployment running ahead of the
production schema) it logs a warning and the product continues.

Server errors are not here — use Vercel's **Runtime Logs** (project → Logs) for those.
