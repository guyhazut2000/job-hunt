# Learning roadmaps ("close the gaps")

Turns a job's missing skills into a learning plan: what to learn, in what order, and how.

## Where it shows

| Surface          | Code                                  | What it does                                                                                                                       |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Job page panel   | `src/components/learning/GapPlan.tsx` | Missing skills + missing prerequisites in learnable order, per-skill gain on this job, open-job demand, hours, match now → after.  |
| `/learn`         | `src/app/learn/page.tsx`              | Role tracks (topologically ordered) and every skill by category, with demand and the user's status.                                |
| `/learn/[skill]` | `src/app/learn/[skill]/page.tsx`      | Prerequisite path, 3-stage timeline, official docs, free course, our project, roadmap.sh link, demand, cross-job impact, top jobs. |
| Progress         | `src/app/learn/actions.ts`            | `setSkillStatus` (not started / learning / done + optional proof URL).                                                             |

The panel only renders for logged-in users with a scorable profile (same condition as the match score).

## The skill graph

- Data: `src/lib/learning/graph-*.ts`, assembled in `skills-graph.ts` (81 nodes). Types in `types.ts`.
- Each node: `id` (URL slug), `label` (same label the extractor in `src/lib/taxonomy.ts` emits), `aliases`
  (case-insensitive, used to map job tech labels and free-text profile skills), `prerequisites` (hard edges, DAG),
  `hours`, bilingual summary, 3 stages of topics, `docs`, `course`, bilingual `project`, optional `roadmapSh` slug.
- **All text is original.** roadmap.sh content is not copied (its license forbids commercial reuse); we only link to
  `https://roadmap.sh/<slug>`. Docs/course entries are links with the publisher's own title.
- Every URL was checked with `curl` to return 200 when added. `dev.mysql.com` and `mathworks.com` return 403 to a
  bare curl but 200 to a browser (bot filtering), so they were kept.
- Tests (`tests/learning.test.ts`) enforce: no cycles, no unknown prerequisites, no duplicate aliases, https-only
  resources, and that every `TECH_KEYWORDS` label resolves to a node. **Adding a keyword to the extractor without a
  node fails CI.**

### Adding a skill

1. Add a node to the right `graph-*.ts` file (keep aliases unambiguous; e.g. "cv" was rejected for OpenCV).
2. `curl -sIL -o /dev/null -w '%{http_code}' <url>` for docs, course and roadmap.sh slug.
3. `npm test -- learning`.

## Algorithms (`src/lib/learning/graph.ts`, pure, unit-tested)

- `resolveSkill(name)` — id/label/alias lookup, lowercased + trimmed.
- `topoSort(ids, graph, priority)` — Kahn's algorithm restricted to the given set; among ready nodes the higher
  priority goes first (then id). Throws on a cycle. `findCycles` / `validateGraph` report problems for tests.
- `planGaps(candidate, job, { demand, doneIds })`:
  1. map `scoreMatch(...).missingSkills` to nodes (unmapped ones are listed as "no roadmap yet");
  2. add transitive prerequisites the user doesn't know (profile skills by alias, or DONE progress), marked
     `isPrerequisite` with `neededFor`;
  3. gain per skill = match with that skill added at BASIC − current match; priority = gain × 1000 + demand,
     prerequisites inherit the max priority of what they unlock;
  4. order with `topoSort`; `after` = match with all the job's mapped missing skills at BASIC.
- `crossJobImpact(candidate, jobs, label)` — number of jobs whose match rises, and the average rise.
- `scoreWithout(candidate, job, labels)` — "before" score for skills added through learning.

## Progress (DB)

`SkillProgress (userId, skill, status LEARNING|DONE, proofUrl?, addedToProfile)`, unique per user+skill
(migration `20261028010000_learning_progress`, additive). "Not started" = no row.

Marking **done** adds the skill to the profile at `BASIC` (both `skillItems` and the legacy `skills` column) unless
the profile already covers it under any alias, and sets `addedToProfile`. Moving back to learning / not started
removes only what we added. Paths `/jobs`, `/jobs/[id]`, `/profile`, `/dashboard`, `/learn` are revalidated, so
match scores recalculate. The job panel then shows "before marking X as learned: A%. Now: B%", and
`/learn/[skill]` shows before → now on the top jobs.

