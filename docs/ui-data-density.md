# UI data density: long lists at scale (#112)

How the app stays usable when a user has hundreds of applications, contacts, jobs or notifications.
Read this before adding a list that can grow without a bound.

## How it was measured

`scripts/seed-stress.ts` fills a **local** database (it refuses any non-localhost `DATABASE_URL`)
with 400 companies and 3,000 jobs (300 open at `stress-co-1`), 400 applications, 300 contacts,
120 referrals, 400 notifications, 60 saved searches, 80 company follows and 150 salary data points. Every page was
loaded signed in, in Hebrew, at 1440×900 and 390×844, measuring document height, DOM nodes, load
time and horizontal overflow (`documentElement.scrollWidth - clientWidth`).

Screenshots and raw numbers: `/workspace/job-hunt-shots/data-density/` (`before-*`, `after-*`,
`before-metrics.json`, `after-metrics.json`).

## Evidence and the pattern chosen

| Page                      | Before (390)                   | After (390)   | Problem                                                                                | Pattern                                                                                                                                                                                                           |
| ------------------------- | ------------------------------ | ------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/outreach`               | 138,041 px · 12.1k nodes       | 12,766 · 1.3k | Tracker rendered every contact; due follow-ups unbounded                               | Tracker: filter box (name/company/role), 20 rows + "הצג עוד", sticky bulk bar, select-all = visible rows only, `#contact-<id>` reveals its row. Due list: 3 + "הצג עוד"                                           |
| `/dashboard`              | 96,545 px · 46.9k nodes        | 8,848 · 6.3k  | Kanban columns with 400 cards, each with every control; follow-ups, review queue       | Kanban: 20 cards per column + "הצג עוד", sticky toolbar with filter + density toggle (מפורטת/צפופה, auto צפופה from 30 cards), internal column scroll on xl, `#app-<id>` stays visible. Other sections: show-more |
| `/companies/[slug]`       | 89,505 px · 15.2k nodes        | 11,025 · 2.0k | 300 open roles in one list                                                             | `?show=` "טען עוד", 24 per batch. Salary bands, stack and counts still use all jobs                                                                                                                               |
| `/referrals`              | 46,092 px · 18.7k nodes        | 6,214 · 1.2k  | A 400-option application `<select>` in every row; all rows and insiders rendered       | `LazySelect` (options mount on focus), 10 + "הצג עוד" for the tracker and the insider list, `#referral-<id>` / `?contact=` reveal                                                                                 |
| `/features`               | 26,402 px                      | ≈21,000       | Every card of every category, 10 changelog days                                        | 6 cards per category + "הצג עוד" when no search/filter is active (search shows all), 3 changelog days + "הצג עוד", `#feature-id` links reveal the card                                                            |
| `/jobs/step-up`           | 17,584 px · 6.4k nodes         | 9,714 · 3.3k  | Hard cap of 40 with no way to see the rest                                             | `?show=` "טען עוד", 20 per batch (more reachable than before, lighter first load)                                                                                                                                 |
| `/settings/notifications` | 16,732 px · 4.2k nodes         | 6,504 · 1.3k  | 60 saved searches + 80 follows                                                         | Count in each heading, 8 + "הצג עוד"                                                                                                                                                                              |
| `/notifications`          | 15,188 px (100 of 400 read)    | 4,981 · 0.6k  | Read 100 rows every visit and the rest were unreachable; unread counted only those 100 | Server paging `?show=`, 30 per batch, unread from a `count()`                                                                                                                                                     |
| `/salary`                 | 7,307 px                       | 3,056         | 50 data points (the query cap) + a 3-column table                                      | 8 + "הצג עוד"; the asked-salary table became a card list (no sideways scroll), note clamped to 2 lines with `title`                                                                                               |
| `/salary/offers`          | **715 px horizontal overflow** | 0             | Grid track sized by the longest of 400 option labels                                   | `grid-cols-[minmax(0,1fr)]`, `min-w-0`, `w-full truncate` on the select, `LazySelect`                                                                                                                             |

