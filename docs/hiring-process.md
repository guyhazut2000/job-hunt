# Hiring process (תהליך הגיוס)

Issue #32. Company and job pages have a **Hiring process** section with the company's interview stages. Every
stage comes from the company's own public pages and links to them. When no such page is found, the section says
so: **"לא נמצא מידע על תהליך הגיוס בחברה זו"** ("No information found about this company's hiring process") and
lists the sources that were checked.

## What is shown

- **Official process**: a numbered timeline of stages. Each stage shows its kind (phone screen, technical,
  home assignment, …), its title, a short summary (HE or EN), a duration if the source gives one, a link to its
  source, and the exact quote from the source (expand **Quote from the source**). The section also shows a
  confidence label (high / medium / low), the source list, and the date of the last check.
- **Job-level process**: if a job description describes its own process (e.g. "Our interview process: …"),
  the job page shows that process instead, with the job post as the source.
- **Official badge**: found processes carry an _Official_ (רשמי) badge — they come from the company's own pages
  or job postings.
- **No info**: the exact empty-state text, plus every page that was checked and what came of it (no process
  info / blocked by robots.txt / site blocks automated access / content only loads in a browser / unreachable).
  If nothing was checked yet, it says so.
- **From community reports** (מדיווחי קהילה): both the found and the no-info states show search links to
  Glassdoor, Blind, Reddit, Indeed and Geektime (Hebrew) for the company, with the badge _External · not
  verified_. These are outbound links only — see [Community reports](#community-reports).
- **Prep links**: technical, coding, assessment, home assignment and onsite stages link to the first `/learn`
  skill page for the job's (or company's) tech stack. System design links to `/learn/networking`. HR, offer and
  similar stages have no prep link.
- **From my experience**: a signed-in user can add their own process for a company or job (up to 12 stages:
  kind, title, note, and an optional total duration). It can start from a copy of the official stages, and it
  carries the badge _from my experience_. Only the author sees it. It never overwrites or mixes with the
  official process.
- **Current stage**: on a job you've saved or applied to, you can pick the stage you're at
  (`Application.currentStage`). That stage is marked _I'm here_ in the timeline.

The section is one server component (`src/components/hiring/HiringProcessSection.tsx`) and only depends on its
props, so the job page layout can change around it. It works in RTL and LTR, and at 375px wide with no
horizontal overflow.

## Data model

`HiringProcess` (one row per company, per job, or per user):