Demand per node is one grouped `unnest("techStack")` query on active jobs, cached for 1h (`unstable_cache`, tag
`learning-demand`). `/learn/[skill]` loads at most 400 newest active jobs listing the skill for impact.

## Learning hub (`/learn/me` + stage workspace)

### Dashboard — `/learn/me` (signed in; linked from the header "More" menu, the mobile sheet, `/learn`, GapPlan)

- **Stats**: hours this week vs a weekly goal (`LearningPrefs.weeklyGoalHours`, 1–60), total hours, skills done,
  streak (consecutive active days, Israel time; yesterday keeps it alive), active days this week (Sun → today).
  Activity = logged study sessions + stage/topic/practice/Q&A updates.
- **Continue** banner → the most recently touched stage.
- **Next best topic** + a queue of 3–4 more (`recommend()` in `src/lib/learning/recommend.ts`, pure and deterministic):
  only skills whose prerequisites are known (plus anything in progress) are eligible. Score =
  continuity (60 + 40 × completion) + job impact (0–40, jobs that rise × avg gain, normalised) +
  foundation (a ready prerequisite gets half the impact of the locked skill it unlocks) + role track (15) +
  unlocks (3 each, max 12) + market demand (0–10). Ties break by id. Each item lists its reasons.
- **Active skills** with per-stage bars, **review queue** (weak Q&A cards that are due), **log a session**
  (5–600 min + note, max 30 / 24h).

### Progress model (additive migration `20261028030000_learning_hub`)

| Table                 | What                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| `StageProgress`       | per user × skill × stage: status, ticked roadmap topics, practice state (JSON) |
| `StudySession`        | minutes + note, optional skill/stage                                           |
| `LearningPrefs`       | weekly goal                                                                    |
| `QuestionReview`      | per user × question: last rating, reps, `dueAt` (spaced repetition lite)       |
| `StageContent`        | generated practice + Q&A per skill × stage × locale, shared by all users       |
| `TutorThread/Message` | AI tutor history per user × stage                                              |

Stage fraction = 1 when done, else 0.9 × ticked topics / topics. When all three stages are done the skill becomes
DONE: it is added to the profile (BASIC) and match scores are revalidated, same as the manual "done" button.
Un-marking a stage of a DONE skill moves it back to LEARNING. Reviews: knew → 1, 3, 7, 16, 35 days; partly →
tomorrow; didn't know → due now.

### Stage workspace — `/learn/[skill]/[stage]` (tabs synced to `?tab=practice|qa|tutor`)

- **Practice**: 1–4 exercises (goal, steps, expected result, progressive hints, checklist, notes / solution /
  GitHub link, mark done; "ask the tutor" pre-fills the chat).
- **Q&A**: 3–8 questions; reveal the answer, then rate knew / partly / didn't. Weak ones come back on the dashboard.
- **AI tutor**: streamed chat (AI SDK `useChat` → `POST /api/learn/tutor`), Socratic, stage- and level-aware,
  Hebrew by default. History per user × stage; "new conversation" starts a fresh thread. Shows remaining daily AI
  quota; offline mode (no key / `LLM_PROVIDER=mock`) replies with a stage question instead.

Content source, in order: cached `StageContent` row → Gemini on first open (zod-validated, then stored and shared)
→ curated static content (`src/lib/learning/content-static.json`, 16 skills × 3 stages × he/en; drafted with
Gemini and reviewed) → generic content built from the roadmap topics. Regenerate: max 3 per stage row, and
`AI_USER_MONTHLY_REGEN_LIMIT` (default 20) per user per month — the same limit for everyone.

## Limits

- Hours are rough estimates to job-usable basics, not mastery.
- Prerequisites are hard edges only (e.g. Docker → Linux + networking); "nice to have" relations are not modelled.
- Gain assumes the skill is added at BASIC; real gain is higher at GOOD/EXPERT.
- Jobs whose tech labels aren't in the graph show them as "no roadmap yet".
