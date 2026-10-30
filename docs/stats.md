# Search statistics (`/stats`)

A per-user page that answers "how is my job search going?" from the tracker data. Linked from the
header's "more" menu, the mobile menu, and a card on the dashboard. Computation is a pure function
(`src/lib/stats/search-stats.ts`, tested in `tests/search-stats.test.ts`); the page only loads rows
and renders.

## Data

- `Application` rows of the signed-in user (up to 3000), with `job.domain` and `job.source`.
- `ApplicationStatusChange` history rows, including automatic email updates (`EMAIL_AUTO`) and
  reviewed ones (`EMAIL_REVIEW`). The change time is the email date when known, otherwise the row's
  creation time. Undone changes are ignored.
- Rows from before history existed fall back to `statusChangedAt`.

## Definitions

| Metric            | Meaning                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Applied           | Status beyond SAVED, or an `appliedAt`, or rejected.                                          |
| Response          | Any reply: screening, interview, offer **or rejection**.                                      |
| Interview / offer | Furthest stage ever reached (a later rejection doesn't erase an interview).                   |
| Time to response  | Days from applied to the first response change. Median, fastest, slowest.                     |
| Rejected at       | The stage the application was at when the rejection arrived.                                  |
| Stuck             | Still APPLIED for 14+ days, or SCREENING / INTERVIEW for 10+ days, with no movement.          |
| Bottleneck        | The funnel step (applied→response→interview→offer) with the lowest conversion.                |
| Source            | The job's ATS (Greenhouse, Comeet, …); "email" when found in mail with no job; else external. |
| Trend             | Last 12 Israel weeks (Sunday start): applications and responses per week.                     |

## Small data

Percentages are hidden until there are 5 applications (`MIN_FOR_RATES`), and per-row/per-step rates
until a row has 3 (`MIN_ROW_FOR_RATE`); counts are always shown. With no applications the page shows
an empty state pointing to the jobs board and the tracker.
