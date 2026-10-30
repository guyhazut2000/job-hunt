# Feature registry and `/features` ("מה המערכת יודעת לעשות")

`/features` lists everything the app can do, grouped by category, with search and filters, a link to
each page, badges (**חדש** for the last 14 days, **בטא**, **בתכנון**) and a **מה חדש** changelog.
It is linked from the header "More" menu, the mobile "More" sheet and the footer.

The page is rendered from one file: [`src/features/registry.ts`](../src/features/registry.ts).
Nothing on the page is hand-written elsewhere, so the registry is the only thing to keep up to date.

## Rule: every feature change updates the registry

In the same PR as the change:

| Change                                | What to do in `src/features/registry.ts`                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| New user-facing feature               | Add an entry (Hebrew `name`, `description`, `howTo`, `category`, `routes`, `added`, `prs`). |
| New page (`src/app/**/page.tsx`)      | Add its route pattern (e.g. `/jobs/[id]`) to an entry's `routes`. CI fails otherwise.       |
| Notable change to an existing feature | Append to its `updates: [{ date, text, pr }]` — it shows up under "מה חדש".                 |
| A planned feature ships               | Change `status` from `planned` to `live`/`beta`, set `routes`, `href`, `added`, `prs`.      |
| Feature removed / page deleted        | Remove the entry or route. CI fails on routes that no longer exist.                         |
| New idea approved but not built       | Add a `status: "planned"` entry (`routes: []`) with the issue number if there is one.       |

Dates are `YYYY-MM-DD` in Israel time. Text is Hebrew, short, and says what the user gets and how
to use it. Use the PR number you are opening (you can fill it after `gh pr create`).

## The guard (CI)

[`tests/features-registry.test.ts`](../tests/features-registry.test.ts) runs in `npm test` (CI):

- **Coverage** — every `src/app/**/page.tsx` route (except `src/app/api`) must appear in some entry's
  `routes`, or in `ROUTE_ALLOWLIST` in [`src/features/index.ts`](../src/features/index.ts). The
  allowlist is only for pages that aren't a capability (today: `/privacy`, `/terms`) and each one
  needs a reason. Do not use it to silence the test for a real feature.
- **No stale routes** — every route in the registry and the allowlist must still exist as a page.
- **Links work** — every `href` must resolve to a real page route.
- **Complete entries** — unique kebab-case ids, Hebrew text, valid category and dates, a `howTo`
  for live features, and planned features have no live routes.

Features that live inside other pages (e.g. a panel on `/jobs/[id]`) can't be detected
automatically. The PR template checklist covers them: tick "updated `src/features/registry.ts`"
or explain why the PR has no user-facing change.

## Categories

`jobs` חיפוש משרות · `companies` חברות · `applications` מועמדויות · `profile` מסמכים ופרופיל ·
`email` מייל · `ai` AI · `learning` למידה · `notifications` התראות · `settings` הגדרות וחשבון ·
`ui` ממשק ונגישות · `admin` ניהול. Labels live in `src/features/types.ts`.
