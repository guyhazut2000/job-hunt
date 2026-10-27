# Job sources

All jobs come from **public, documented (or publicly served, unauthenticated) job-board endpoints**
that employers use to publish openings on their own careers sites. No login, no scraping of HTML
pages, no LinkedIn. The curated list lives in `src/lib/ingestion/sources.ts`; each provider has an
adapter in `src/lib/ingestion/adapters/` that normalizes postings into the same `NormalizedJob`.

| Provider        | Endpoint                                                                             | boardId            | Notes                                                 |
| --------------- | ------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------- |
| Greenhouse      | `boards-api.greenhouse.io/v1/boards/<token>/jobs?content=true&pay_transparency=true` | board token        | `pay_input_ranges` → stated pay (annual, cents)       |
| Lever           | `api[.eu].lever.co/v0/postings/<site>?mode=json`                                     | site, `eu:` prefix | `salaryRange` → stated pay                            |
| Comeet          | `www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token>&details=true`   | `uid:token`        | see token policy below                                |
| Ashby           | `api.ashbyhq.com/posting-api/job-board/<org>?includeCompensation=true`               | job-board name     | salary tiers → stated pay                             |
| Workable        | `apply.workable.com/api/v1/widget/accounts/<account>?details=true`                   | account            | public careers widget API                             |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/<id>/postings?country=il` + `/postings/<id>`   | company identifier | detail fetched only for new postings                  |
| Recruitee       | `<company>.recruitee.com/api/offers/`                                                | subdomain          | `salary` → stated pay                                 |
| Workday         | `<tenant>.<wdN>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs` (POST)              | `tenant/wdN/site`  | Israel facet, paginated; detail only for new postings |

## Being a good citizen

`src/lib/ingestion/http.ts` identifies the bot in its User-Agent, paces requests per host
(250 ms default; Ashby 500 ms, SmartRecruiters 400 ms, Workday 600 ms, Workable/Recruitee 1 s),
times out (20 s, Workday 25 s) and retries only 429 / 5xx / network errors with backoff, honouring
`Retry-After`. Error messages contain only the board label and HTTP status, never the URL.

The daily cron is split into provider groups (`vercel.json`: Greenhouse/Lever/Ashby, then
Comeet/Workable/SmartRecruiters/Recruitee, then Workday twice) so each run fits the function limit;
each run has a 230 s budget, works stalest-company-first, and defers whatever does not fit to the
next run. Boards of one provider run one at a time, except Workday, where every tenant is its own
host and four tenants run side by side (each still paced per host). For Workday and SmartRecruiters the list call only refreshes known postings; the
description is fetched for at most 60 new postings per company per run.

## Workday: Israel facet

A Workday site has no country parameter. The adapter first asks for one posting to read the site's
facets, then filters with an exact `Israel` country/location-hierarchy value, or otherwise the union
of the site's Israeli location values (`isIsraelLocation`). Sites with no Israeli facet return
nothing. Only tenants whose own careers page links to their `myworkdayjobs.com` site are listed.

## Comeet token policy

Comeet's careers API needs a company UID and a careers-site token. We only use the **public,
read-only careers-site token that the company itself embeds in its own careers page** (or in the
Comeet-hosted careers page its site links to) — the same token every visitor's browser receives.
We never request, guess or reuse private/API tokens. If a company rotates its token the board
fails and shows up as failing on `/admin`; re-read it from that company's careers page.

## Israel filter

`isIsraelLocation` (`src/lib/ingestion/location.ts`) accepts "Israel"/"ISR", known Israeli cities
in English and Hebrew (with common spellings: Petach Tikva, Herzliya Pituach, Yokneam…), and
"Remote – Israel". A bare `IL` is not trusted (Chicago, IL), and Hebrew names are matched
carefully (יהוד ≠ יהודה). Postings for other countries are never ingested.

## Adding or verifying a source

1. Find the ATS from the company's **own** careers page (the iframe/script/links it uses).
2. Add a line to `sources.ts` with the matching helper.
3. `npm run sources:verify -- PROVIDER` checks every board responds and has Israeli openings.
4. The next cron run (or "Sync all" on `/admin`) creates the company and its jobs.
