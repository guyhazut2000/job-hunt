# LinkedIn links on jobs

Each job card and job page has a secondary LinkedIn link. The primary action is still **Apply on company site** (`applyUrl`).

| State                                               | Label (en / he)                                                                           | Link                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Exact posting found                                 | "View posting on LinkedIn" + "Exact posting" / "צפייה במשרה בלינקדאין" + "המודעה המדויקת" | `https://www.linkedin.com/jobs/view/<id>/`                                       |
| Not found, not checked yet, or Brave not configured | "Search on LinkedIn" + "may not be this exact posting" / "חיפוש המשרה בלינקדאין"          | `https://www.linkedin.com/jobs/search/?keywords=<title company>&location=Israel` |

## Company links

Next to the job link there is a company link. The company page also gets a "company jobs" link, and each company card in the list gets a small "in" icon. The icon is a sibling of the card link, not nested inside it.

| Where                             | State                       | Label (he / en)                                        | Link                                                                     |
| --------------------------------- | --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Job page, company page, list icon | Admin stored a company page | "דף החברה בלינקדאין" / "Company on LinkedIn"           | `https://www.linkedin.com/company/<slug>/` (or `/showcase/`, `/school/`) |
| Job page, company page, list icon | No stored page              | "חיפוש החברה בלינקדאין" / "Search company on LinkedIn" | `https://www.linkedin.com/search/results/companies/?keywords=<name>`     |
| Company page                      | Always                      | "משרות החברה בלינקדאין" / "Company jobs on LinkedIn"   | `https://www.linkedin.com/jobs/search/?keywords=<name>&location=Israel`  |

- `<name>` is `cleanCompanyName()`, so legal suffixes such as Ltd., Inc. and בע"מ are dropped. It is percent-encoded by `URLSearchParams`, which handles Hebrew, `&` and quotes.
- `Company.linkedinUrl` is optional. An admin sets it on `/admin` under "דף לינקדאין לחברה", pasting a full URL (any `xx.linkedin.com` host, with or without `/about/` or `?trk=`) or just the slug. Empty clears it.
- It is stored normalized by `normalizeLinkedinCompanyUrl()` (`src/lib/linkedin/company.ts`). Anything that isn't a linkedin.com `/company/`, `/showcase/` or `/school/` URL is rejected, and an invalid stored value falls back to the search link.
- We never fetch or verify the page. The admin is responsible for the URL being right.
- Clicks are tracked as `company_linkedin_click`, kind `company_page` | `company_search` | `company_jobs`, placement `page` | `header` | `list`, with `companyId` and also `jobId` on job pages.

## How the exact posting is found

- Brave Search (the people-search integration, same key and pacer): `site:linkedin.com/jobs/view "<title>" "<company>"`.
- Only the Brave result **title / description / url** are used. We never request linkedin.com and use no LinkedIn API.
- The URL must match `(www.|xx.)linkedin.com/jobs/view/<id>` or `/jobs/view/<slug>-<id>`. It is stored normalized as `https://www.linkedin.com/jobs/view/<id>/`.
- Score (0–100): job-title token coverage in the result title (up to 55), company named in the result title (35) or only in the description (15), Israeli location mentioned (10). At least 70 is needed (`EXACT_MIN_CONFIDENCE`), so the company effectively has to appear in the title.
- `f_C` (LinkedIn company id) is added only when we know the numeric id from a legitimate source. We don't store one today, so it isn't used.

## When lookups run

- **Lazily on job page view**, when `linkedinCheckedAt` is null or stale. The page streams the link in a Suspense slot, waits at most 4 s, and shows the current link (search) meanwhile. A claim on `linkedinCheckedAt` makes concurrent views trigger one call.
- **In the daily cron** (`/api/cron/ingest`), up to `LINKEDIN_JOB_INGEST_BATCH` (default 10) of the newest unchecked active jobs.
- Rechecks: misses after 7 days, found links after 30 days. A miss keeps a previously found link.

## Budget

- Every uncached lookup writes a `LinkedinJobLookup` row.
- People search and job links share `BRAVE_MONTHLY_CAP` (rolling 30 days, default 900). Job links also have their own slice, `LINKEDIN_JOB_MONTHLY_CAP` (default 300), so they can't starve people search.
- `PEOPLE_SEARCH_MOCK=1` uses synthetic fixtures (fake ids; about 1 in 4 jobs has no posting). It is ignored on `VERCEL_ENV=production`.

## Click tracking

`OutboundLink` sends `navigator.sendBeacon('/api/events', …)` for `job_apply_click` (kind `company`) and `job_linkedin_click` (kind `exact` | `search`, placement `card` | `page` | `bar`). The route whitelists the event, kind and job id, then calls `track()`.

## Caveats

- Only a URL is cached, not Brave result text. Brave's API terms limit storing results, so review them before scaling.
- LinkedIn postings expire. A stored link can go stale until the 30-day recheck.
- Brave's index coverage of LinkedIn job pages is partial, so many jobs will show the search fallback.
- The search deep link is a search, not an apply flow. LinkedIn decides what it shows, and a signed-out user may hit a login wall.

## Pulling jobs _from_ LinkedIn

We don't. There's no open LinkedIn API to read or search jobs. The Job Posting API and Apply Connect are for approved ATS/Talent partners, and LinkedIn's terms forbid scraping. We source jobs from company ATS boards (Greenhouse, Lever, Comeet) instead.
