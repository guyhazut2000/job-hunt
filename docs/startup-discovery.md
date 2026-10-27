# Startup discovery

Goal: find Israeli tech companies we don't track yet, legally, and turn each into either an
**AUTO** company (a public ATS feed we can sync) or a **MANUAL** company (listed with a link to its
careers page so it is never silently dropped). Code: `src/lib/discovery/`.

## Ground rules

- **No LinkedIn**, no search-engine scraping, no unofficial/private APIs. `BLOCKED_HOST`
  (`src/lib/discovery/domain.ts`) refuses linkedin.com, lnkd.in, google.\*, facebook.com, x.com and
  twitter.com — also after redirects — and those URLs are never stored as careers links.
- Only open data or official APIs are used as company lists.
- Company websites are read like a browser would read one public page: `robots.txt` is honoured
  (RFC 9309: longest match, `Allow` wins ties, `*`/`$` wildcards; our token is `job-hunt-bot`),
  requests identify the bot in the User-Agent, are paced (≥ 500 ms per host), time out after 10 s,
  read at most 1.5 MB, and look at no more than 6 pages per company.
- Jobs are then pulled only from the ATS's public job-board API (see `docs/sources.md`).

## Options considered

| Source                                | Access                                 | Cost / licence                                        | Verdict                                                                                              |
| ------------------------------------- | -------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **TechMap Israel** (`mluggy/techmap`) | Public GitHub repo (JSON per company)  | Free, **ODbL** — attribution + share-alike for the DB | ✅ **Used.** ~5k Israeli tech companies with size, category, website, careers page and often ATS ids |
| **Y Combinator** via `yc-oss/api`     | Static JSON on GitHub Pages            | Free, MIT (mirror of YC's public directory)           | ✅ **Used.** Israel-region YC companies, hiring flag                                                 |
| **Wikidata** SPARQL                   | Official public query service          | Free, CC0                                             | ✅ **Used.** Israeli companies with an official website; noisy, so never auto-listed as MANUAL       |
| **Crunchbase API v4**                 | Official API, key required             | Paid (Crunchbase API/Enterprise licence)              | ⚙️ Implemented, **off** unless `CRUNCHBASE_API_KEY` is set (untested without a key)                  |
| Start-Up Nation Finder (SNC)          | Website; data licence on request       | Paid licence; ToS forbid scraping                     | ❌ Not used                                                                                          |
| IVC Research Center                   | Subscription database                  | Paid                                                  | ❌ Not used                                                                                          |
| Wellfound (AngelList Talent)          | No public API                          | ToS forbid scraping                                   | ❌ Not used                                                                                          |
| LinkedIn company/job search           | —                                      | ToS forbid scraping                                   | ❌ Never                                                                                             |
| Product Hunt API                      | Token; commercial use needs permission | Free tier, permission needed                          | ❌ Few Israeli companies, not worth it                                                               |
| Geektime / news RSS                   | Public feeds                           | Free                                                  | ❌ Names only, very noisy (funding news ≠ hiring)                                                    |
| VC portfolio pages                    | Public pages, each different           | Free                                                  | ➖ Manual only: add via `/admin` → manual company form                                               |

TechMap is the backbone: it is an actively maintained, openly licensed map of Israeli tech
companies and already records many companies' Comeet/Greenhouse/Lever ids, which makes ATS
detection cheap and accurate. **Attribution:** the admin discovery section credits TechMap and links
to the repo; candidates keep `source`/`sourceUrl`. We don't redistribute the TechMap database itself.

## Pipeline

1. **Import** (weekly; `IMPORT_EVERY_MS`) — fetch every enabled source in parallel, merge by
   domain (best priority wins, hints/careers links are combined) and insert new
   `StartupCandidate` rows. Domains that already belong to a company become `DUPLICATE`.
   Priority favours larger companies, known ATS ids, a known careers page and current hiring.
2. **Check** (every run, highest priority first; re-checked after 30 days) — `detectAts`:
   source hints → careers page from the source → homepage → careers links on it → common paths
   (`/careers`, `/jobs`, …). It recognises Greenhouse, Lever (incl. EU), Ashby, Workable,
   SmartRecruiters, Recruitee, Workday and Comeet (uid + public token, also from the company's
   Comeet-hosted page), then **verifies** each board against the ATS API and counts Israeli jobs.
3. **Decide** (`decide` in `run.ts`):
   - verified board **and** (Israeli openings **or** source is TechMap/YC) → new **AUTO** company,
     ingested right away;
   - no board, source is TechMap/YC, and a careers page loaded that is on the company's own domain
     (or a hosted ATS page) and looks like a careers page → new **MANUAL** company with that link;
   - anything else (Wikidata-only, wrong-domain or non-careers page, robots-blocked, errors) →
     **review queue** in `/admin` (Approve → MANUAL, or Reject).
   - a board that already belongs to a company → `DUPLICATE`.

## Running it

- **Cron:** `/api/cron/discover` daily at 03:30 UTC (`vercel.json`); imports only when the last
  import is ≥ 7 days old. `?import=always|never` overrides. Protected by `CRON_SECRET`.
  Budget: ~200 s of checking (6 parallel lanes, per-host pacing), then up to 10 new AUTO companies
  are ingested; the rest are picked up by the regular provider crons (stalest first).
- **Admin:** `/admin` → _Startup discovery_ → **Run discovery now**; the same page shows the last
  run, counts and the review queue.

## Keys and costs

None required. Optional: `CRUNCHBASE_API_KEY` (paid Crunchbase API licence) adds Crunchbase
search results for Israeli companies as a fourth source.
