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

## Long lists

Pages that list user data (the Kanban, outreach tracker, referrals, notifications, company roles,
and this page's categories) are capped with "הצג עוד" / "טען עוד". The patterns, measurements and
rules for new lists are in [ui-data-density.md](ui-data-density.md); the user-facing entry is
`data-density` in the registry.

## Categories

`jobs` חיפוש משרות · `companies` חברות · `applications` מועמדויות · `profile` מסמכים ופרופיל ·
`email` מייל · `ai` AI · `learning` למידה · `notifications` התראות · `settings` הגדרות וחשבון ·
`ui` ממשק ונגישות · `admin` ניהול. Labels live in `src/features/types.ts`.

The main navigation is five hubs (jobs, companies, tracker, documents, prep) plus a sectioned More
menu. See [navigation.md](navigation.md). The user-facing entry is `nav-hubs`.

## Gates: the mandatory CV standard (#94)

Some features are blocked until the user's CV meets the standard in
[`src/lib/cv-standard`](../src/lib/cv-standard) (research: [`docs/cv-best-practices.md`](cv-best-practices.md)).
`requireCvStandard(userId)` must pass before: CV export (PDF/DOCX), generating a tailored CV, printing a
tailored CV, moving an application to APPLIED in the tracker, and finishing onboarding. A failing check
redirects to `/cv/standard?from=<export|tailor|print|applied|onboarding>`. New features that send a CV
outward must call the same gate. Blocking rules and warnings are listed in `RULE_IDS` / `evaluateStandard`
in `src/lib/cv-standard/rules.ts`; the one-page check renders the real PDF (`fit.ts`).
If that render fails (e.g. a font missing in the Vercel bundle), the check degrades: `fitError` is set,
the meter shows an error state, the verdict is not cached and the gate falls back to the content rules.
Anything the PDF renderer loads dynamically must be listed in `outputFileTracingIncludes["/**"]` in
`next.config.ts` (it runs from pages, actions and the layout banner, not only `/api/cv/export`).
