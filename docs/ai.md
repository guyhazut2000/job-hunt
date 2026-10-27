# AI features (Google Gemini, free tier)

## What uses AI

| Feature                      | Where                              | Code                                                | Fallback without AI                                      |
| ---------------------------- | ---------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| CV tips for a job            | Job page → "CV tips"               | `src/lib/ai/cv-suggestions.ts` (feature `cv_tips`)  | Heuristic suggestions (missing skills, impact, headline) |
| CV → structured profile      | Profile / onboarding CV upload     | `src/lib/profile/extract.ts` (feature `cv_extract`) | Heuristic extractor                                      |
| Personalised outreach drafts | "People at the company" → AI draft | `src/lib/outreach/messages.ts` (feature `outreach`) | Rendered templates                                       |

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
2. **Limits** (counted in `AiUsage`, rolling windows, cache hits are free):
   - `AI_USER_DAILY_LIMIT` (default 15) uncached calls per user / 24h
   - `AI_GLOBAL_DAILY_CAP` (default 400) for the whole app / 24h
   - `AI_GLOBAL_PER_MINUTE` (default 8) for the whole app / minute
3. **429 / RESOURCE_EXHAUSTED** from Google → `AiLimitError("provider_quota")`.

When a limit is hit the feature shows its non-AI result plus a friendly note (Hebrew/English strings in
`src/lib/i18n/ai.ts`), e.g. "שירות ה-AI עמוס כרגע. בינתיים מוצגות המלצות בסיסיות…".

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
  profile data. Before selling the product commercially / onboarding real customers at scale, move to the paid
  tier (attach billing to the AI Studio project — paid-tier data is not used for training), update the privacy
  policy to name Google as an AI sub-processor, and revisit `AI_*` limits per plan (`src/lib/billing.ts`).

## Tests

`tests/ai.test.ts` uses `MockLanguageModelV3` and an in-memory store; CI never calls the real API
(no `GEMINI_API_KEY` in CI → mock provider).

## Follow-ups

- **Personalised study plan** for the skill-gap / `/learn` roadmap feature (in progress on another branch):
  once merged, add a `study_plan` call (feature id already reserved in `AiFeature`) that takes the computed
  gap list + roadmap nodes and returns a week-by-week plan, interview questions and a CV bullet via the same guard.
- Count `cv_tips` against the plan's monthly allowance (`PLANS.aiReviewsPerMonth`) once billing is live.
- Purge expired `AiCache` rows and old `AiUsage` rows in the daily cron.
