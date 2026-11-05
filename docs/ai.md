# AI features (Google Gemini, free tier)

## What uses AI

| Feature                      | Where                                                     | Code                                                                   | Fallback without AI                                                                                          |
| ---------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| CV tips for a job            | Job page → "CV tips"                                      | `src/lib/ai/cv-suggestions.ts` (feature `cv_tips`)                     | Heuristic suggestions (missing skills, impact, headline)                                                     |
| CV → structured profile      | Profile / onboarding CV upload                            | `src/lib/profile/extract.ts` (feature `cv_extract`)                    | Heuristic extractor                                                                                          |
| Personalised outreach drafts | "People at the company" → AI draft                        | `src/lib/outreach/messages.ts` (feature `outreach`)                    | Rendered templates                                                                                           |
| Stage practice + Q&A         | `/learn/[skill]/[stage]` first open                       | `src/lib/learning/hub.ts` (`learn_content`, `learn_regen`)             | Curated static content (16 skills), then generic                                                             |
| AI tutor chat                | Stage workspace → "AI tutor" tab                          | `src/lib/learning/tutor.ts` (`tutor_chat`)                             | Offline reply with a stage question                                                                          |
| Concepts overview + chat     | `/learn/concepts/[id]`                                    | `src/lib/concepts/server.ts` (`concept_overview`, `concept_chat`)      | Curated / learning-graph overview, labelled offline reply                                                    |
| Problem-solving feedback     | `/learn/problem-solving/practice`                         | `src/lib/algo/feedback-server.ts` (`algo_feedback`)                    | Heuristic coach (verdict, checklist, keywords)                                                               |
| Paste-a-problem walkthrough  | `/learn/problem-solving/analyze`                          | `src/lib/algo/feedback-server.ts` (`algo_walkthrough`)                 | Regex signal detection + decision-guide scoring                                                              |
| Tailored CV per job          | `/cv/tailor?job=` / `?app=`                               | `src/lib/cv-tailor/server.ts` (`cv_tailor`)                            | Offline reorder of skills/bullets by job keywords (labelled)                                                 |
| Interview simulation         | `/interview?job=` / `?app=`                               | `src/lib/interview/server.ts` (`interview_plan`, `interview_feedback`) | Offline question bank + rule-based follow-ups + heuristic rubric (labelled)                                  |
| Follow-up email draft        | Dashboard → "טיוטת פולואפ"                                | `src/lib/followup/server.ts` (`follow_up`)                             | He/En templates with title, company, date and a profile line (labelled)                                      |
| Referral request draft       | `/referrals` → "בקשת הפניה"                               | `src/lib/referrals/server.ts` (`referral_request`)                     | He/En template with first name, how you know them, job title + posting URL                                   |
| Interview prep summary       | `/prep/[id]` → "צור סיכום"                                | `src/lib/prep/server.ts` (`interview_prep`)                            | Template overview from title, company, stages, tech; labelled "לא מאומת"                                     |
| Personal study plan          | `/learn/gaps` → "שיפור עם AI" (also linked from `/learn`) | `src/lib/learning/study-plan.ts` (`study_plan`)                        | Week-by-week plan, interview questions and one CV line built from the roadmap nodes, labelled as rules-based |

User-facing output is in the user's locale (Hebrew by default). All calls use structured output
(zod schemas through the Vercel AI SDK `Output.object`) and are validated again before use; any
invalid or failed response falls back to the non-AI behaviour.

## Provider

- Vercel AI SDK (`ai`) + `@ai-sdk/google`, wrapped in `GeminiProvider` (`src/lib/ai/providers/gemini.ts`)
  behind the small `LLMProvider` interface, so OpenAI-compatible endpoints or a paid model can be swapped in by env.
- Model: **`gemini-3.5-flash-lite`** (`GEMINI_MODEL`). On a key created in Oct 2026, `gemini-2.5-flash(-lite)`
  are no longer available to new users; the 3.x Flash models have only ~20 requests/day on the free tier, while
  Flash-Lite has ~10–15 RPM and ~500 RPD, which is why it is the default. Google no longer publishes fixed free-tier
  numbers; check AI Studio → Rate limits for the project. Quotas are per Google Cloud project, not per key, and the
  daily quota resets at midnight Pacific time.
- Thinking is set to `minimal` for latency; one retry max so a 429 falls back fast.

## Staying inside the free quota

`GuardedProvider` (`src/lib/ai/guard.ts`) wraps every user-triggered call:

1. **Cache** — the hash of model + prompt + output mode is looked up in `AiCache`; a hit costs no quota
   (TTL `AI_CACHE_TTL_HOURS`, default 30 days). Only valid JSON is cached.
