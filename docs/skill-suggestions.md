# Suggested skills (profile)

`/profile` → profile tab → the "כישורים מומלצים להוספה" card above the professional form.

## What it does

Reads the user's best-matching jobs, finds the skills they ask for that the profile's skills list
doesn't have, and ranks them so the user can add the ones they really have in one click. Adding a
listed skill raises the CV's keyword match, the part of an ATS score a skill can move.

## How it's computed

1. **Jobs** — all active jobs are scored with the jobs-page scorer (`scoreMatch`); the top
   `TOP_JOBS` (20) with a score ≥ `MIN_MATCH` (25) are analyzed (`src/lib/skill-suggest/server.ts`).
2. **Skills per job** — one batched AI call for all 20 postings (feature `skill_suggest`, Gemini
   Flash-Lite through `guardedLLM`, so the per-user/global daily limits and the prompt cache apply)
   returns `required` and `preferred` (nice to have) skills per posting. The job's own tech stack is
   always merged into `required`. Without AI, over the limit, or on a bad response, the rules
   extractor reads tech from the description and treats "nice to have / advantage / יתרון" blocks
   and lines as preferred (`src/lib/skill-suggest/extract.ts`, `heuristicJobSkills`).
3. **Diff** — every name is folded with `canonicalSkill` (learning-graph aliases, `EXTRA_ALIASES`,
   `TECH_KEYWORDS`): `k8s` = Kubernetes, `JS` = JavaScript, `node` = Node.js, `REST API` = REST APIs.
   Skills already in the profile and dismissed skills are removed (`suggestSkills`).
4. **Rank** — by the number of analyzed jobs asking for it, then required count, then coverage gain.
5. **ATS impact** — keyword coverage per job = matched weight / total weight (required 1, preferred
   0.5). A skill's gain is the coverage points it adds, averaged over the jobs that ask for it;
   the high/medium/low label combines that with the share of jobs and the required ratio
   (`impactLevel`). The header shows the current average coverage.

## Caching

- `SkillSuggestState` (one row per user) stores the day's extraction: Israel calendar day,
  a fingerprint of the analyzed job ids, source (`ai` / `rules`), limit reason, per-job skills.
  A new day or a different job set recomputes; profile skill changes don't need a recompute
  (the diff runs on every render).
- The page render never waits on the model: with no cache for today it shows the rules preview
  and the client asks for the AI reading with a server action (`pendingAi`).
- "רענון" forces a recompute; an identical prompt (same jobs) is still served from the AI cache.
- Dismissed suggestions are stored as canonical keys in the same row; "הצגת המוסתרים" clears them.

## Notes

- Add only skills you really have; the card links to `/learn/gaps` (skill gaps + study plan),
  which ranks gaps across target/saved/applied jobs and debriefs.
- "Add" writes `{ name, level: GOOD }` into `skillItems` (and the `skills` mirror) and refreshes the
  page, so unsaved edits in the professional form below are discarded.