| field                                     | meaning                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `companyId`, `jobId?`, `userId?`          | scope: company-level, job-level (`jobId`), or a user's own (`userId`, `kind = "user"`)                                 |
| `kind`                                    | `official` or `user`                                                                                                   |
| `status`                                  | `found` or `none`                                                                                                      |
| `confidence`                              | `high` (≥3 grounded stages and a dedicated hiring page), `medium`, `low` (heuristic is always low)                     |
| `estimatedDuration`, `notesHe`, `notesEn` | only if the source states them (duration must appear verbatim)                                                         |
| `sources`                                 | `[{url, title}]`: pages that back at least one stage                                                                   |
| `checked`                                 | `[{url, title, result}]`: every page checked, `result` ∈ `stages / no_info / blocked / bot_wall / js_rendered / error` |
| `method`                                  | `gemini-…` or `heuristic`                                                                                              |
| `failureReason`                           | why `status = none` (see [Failure reasons](#failure-reasons))                                                          |
| `pipelineVersion`                         | pipeline that produced the row (current: 2); older rows are re-checked                                                 |
| `diagnostics`                             | discovery/extraction counters: fetches, bot walls, 404s, sitemap URLs, job sources, proposed stages                    |
| `checkedAt`, `updatedAt`                  | when it was extracted / changed                                                                                        |

`HiringStage`: `order`, `kind`, `title`, `detailHe`, `detailEn`, `duration`, `evidence` (verbatim quote),
`sourceUrl`.

The migration `20261028180000_hiring_process` is additive only: two new tables, plus two nullable columns on
`Application`. `20261028200000_hiring_process_v2` is additive too: `failureReason`, `pipelineVersion`
(default 1) and `diagnostics` on `HiringProcess`.

## Extraction pipeline (`src/lib/hiring/`)

1. **Discover** (`discover.ts`, v2): a tiered queue per company, only on the company's own sites (website,
   careers URL and seed hosts):
   - tier 0: curated seed URLs (`seeds.ts`, official pages only);
   - tier 1: links that look like a process page — anchors _and_ URLs found anywhere in the raw HTML (JSON,
     `data-*` attributes, `__NEXT_DATA__`), plus matching URLs from **sitemap.xml** (robots `Sitemap:` lines,
     else `/sitemap.xml`; sitemap indexes are followed for the 2 most relevant children). Patterns include
     how-we-hire, hiring/interview/recruitment process, candidate FAQ, what to expect, journey, and Hebrew
     (`תהליך גיוס`, `תהליך מיון`, …);
   - tier 2: the careers URL, `/careers` and the homepage (careers links are followed from the homepage);
   - tier 3: a few guessed paths (`/careers/how-we-hire`, `/hiring-process`, `/careers/faq`, `/תהליך-גיוס`,
     `/תהליך-מיון`, …). If a guessed path returns the same page as another URL, or redirects to `/`, the site
     is a soft-404 catch-all and guessing stops.
     At most 12 page requests + 3 sitemap requests and 4 candidate pages per company. A page is a candidate when
     it has a process phrase and either stage-like lines or a dedicated URL/title.
2. **Fetch** (`fetch.ts`): uses the job-hunt bot user agent, follows robots.txt, waits between requests to the
   same host, times out after 12s, reads at most 1.5 MB, and retries once on network errors only. 401 / 403 /
   429 / 503 and Cloudflare-/Incapsula-/PerimeterX-style challenge pages are recorded as `bot_wall` and **never
   bypassed**. Pages with almost no text are JS-rendered; text embedded in `__NEXT_DATA__` / JSON-LD is used
   when present, otherwise the page is recorded as `js_rendered`. It never fetches LinkedIn, Glassdoor, Indeed,
   Comparably, Blind, Reddit, Quora, social networks, Medium or search engines, or login / apply pages.
   **Unresponsive hosts:** some sites silently drop non-browser clients — every request hangs until the timeout
   (e.g. `www.hpe.com`: HTTP/2 stream resets / HTTP/1.1 hangs, so the 12 URLs used to take ~4 minutes and pushed
   the batch past its time box every run). After 2 consecutive network failures on a host (robots.txt counts)
   the remaining requests to that host are skipped and a host that already failed once gets no retry; each
   company also has a 60 s discovery budget. The company is then recorded as `unreachable` instead of being
   deferred forever. This is treated like a bot wall: no browser user agent, proxies or other workarounds.
3. **Job descriptions**: up to 3 of the company's active job descriptions that contain a real process section
   (≥2 stage-like lines, not just accommodation / "AI in recruitment" boilerplate, de-duplicated) are added as
   extra sources to the **same** Gemini call.
4. **Extract** (`extract.ts`): only the passages around "hiring / interview process"-style phrases are sent to
   Gemini (via `guardedLLM("hiring_process")`, the same cache and quotas as other AI features), one call per
   company. Gemini must return each stage with an `evidence` quote in the source's language and its
   `sourceUrl`.
5. **Ground** (fuzzy): a stage is kept only if its quote is found in that page's text by, in order: exact
   normalized match; token sequence (ignoring punctuation, bullets, niqqud and bidi marks); ellipsis pieces in
   order; or a sliding window with ≥85% token overlap and the same first and last word. The stored evidence is
   the page's own span. Invented stages are dropped.
6. **Threshold and confidence**: ≥2 grounded stages, **or 1 grounded stage from a page dedicated to the
   hiring process** (published at `low` confidence). `high` = ≥3 stages and a dedicated page; job-description
   only = at most `medium`; the offline heuristic is always `low`.
7. **Persist** (`run.ts`): a company's official row is replaced inside a transaction with `failureReason`,
   `pipelineVersion = 2` and `diagnostics`. If the LLM call fails or hits a quota, nothing is stored
   (`llm_failed`), so the company is retried later and never downgraded to "no info".
8. **Job-level processes**: job descriptions with their own process (at least 2 stage-like lines) become
   job-level processes, with the job's apply URL as the source.

### Failure reasons

| reason              | meaning                                                       |
| ------------------- | ------------------------------------------------------------- |
| `no_website`        | no website / careers URL to check                             |
| `robots`            | robots.txt disallows the pages                                |
| `bot_wall`          | the site blocks automated access (403 / 429 / challenge page) |
| `js_rendered`       | pages render only in a browser and embed no readable text     |
| `unreachable`       | network errors / 404s only                                    |
| `no_process_text`   | pages were read but none describes a process                  |
| `llm_none`          | Gemini read candidate pages and found no process              |
| `grounding_dropped` | Gemini proposed stages but none of the quotes are on the page |
| `below_threshold`   | one grounded stage from a non-dedicated page                  |

### Running it

- **Cron**: `GET /api/cron/hiring-process` (Bearer `CRON_SECRET`), twice a day at 06:10 and 06:50 UTC
  (`vercel.json`). Query parameters: `limit` (companies, default 20, max 60), `jobs` (job descriptions, default
  6, max 30), `llm` (max Gemini calls, default 20, max 28), `slugs` (comma-separated, to target companies).
  Candidates are companies with active jobs and no official process checked in the last 30 days **by the
  current pipeline version**: seeded companies first, then never-checked, then older "none" rows. A fresh
  "found" row from an older pipeline is kept as is (no LLM call). Discovery runs 4 companies in parallel; LLM
  calls stay serialized.
- **Free-tier budget**: Gemini calls are spaced 8.5s apart and capped per run. The global AI guard (8 per
  minute, 400 per day) also applies. When the budget runs out, the remaining companies are skipped rather than
  guessed.
- **Adding a company**: add its official hiring-process page to `seeds.ts`, then call the cron with
  `?slugs=<slug>`.

## Rules

- Sources are only company-owned or official pages: careers pages, official blogs, the job post itself, and
  public ATS pages. No LinkedIn, no Glassdoor, nothing behind a login. robots.txt is always respected, and bot
  walls are never bypassed.
- Stages are never invented. Every stage links to the page and quote it came from. Notes are short summaries of
  the source, and the UI adds a disclaimer that the process may vary by role and team.
- Users' own processes are private to them.

## Community reports

Guy asked to also learn from reports like Glassdoor. Decision (v2): **outbound links only — nothing from
community sites is fetched, stored or turned into stages.**

| source                       | how it is used | why                                                                                                                                                 |
| ---------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glassdoor                    | link only      | ToS forbids scraping / automated access; pages are behind a bot wall and login                                                                      |
| Blind                        | link only      | ToS forbids automated access; bot wall                                                                                                              |
| Indeed                       | link only      | ToS forbids scraping                                                                                                                                |
| Reddit                       | link only      | API requires OAuth and has commercial-use terms; we don't use unofficial endpoints                                                                  |
| Geektime (HE)                | link only      | robots.txt disallows `/search/`                                                                                                                     |
| Hacker News API              | not used       | public and allowed, but tested on our companies: few relevant comments, false positives, nothing for Israeli companies — too noisy to ground stages |
| LinkedIn, Comparably, Google | never          | not fetched and not linked (Google search links are not used either)                                                                                |

The links (`src/lib/hiring/community.ts`) are built from the company name with no network call and open the
site's own search in the user's browser. The UI labels them _From community reports · External, not
verified_. Because nothing is fetched, there are no "community report" stages; if a source with clear terms
that allow automated access appears later, its stages must be quote-grounded the same way, stored with a
community label and capped at `low` confidence.

## Tests

`tests/hiring-process.test.ts` runs with no network (any `fetch` fails the test). It covers stage kinds and
labels, prep links, blocking of LinkedIn / Glassdoor / Google / login URLs, robots.txt, HTML to text,
process passages, the heuristic, grounding (invented quotes are dropped), fuzzy grounding (punctuation, Hebrew,
ellipsis), the 1-stage rule, failure reasons, job-description confidence caps, LLM `none` / `llm_failed`,
discovery staying on the company's own site, sitemap parsing, links in JSON, embedded `__NEXT_DATA__` text, bot
walls (no retry), soft-404 handling, community links (no network, no Google/LinkedIn), the LLM pacer, and the
exact empty-state text.