2. **Limits** (counted in `AiUsage`, rolling windows, cache hits are free). This app is one user, so the
   per-user cap matches the global cap. Both sit under Flash-Lite's free tier (~500 RPD, ~10–15 RPM):
   - `AI_USER_DAILY_LIMIT` (default 400) uncached calls per user / 24h
   - `AI_GLOBAL_DAILY_CAP` (default 400) for the whole app / 24h
   - `AI_GLOBAL_PER_MINUTE` (default 8) for the whole app / minute
3. **429 / RESOURCE_EXHAUSTED** from Google → `AiLimitError("provider_quota")`.

When a limit is hit the feature shows its non-AI result plus a friendly note (Hebrew/English strings in
`src/lib/i18n/ai.ts`), e.g. "שירות ה-AI עמוס כרגע. בינתיים מוצגות המלצות בסיסיות…".

## Learning hub usage estimates

| Call                       | Requests | Tokens (approx.)                                 | Notes                                                                                       |
| -------------------------- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Stage content (first open) | 1        | ~0.5k in, ~1–2k out (≤ 4.5k)                     | Once per skill × stage × locale for the **whole app** — stored in `StageContent` and shared |
| Regenerate                 | 1        | same                                             | ≤ 3 per stage, `AI_USER_MONTHLY_REGEN_LIMIT` (20) per user / month, same for everyone       |
| Tutor turn                 | 1        | ~1–3k in (system + ≤ 16 history msgs), ≤ 700 out | Counted against `AI_USER_DAILY_LIMIT`; + 5 / minute burst limit                             |

With 81 skills × 3 stages × 2 locales the whole catalogue is ~490 one-off generations, spread over time and
capped by `AI_GLOBAL_DAILY_CAP` (400/day), under Flash-Lite's ~500 RPD. The same 400 is the per-user cap,
because there is one user: the study plan, tutor, chat and every other feature share it. After the cap,
each feature shows its non-AI fallback. Messages are capped at 2,000 characters; text that looks like a
credential is rejected before it reaches the model. The tutor prompt contains only the skill, stage,
exercises/questions and the chat — never profile data or secrets. The study-plan prompt contains only the
gap's roadmap nodes (topics, hours, project text, allowed URLs).

## Env vars

| Name             | Where                                      | Notes                                                       |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `GEMINI_API_KEY` | Vercel Production + Preview, **sensitive** | Google AI Studio key. Never commit or log it.               |
| `GEMINI_MODEL`   | Vercel Production + Preview                | `gemini-3.5-flash-lite`                                     |
| `LLM_PROVIDER`   | Vercel Production + Preview                | `gemini`. Set to `mock` as a kill switch (heuristics only). |
| `AI_*`           | optional                                   | Limits above.                                               |

Preview deployments share the production database, so they share the same cache and usage counters.

## Cost and data

- **Cost: $0** while on the Gemini free tier (requests over the limits get 429, not a bill).
- **Data use:** on the free tier Google may use prompts and responses to improve its products
  (see the "Used to improve our products: Yes" row on the Gemini pricing page). Prompts include CV text and
  profile data. This is a non-commercial practice project with no paid plans, so the free tier is fine; just
  don't put anything in a CV or chat you wouldn't want Google to see. If the app ever had real users, the
  options would be moving the AI Studio project to the paid tier (paid-tier data is not used for training) and
  naming Google as an AI sub-processor in the privacy policy.
- **Limits are the same for everyone** (no plans): the `AI_*` env vars above.

## Tests

`tests/ai.test.ts` uses `MockLanguageModelV3` and an in-memory store; CI never calls the real API
(no `GEMINI_API_KEY` in CI → mock provider).

## Cache and usage cleanup

`/api/cron/notify` (daily, twice) calls `purgeExpiredAiRows` (`src/lib/ai/purge.ts`):

- **AiCache** — rows whose `expiresAt` has passed, and rows older than the current `AI_CACHE_TTL_HOURS`, so
  lowering the TTL takes effect without waiting out an expiry that was written earlier.
- **AiUsage** — rows older than 48 hours. That covers the rolling minute and 24h windows with slack.
  Successful `learn_regen` rows from the current UTC month are kept, because the monthly regeneration cap
  counts them (`monthStart` / `utcMonthStart`).

## Personal study plan

`generateStudyPlan` (`src/lib/learning/study-plan.ts`) takes the top skill gaps that map to roadmap nodes,
plus unfinished prerequisites, and the user's weekly hour goal (`LearningPrefs`, default 5). The page
`/learn/gaps` shows the rules plan immediately (roadmap topics packed into weeks, interview questions, one
CV line that names the skill and invents no metric). "שיפור עם AI" is one `guardedLLM("study_plan", userId)`
call with a zod schema. The response is rejected — and the rules plan stays, labelled — when it names an
unknown skill, breaks prerequisite order, adds a URL that is not on the node, or puts a number in the CV
line that was not in the roadmap text. Output is in the user's locale (Hebrew by default). A link on `/learn`
jumps to the section.
