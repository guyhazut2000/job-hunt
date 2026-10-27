# People search (Brave Search API)

The "people at the company" section on job and company pages can show real
person cards (recruiters, team leads, engineers, managers, senior management,
founders) found through the [Brave Search API](https://brave.com/search/api/).

## Hard rule: no LinkedIn fetching

- We **never** request linkedin.com pages and never use unofficial LinkedIn APIs.
- The only network call is `GET https://api.search.brave.com/res/v1/web/search`
  with the `X-Subscription-Token` header.
- Cards come only from the `title`, `description` and `url` fields Brave returns.
  The URL is normalized to `https://www.linkedin.com/in/<slug>`; anything else
  (`/jobs/`, `/company/`, `/pub/`, other domains) is dropped.
- "Open LinkedIn" is a plain link the user clicks themselves (new tab).

## Setup

1. Create an account at <https://api-dashboard.search.brave.com> and verify the email.
2. **Plans** → choose **Search**. A credit card is required to activate a plan.
   Brave applies $5 of free credit monthly (about 1,000 requests at $5 / 1,000).
   Set the prepaid amount to $0 and a monthly usage limit so nothing beyond the
   free credit is charged.
3. **API Keys** → **Add API Key**.
4. Add `BRAVE_SEARCH_API_KEY` to the Vercel project (Production + Preview) and to
   `.env.local` locally. Redeploy.

Without the key the section works as before (deep-link buttons) plus a small note.

## Environment variables

| Variable                        | Default | Meaning                                                                                            |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `BRAVE_SEARCH_API_KEY`          | –       | Enables the feature                                                                                |
| `PEOPLE_SEARCH_CACHE_TTL_HOURS` | `168`   | Cache lifetime (see ToS caveat)                                                                    |
| `PEOPLE_SEARCH_PER_MINUTE`      | `20`    | Per-user requests per minute (cached + uncached)                                                   |
| `PEOPLE_SEARCH_DAILY_CAP`       | `40`    | Per-user uncached Brave calls per rolling 24 h                                                     |
| `BRAVE_MONTHLY_CAP`             | `900`   | Global uncached Brave calls per rolling 30 days (stays within the free credit)                     |
| `BRAVE_MIN_INTERVAL_MS`         | `1100`  | Minimum gap between Brave requests per server instance                                             |
| `PEOPLE_SEARCH_MOCK`            | –       | `1` = synthetic fake results, for local dev/screenshots only; ignored when `VERCEL_ENV=production` |

## How it works

- `GET /api/people/search?companyId&group&jobId&page` needs a logged-in user. The query is
  built on the server from the company name, group terms (English and Hebrew), job role
  keywords and "Israel"; clients can't send free-text queries.
- The cache table `PeopleSearchCache` is keyed by (company, group, query hash + page).
- `PeopleSearchUsage` records each request so the rate limit and caps can be checked.
  Rows older than 31 days are deleted as requests come in.
- Brave client: an 8 s timeout and up to 3 attempts. On 429 it waits for
  `X-RateLimit-Reset` (or exponential backoff, capped at 8 s) and retries. 5xx and network
  errors back off and retry. A 402 or exhausted monthly quota shows the fallback buttons.
- Matching (`src/lib/people/match.ts`) gives each result a 0–100 confidence score from
  where the company appears (experience field, title, headline or description), group
  terms, an Israel location, and a penalty for former employees ("ex-", "former", "לשעבר").
  Results scoring ≥ 50 are shown. Results scoring 30–49 sit behind a "show uncertain
  matches" toggle with an "uncertain" label. Anything lower is dropped.
- The section fetches only after it scrolls into view, which saves quota.

## Privacy

- We store only name, headline, location and the profile URL taken from search results,
  in the cache, until it expires.
- Users can **hide** a card (only for themselves) or **report / request removal**. A
  report hides that profile for every user (`PeopleSearchSuppression`).
- A Hebrew note under the section explains where the data comes from and how to remove it.
- Contacts a user saves are that user's own data, stored in the existing `Contact` table.

## Brave terms: caveats

- Brave's standard API terms forbid storing or caching search results "other than
  transient storage required for operation". Storing results appears to need a plan
  with storage rights. The 7-day default cache follows the product spec. To stay within
  the standard terms, lower `PEOPLE_SEARCH_CACHE_TTL_HOURS` (e.g. `1`) or get storage
  rights from Brave.
- Attribution: the section shows "POWERED BY BRAVE". Brave's guidelines also ask for the
  Brave logo, and its blog says the free credit expects attribution on the site/about
  page.
- Brave currently lists 50 requests/second for the Search plan. We pace at about 1 per
  second anyway.
- Search results can be stale or wrong (people change jobs). The UI asks users to check
  the profile.

## Migration

`prisma/migrations/20261027200000_people_search` is additive only: 2 enums and 3 tables,
with no changes to existing tables. Apply it with `prisma migrate deploy` after merging.
