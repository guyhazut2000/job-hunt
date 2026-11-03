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

Weighted average of the parts that apply:

| Part                          | 0–100                                                                         | Notes                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| match                         | existing `scoreMatch`                                                         | dropped when there's no scorable profile                                            |
| keywords                      | weighted share of wanted words that hit                                       | title ×1, tech/company ×0.85, description ×0.5; dropped with no words               |
| recency                       | ≤3d 100 · ≤7d 80 · ≤14d 55 · ≤30d 30 · older 10                               |                                                                                     |
| response ("likely to answer") | company answered you before 55 + posted ≤7d 20 + skill gaps 0 → 25 / 1–2 → 15 | answered = a tracker stage past APPLIED or a status-update email (`emailResponses`) |

Every card under the personal sort shows **"ציון אישי N · למה N?"** with the reasons and their points
(`PersonalWhy`). The UI states plainly that this is a rule-of-thumb estimate, not a prediction.

## Bilingual

Keywords go through `parseSearchQuery` with the company lexicon — the same equivalences as the
search box (#67): ריאקט = React, אינטל = Intel, keyboard-layout typos. Description hits come from one
indexed DB text query per keyword (`searchWhere`), so jobs are scored without loading descriptions.

## Code

- `src/lib/ranking/personal.ts` — schema, normalize, hits, score (pure, tested in `tests/personal-ranking.test.ts`)
- `src/lib/ranking/server.ts` — load prefs, responded companies, `rankPersonal`
- `src/app/jobs/ranking/*` — settings page + `saveRankingPrefs` action
- `src/components/ranking/*` — `RankingForm`, `PersonalWhy`
- `src/lib/jobs/filters.ts` — `personal` sort key, `SortContext` in `effectiveSort` / `needsScoring`
