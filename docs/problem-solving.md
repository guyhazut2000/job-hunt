# Problem-solving method (`/learn/problem-solving`)

LeetCode-style interview prep that trains the **thinking method**, not typing code: read the signals in a
problem, map them to a pattern, justify the choice, and review the patterns you keep missing.

All content (patterns, templates, problems, checklist) is original and paraphrased. External sites are
outbound links only (`leetcode.com/problems/<slug>` for "try it yourself", roadmap.sh from `/learn`).

## Sections

| Route                                    | Access    | What                                                                                                                |
| ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `/learn/problem-solving`                 | public    | Hub + interactive decision guide (10 questions → ranked candidate patterns with reasons) + complexity table         |
| `/learn/problem-solving/checklist`       | public    | One-page printable checklist (print CSS hides the app chrome, A4)                                                   |
| `/learn/problem-solving/patterns[/id]`   | public    | 21 pattern cheat sheets: signals, template (pseudo-code), time/space, pitfalls, variants, related, example problems |
| `/learn/problem-solving/data-structures` | public    | 13 data structures: operation costs, when to use, pitfalls, patterns that use them                                  |
| `/learn/problem-solving/interview`       | public    | 7-step interview flow with "say it" lines, communication tips, edge-case list                                       |
| `/learn/problem-solving/practice[/id]`   | signed in | 52 paraphrased problems: checklist → pick ≤3 patterns → justify (text or mic) → verdict + feedback                  |
| `/learn/problem-solving/analyze`         | signed in | Paste any problem → checklist walkthrough, candidates, target complexity, clarifying questions                      |

Entry points: card on `/learn`, header "More" menu, Problem-solving card on `/learn/me`.

## Code

- `src/lib/algo/` — pure, unit-tested (`tests/problem-solving.test.ts`):
  - `types.ts`, `patterns.ts`, `data-structures.ts`, `problems.ts`, `checklist.ts`, `best-practices.ts` — content (he/en).
  - `engine.ts` — `scoreGuide` (weights per checklist option + size→complexity), `detectSignals`/`detectBound`
    (paste mode, English + Hebrew), `gradePick`, `checkKeys`, `patternStats`, `reviewSchedule`, `nextProblem`.
  - `feedback.ts` — zod schemas, prompts (user text fenced in `<reasoning>` / `<problem>` and treated as data),
    normalizers, deterministic heuristics. `feedback-server.ts` — guarded Gemini call → heuristic fallback.
  - `server.ts` — attempt queries + daily cap.
- `src/app/learn/problem-solving/` — pages + `actions.ts` (`submitAttempt`, `analyzeProblem`).
- `src/components/problem-solving/` — UI. Strings: `src/lib/i18n/problem-solving.ts`.

## Grading and AI

- **The verdict is always deterministic**: `correct` if any pick is an expected or "also OK" pattern,
  `partial` if a pick shares the family of an expected pattern, else `miss`. The checklist answers are compared
  with the problem's key signals and shown side by side.
- **Feedback on the justification** uses Gemini via `guardedLLM` (features `algo_feedback`, `algo_walkthrough`:
  shared DB cache + per-user/global daily limits, see `docs/ai.md`). Without a key (`LLM_PROVIDER=mock`, CI),
  on a limit or on invalid output, a heuristic coach is used (verdict, checklist mismatches, pattern keywords).
  The UI shows the source (AI / offline / limit reached).
- App cap: 60 attempts + analyses per user per day (`ATTEMPTS_PER_DAY`).

## Progress (additive migration `20261029160000_problem_solving`)

`PatternAttempt` (userId, mode `practice|paste`, problemId, answers, picked, expected, result, reasoning,
feedback, source, createdAt). From it:

- **Per-pattern stats**: attempts and accuracy (partial = ½); weak = ≥2 attempts and < 60%.
- **Spaced review** per problem from the latest attempt: miss → due now, partial → +1 day,
  correct streak 1/2/3+ → +1/+3/+7 days.
- **Next problem**: due review → weak pattern → pattern not yet tried → least-practised.
- Attempts count as learning activity (streak / last activity in `learningSnapshot`).

## Limits / not verified

- Pattern ranking is a heuristic aid; several patterns can be valid. Problems list an "also OK" set.
- Paste-mode detection is regex-based; the AI walkthrough is better when a key is configured.
- Problem data ships in the client bundle (the guide uses it); fine for a self-practice tool.
