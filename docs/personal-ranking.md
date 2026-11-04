# Personal ranking — keywords + "Personal fit" sort (#84)

Route: `/jobs/ranking` (settings, signed-in) · sort `?sort=personal` on `/jobs`.

## What the user sets

- **Words I want** — up to 15 keywords, each with importance 1–3 and an optional **must** flag
  (a job without a must-have word is hidden from the personal sort).
- **Words I'm not interested in** — up to 15. A job is hidden when the word is in its **title, tech
  tags, company name or department**. A mention in the description does _not_ hide it (too noisy).
- **Weights** (0–3) for the four parts below; 0 = ignore that part.
- **Default sort** opt-in: "התאמה אישית" becomes the default on `/jobs` (an active text search still
  defaults to relevance; any explicit `sort=` wins).
- Every free-text box has the voice mic. Stored in `RankingPrefs` (additive migration
  `20261103140000_ranking_prefs`), validated by zod (`src/lib/ranking/personal.ts`).

## Score (0–100, pure: `personalScore`)

One engine for the personal sort on /jobs, the high-match alert (#102) and the "why" breakdown.
Weighted average (importance 1–3) of the criteria that are **on and have data**. A criterion with no
data for a job (or no preference) is `null` and is skipped — it never lowers the score, and the
breakdown shows "אין נתון". Everything is on by default; preferences come from the profile unless
set on /jobs/ranking (stored in `RankingPrefs.criteria`, additive migration `20261104090000_ranking_criteria`).

| Criterion (default importance) | 0–100                                                                                  | No data when                                       |
| ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| match — role fit (2)           | `scoreMatch` role part + any split-out part whose criterion is off (`matchCore`)       | no scorable profile                                |
| keywords (2)                   | weighted share of wanted words that hit (title ×1, tech/company ×0.85, text ×0.5)      | no words                                           |
| salary (2)                     | posted top of range, or the #98 estimate p75 (not low-confidence), vs the floor        | no floor (ranking page or profile), or no pay data |
| seniority (2)                  | exact 100 · one step 50 · further 0                                                    | no target seniority / years                        |
| tech (3)                       | profile skill strength over the stack, +10 per wanted, −30 per avoided tech            | job has no stack / no profile                      |
| domain (1)                     | company industry (free text → fintech, cyber, health…) in the chosen ones 100, else 20 | no chosen industries, or company industry unknown  |
| location (2)                   | remote or a profile region 100, else 0                                                 | no regions, or the job's region is unknown         |
| workMode (2)                   | wanted 100 · hybrid 50 · else 0                                                        | no work modes in profile                           |
| employment (1)                 | in the chosen types 100, else 0 (default: everything but internships)                  | —                                                  |
| companySize (1)                | tier (curated / size) as startup·mid·enterprise: match 100, adjacent 50, else 0        | no preference, or tier unknown                     |
| recency (1)                    | ≤3d 100 · ≤7d 80 · ≤14d 55 · ≤30d 30 · older 10                                        | —                                                  |
| referral (1)                   | an insider contact at the company (#100) 100                                           | no insider                                         |
| response (1)                   | the company answered one of your applications 100                                      | no known reply                                     |

No double counting: tech, seniority, location and work model used to live inside the profile match
score; when those criteria are on, `matchCore` removes their part from "match". Freshness and skill
gaps are no longer folded into "response". Switched-off criteria also skip their DB queries.

Every card under the personal sort shows **"ציון אישי N · למה N?"** with the reasons and their points
(`PersonalWhy`). The UI states plainly that this is a rule-of-thumb estimate, not a prediction.

## Bilingual

Keywords go through `parseSearchQuery` with the company lexicon — the same equivalences as the
search box (#67): ריאקט = React, אינטל = Intel, keyboard-layout typos. Description hits come from one
indexed DB text query per keyword (`searchWhere`), so jobs are scored without loading descriptions.

## Code

- `src/lib/ranking/personal.ts` — schema, normalize, hits, score (pure, tested in `tests/personal-ranking.test.ts`)
- `src/lib/ranking/criteria.ts` — seeker criterion evaluators (pure, `tests/match-criteria.test.ts`)
- `src/lib/ranking/server.ts` — load prefs, responded companies, insiders, `rankPersonal` (`tests/match-criteria-server.test.ts`)
- `src/app/jobs/ranking/*` — settings page + `saveRankingPrefs` action
- `src/components/ranking/*` — `RankingForm`, `PersonalWhy`
- `src/lib/jobs/filters.ts` — `personal` sort key, `SortContext` in `effectiveSort` / `needsScoring`
