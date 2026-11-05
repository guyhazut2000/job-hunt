# Skill-gap analysis (`/learn/gaps`, #117)

Answers "what should I learn next, given the jobs I actually want?" from the user's own data only.

## Inputs

- **Target jobs** — active jobs in the profile's target roles (and seniority), newest first, up to 150.
- **Saved / applied** — jobs linked to tracker applications (`SAVED` → saved, any other status → applied), up to 400.
- **Debriefs** — the 200 most recent `/prep/[id]` debriefs. A debrief is _weak_ when the outcome is
  `failed` or the rating is ≤ 2; tech mentioned in its "asked" / "improve" text counts as a hit.

A job appearing in several buckets is counted once (applied > saved > target).

## Ranking

For each job, `scoreMatch` gives the missing skills; they are normalised to the learning catalog
(`resolveSkill`) and skills already in the profile are skipped.

`score = jobs missing it + 2 × weak-debrief hits`; ties are broken by the average match-score gain
(`crossJobImpact`). Every number on the page is a count from these inputs — no estimates.

## Output

- Counts card (how many jobs in each bucket, how many have a stack, how many debriefs).
- Study plan for the top 3 gaps: catalog hours and prerequisites, links to `/learn/[id]`, the docs
  and course from the catalog, roadmap.sh (link only), and practice (`/learn/problem-solving`,
  `/learn/system-design`, `/interview`).
- Personal plan (below that): a week-by-week plan for the top gaps that have a roadmap node, including
  unfinished prerequisites, paced to the weekly hour goal from `/learn/me` (default 5). It includes
  interview questions and one CV line. The rules version is shown immediately and labelled as such.
  "שיפור עם AI" is one `study_plan` call (same free-tier guard). Invalid or limited AI output keeps the
  rules plan. See [ai.md](ai.md#personal-study-plan). `/learn` links here.
- Ranked list (8 at a time, "show more") with the share of jobs per gap.
- `/coach` adds a `close_skill_gap` recommendation when the top gap is missing in ≥ 2 jobs or hit
  in a weak debrief (basis: skill, jobs, total, debriefs).

Code: `src/lib/gaps/aggregate.ts` (pure, `tests/skill-gaps.test.ts`), `src/lib/gaps/server.ts`.
