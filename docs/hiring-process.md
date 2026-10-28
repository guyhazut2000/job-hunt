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
- **No info**: the exact empty-state text, plus every page that was checked and what came of it (no process
  info / blocked by robots.txt / unreachable). If nothing was checked yet, it says so.
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

| field                                     | meaning                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `companyId`, `jobId?`, `userId?`          | scope: company-level, job-level (`jobId`), or a user's own (`userId`, `kind = "user"`)             |
| `kind`                                    | `official` or `user`                                                                               |
| `status`                                  | `found` or `none`                                                                                  |
| `confidence`                              | `high` (≥3 grounded stages and a dedicated hiring page), `medium`, `low` (heuristic is always low) |
| `estimatedDuration`, `notesHe`, `notesEn` | only if the source states them (duration must appear verbatim)                                     |
| `sources`                                 | `[{url, title}]`: pages that back at least one stage                                               |
| `checked`                                 | `[{url, title, result}]`: every page checked, `result` ∈ `stages / no_info / blocked / error`      |
| `method`                                  | `gemini-…` or `heuristic`                                                                          |
| `checkedAt`, `updatedAt`                  | when it was extracted / changed                                                                    |

`HiringStage`: `order`, `kind`, `title`, `detailHe`, `detailEn`, `duration`, `evidence` (verbatim quote),
`sourceUrl`.

The migration `20261028170000_hiring_process` is additive only: two new tables, plus two nullable columns on
`Application`.

## Extraction pipeline (`src/lib/hiring/`)

1. **Discover** (`discover.ts`): for each company, try in order: curated seed URLs (`seeds.ts`), the careers
   URL, a few common paths on the company website (`/careers/how-we-hire`, `/hiring-process`, …),
   `careers.<domain>`, and same-site links whose text or URL looks like "how we hire" / "interview process" /
   "candidate experience". At most 8 requests and 3 pages per company. Only pages on the company's own site
   are fetched.
2. **Fetch** (`fetch.ts`): uses the job-hunt bot user agent, follows robots.txt, waits between requests to the
   same host, times out after 12s, and reads at most 1.5 MB. It never fetches LinkedIn, Glassdoor, Indeed,
   Comparably, Blind, social networks, Medium or search engines, or login / apply pages.
3. **Extract** (`extract.ts`): only the passages around "hiring / interview process"-style phrases are sent to
   Gemini (via `guardedLLM("hiring_process")`, the same cache and quotas as other AI features). Gemini must
   return each stage with a verbatim `evidence` quote and its `sourceUrl`.
4. **Ground**: a stage is kept only if its quote (normalized for case, quotes, dashes and whitespace) appears
   in that page's fetched text. Fewer than 2 grounded stages means `none`. Invented stages are dropped. With the
   mock provider (tests and local runs without a key), a verbatim-line heuristic is used, always at low
   confidence.
5. **Persist** (`run.ts`): a company's official row is replaced inside a transaction. If the LLM call fails or
   hits a quota, nothing is stored (`llm_failed`), so the company is retried later and never downgraded to
   "no info".
6. **Jobs**: active job descriptions that mention an interview / hiring process (`תהליך הגיוס`, `תהליך המיון`,
   …) and have at least 2 stage-like lines become job-level processes, with the job's apply URL as the source.

### Running it

- **Cron**: `GET /api/cron/hiring-process` (Bearer `CRON_SECRET`), daily at 06:10 UTC (`vercel.json`).
  Query parameters: `limit` (companies, default 12, max 40), `jobs` (job descriptions, default 8, max 30),
  `llm` (max Gemini calls, default 15, max 25), `slugs` (comma-separated, to target companies). Candidates are
  companies with active jobs and no official process checked in the last 30 days, with seeded companies first.
- **Free-tier budget**: Gemini calls are spaced 8.5s apart and capped per run. The global AI guard (8 per
  minute, 400 per day) also applies. When the budget runs out, the remaining companies are skipped rather than
  guessed.
- **Adding a company**: add its official hiring-process page to `seeds.ts`, then call the cron with
  `?slugs=<slug>`.

## Rules

- Sources are only company-owned or official pages: careers pages, official blogs, the job post itself, and
  public ATS pages. No LinkedIn, no Glassdoor, nothing behind a login. robots.txt is always respected.
- Stages are never invented. Every stage links to the page and quote it came from. Notes are short summaries of
  the source, and the UI adds a disclaimer that the process may vary by role and team.
- Users' own processes are private to them.

## Tests

`tests/hiring-process.test.ts` runs with no network (any `fetch` fails the test). It covers stage kinds and
labels, prep links, blocking of LinkedIn / Glassdoor / Google / login URLs, robots.txt, HTML to text,
process passages, the heuristic, grounding (invented quotes are dropped), LLM `none` / `llm_failed`,
discovery staying on the company's own site, and the exact empty-state text.
