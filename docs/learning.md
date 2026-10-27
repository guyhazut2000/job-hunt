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
(migration `20261028000000_learning_progress`, additive). "Not started" = no row.

Marking **done** adds the skill to the profile at `BASIC` (both `skillItems` and the legacy `skills` column) unless
the profile already covers it under any alias, and sets `addedToProfile`. Moving back to learning / not started
removes only what we added. Paths `/jobs`, `/jobs/[id]`, `/profile`, `/dashboard`, `/learn` are revalidated, so
match scores recalculate. The job panel then shows "before marking X as learned: A%. Now: B%", and
`/learn/[skill]` shows before → now on the top jobs.

Demand per node is one grouped `unnest("techStack")` query on active jobs, cached for 1h (`unstable_cache`, tag
`learning-demand`). `/learn/[skill]` loads at most 400 newest active jobs listing the skill for impact.

## v2: AI (hooks only)

`src/lib/learning/ai.ts` has the interfaces and TODOs, plus the deterministic fallback `heuristicStudyPlan`:

- personalised weekly plan (re-paced by the model, resources restricted to the node's links);
- interview questions per stage, for self-check before "done";
- CV bullet from the finished project + proof link (offered, never auto-saved).

All must go through `guardedLLM("study_plan", userId)` (cache + `AI_*` limits, see `docs/ai.md`) and the plan gate
`LEARNING_AI_LIMITS` (FREE 3 / month, PRO unlimited), and fall back to heuristics when limited.

## Limits

- Hours are rough estimates to job-usable basics, not mastery.
- Prerequisites are hard edges only (e.g. Docker → Linux + networking); "nice to have" relations are not modelled.
- Gain assumes the skill is added at BASIC; real gain is higher at GOOD/EXPERT.
- Jobs whose tech labels aren't in the graph show them as "no roadmap yet".
