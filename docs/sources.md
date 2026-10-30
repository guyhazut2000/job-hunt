# Job sources

All jobs come from **public, documented (or publicly served, unauthenticated) job-board endpoints**
that employers use to publish openings on their own careers sites. No login, no scraping of HTML
pages, no LinkedIn. The curated list lives in `src/lib/ingestion/sources.ts`; each provider has an
adapter in `src/lib/ingestion/adapters/` that normalizes postings into the same `NormalizedJob`.

| Provider           | Endpoint                                                                                | boardId            | Notes                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse         | `boards-api.greenhouse.io/v1/boards/<token>/jobs?content=true&pay_transparency=true`    | board token        | `pay_input_ranges` → stated pay (annual, cents)                                                                                         |
| Lever              | `api[.eu].lever.co/v0/postings/<site>?mode=json`                                        | site, `eu:` prefix | `salaryRange` → stated pay                                                                                                              |
| Comeet             | `www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token>&details=true`      | `uid:token`        | see token policy below                                                                                                                  |
| Ashby              | `api.ashbyhq.com/posting-api/job-board/<org>?includeCompensation=true`                  | job-board name     | salary tiers → stated pay                                                                                                               |
| Workable           | `apply.workable.com/api/v1/widget/accounts/<account>?details=true`                      | account            | public careers widget API                                                                                                               |
| SmartRecruiters    | `api.smartrecruiters.com/v1/companies/<id>/postings?country=il` + `/postings/<id>`      | company identifier | detail fetched only for new postings                                                                                                    |
| Recruitee          | `<company>.recruitee.com/api/offers/`                                                   | subdomain          | `salary` → stated pay                                                                                                                   |
| Workday            | `<tenant>.<wdN>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs` (POST)                 | `tenant/wdN/site`  | Israel facet, paginated; detail only for new postings                                                                                   |
| Eightfold          | `<host>/api/pcsx/search?domain=<domain>&location=Israel` + `/api/pcsx/position_details` | `host/domain`      | Amdocs, Qualcomm, Microsoft; detail only for new postings                                                                               |
| Oracle Recruiting  | `<host>/hcmRestApi/resources/latest/recruitingCEJobRequisitions` (Israel facet id)      | `host/siteNumber`  | Verint, Dell, Oracle; detail only for new postings                                                                                      |
| iCIMS (Jibe)       | `<host>/api/jobs?location=Israel&page=N&limit=100`                                      | host               | Booking.com; keeps `country_code` IL                                                                                                    |
| amazon.jobs        | `www.amazon.jobs/en/search.json?normalized_country_code[]=ISR`                          | ISO-3 country      | Amazon; 1 request/s                                                                                                                     |
| SuccessFactors CSB | `<host>/search/?q=&locationsearch=Israel&startrow=N` + job page microdata               | host               | Teradyne; public HTML on robots-allowed paths only (no `/services/` RSS, no apply pages), 1 request/1.5 s, details once per new posting |

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

## Bot-protected careers sites

Some large employers' HTML careers pages answer automated requests with a bot wall (403/captcha).
We never bypass that: no captcha solving, no IP rotation, no browser impersonation, no login, and
never LinkedIn/Glassdoor/Blind/Indeed. Instead we look for the **public job-search API the careers
site itself calls** in the visitor's browser, and use it only when:

- the tenant is linked from the company's own careers page (or the tenant name and posting content
  clearly match the company), and it has Israeli postings;
- robots.txt allows it (Eightfold allows `/api/pcsx`; Oracle Recruiting serves no robots.txt;
  amazon.jobs disallows only `/internal`; Jibe sites allow all);
- requests stay paced and carry the identifiable User-Agent.

Moved to automatic sync this way: Amdocs, Qualcomm, Microsoft (Eightfold), Verint, Dell, Oracle
(Oracle Recruiting), Booking.com (iCIMS/Jibe), Amazon (amazon.jobs), Cisco and Broadcom (Workday),
Teradyne (SuccessFactors Career Site Builder).
Oracle sites are filtered by the exact `Israel` location facet id (no facet → nothing ingested).
`findBoards` recognises Oracle candidate-experience links and `data-apibaseurl` + `siteNumber` pairs.

Still manual (no public API found, the API is behind the same bot wall, or there are 0 Israeli
postings): Check Point, Elbit Systems, Varonis, Tower Semiconductor, monday.com, Intuit, Synopsys,
SanDisk, Unity, Akamai, Dynatrace, Rapid7, Apple, Meta, Zoom (0 IL on Workday), Teva, Sapiens,
Lightricks, HiBob, Nova, Hippo, Snyk, Vayyar, AMD (0 IL), Arm, UVision, SAP (SuccessFactors) and the `BOT_PROTECTED` established employers.

## Manual check

Manual companies (`isManualCompany`: sync mode or provider `MANUAL`, or no board) are listed under
`/companies?sync=manual` with their careers link and a banner. Every Sunday (`/api/cron/manual-check`,
06:45 UTC; delivered by the next hourly delivery run) each active user gets one `DIGEST`
notification (bell, plus push/Telegram per their preferences and quiet hours) naming up to 8 manual
companies — the ones they applied to first — deduplicated per ISO week (`manual-check:<week>`).
The module lives in `src/lib/companies/manual-check.ts` and only calls `notify()`.

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

## WordPress careers sites

Some Israeli employers (e.g. ONE Technologies, `www.one1.co.il`) publish their openings as a custom post
type on their own WordPress site, readable through the public WordPress REST API that the site itself
exposes (`/wp-json/wp/v2/<postType>`). `boardId` is `"<host>"` or `"<host>/<postType>"` (default `job`).
The adapter reads at most 10 pages of 100, paced one request per second, and resolves the location /
category / scope taxonomies. These sites are Israeli-only, so every post counts as an Israeli job; the
city comes from the title or from a single region term, otherwise "Israel".

## Established employers and northern hubs

`src/lib/companies/established.ts` lists non-startup employers with in-house hi-tech roles —
integrators and IT services (ONE, Matrix, Integrity Software, Comm-IT…), banks, insurers, telecom,
defense, HMOs, large corporates — and tenants of MATAM (Haifa), Yokneam and the North. Each entry is
tagged with its `hub`. Entries whose careers page embeds a public ATS board are merged into
`JOB_SOURCES`; the rest into `MANUAL_COMPANIES`. Careers URLs come from the companies' own sites
and were checked to load. The few sites that answer automated requests with a bot wall or geo-block are
listed in `BOT_PROTECTED`; they were confirmed through search results. TASE and Wikipedia lists were only
used to pick names; there was no bulk import (TASE's site blocks automated access, and Wikidata is
already covered by the discovery `WIKIDATA` fetcher).

## Adding or verifying a source

1. Find the ATS from the company's **own** careers page (the iframe/script/links it uses).
2. Add a line to `sources.ts` with the matching helper.
3. `npm run sources:verify -- PROVIDER` checks every board responds and has Israeli openings.
4. The next cron run (or "Sync all" on `/admin`) creates the company and its jobs.