Desktop (1440) moved the same way, e.g. `/dashboard` 69,309 → 3,875 px, `/outreach` 89,236 → 8,791 px,
`/companies/stress-co-1` 76,385 → 9,758 px. Server render time dropped with the DOM (e.g. `/dashboard`
1.2–1.5 s → 0.5 s locally). Pages that were already fine (`/jobs` pages by 24, `/companies` by 48,
`/stats`, `/cv`, `/profile`) were not touched.

## The building blocks

| Piece                                      | Use when                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/lib/ui/paging` + `LoadMoreLink`         | A **server** list that can be large. `?show=N` in the URL (shareable, survives reload and back, works without JS), only the first N rows are read/rendered.                                                                  |
| `ShowMoreList`                             | A **client-side** list whose data is already loaded and small enough (≤ a few hundred rows). Initial N, then "הצג עוד N", live "מוצגים X מתוך Y", focus moves to the first new item, `#hash` deep links reveal hidden items. |
| `@/lib/ui/show-more` (`visibleWithPinned`) | Caps that must never hide the item the user came for (deep links, open dialogs).                                                                                                                                             |
| `LazySelect`                               | A native select with hundreds of options repeated per row. Keeps type-ahead, screen readers and mobile pickers.                                                                                                              |
| `densityStrings(locale)`                   | Hebrew/English strings for all of the above (`src/lib/i18n/density.ts`).                                                                                                                                                     |

### Why "show more" and not page numbers

Users scan these lists top to bottom and act on the first items (due follow-ups, newest
notifications). "טען עוד" keeps their place, needs no page math and the URL still records the
state. Page numbers are better for random access, which none of these lists need.

### Why no virtualization

After capping, the largest list renders 20–30 rows (≈1–6k DOM nodes per page). Virtualization
would add a dependency, break Ctrl+F, `#hash` anchors, print and screen-reader browsing, and
complicate RTL and variable-height cards. Revisit only if a single list must show 500+ rows at once.

### Searchable selects

No combobox library was added. The long selects are native (type-ahead works by first letters,
including Hebrew) and lazy. Lists with a real search need (Kanban, outreach tracker) got a filter box.

## Rules for new lists

1. Anything that grows with user data gets a cap: server list → `?show=` + `LoadMoreLink`;
   client list → `ShowMoreList`. Pick the first batch so the first screen stays useful (5–30).
2. Show the total ("מוצגים X מתוך Y" or a count in the heading) so nothing looks missing.
3. Deep links (`#id`, `?contact=`) must still land on their item: pass `anchorIds`/`revealIndex`
   or pin it with `visibleWithPinned`.
4. Bulk actions apply only to what is visible (select-all = visible rows).
5. Grids/flex children holding long text: `min-w-0` and `grid-cols-[minmax(0,1fr)]` so one long
   label can't widen the page. Tables with more than 3 columns become cards under `sm`.
6. Keep RTL: logical properties (`ms-`, `pe-`, `text-start`), `<bdi>` for names, `dir="ltr"` for
   numbers.

## Tests

- `tests/ui-density.test.ts` — paging and show-more logic (`parseShow`, `pageItems`, `showHref`,
  `visibleWithPinned`, `countToInclude`, `matchesQuery`).
- `e2e/signed-in.e2e.mjs` → "data density" — creates 45 applications, 30 contacts and 45
  notifications, then at 390px checks: Kanban column starts at 20 and "הצג עוד" adds more, the
  filter finds a hidden card, tracker caps at 20, notifications page 30 → `?show=60`, bounded
  height, no horizontal overflow and DOM < 5000 nodes on `/referrals`, `/salary`, `/salary/offers`,
  `/settings/notifications`, `/features`. Fixtures are removed afterwards.

## Re-running the audit locally

```bash
createdb jobhunt_stress   # local Postgres only
DATABASE_URL=postgresql://…@localhost:5432/jobhunt_stress npx prisma migrate deploy
DATABASE_URL=… npx tsx scripts/seed-stress.ts          # --clean removes the stress rows
npm run build && DATABASE_URL=… npx next start -p 3100
```
