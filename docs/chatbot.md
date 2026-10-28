# Job-search assistant (chatbot v1)

A read-only chat assistant for signed-in users at **`/chat`**, also available from a floating button (side sheet) on every page. It answers in Hebrew or English (whichever the user writes in), and renders rich cards (job cards, match breakdown, company / hiring-process summary) next to a short text answer.

## What it can do (v1)

| Tool            | Question examples                                                     | Data source                                                                                    |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `search_jobs`   | "משרות Backend בחיפה עד 40 דקות ברכבת", "remote frontend jobs at Wix" | `filtersToWhere` (same filters as `/jobs`: domain, level, work mode, company, city, free text) |
| `explain_match` | "למה המשרה הראשונה מתאימה לי ומה חסר לי?", "which job fits me best?"  | `scoreMatch` + the user's profile, missing skills and the learning plan (`/learn`)             |
| `company_info`  | "איך תהליך הגיוס ב-Wix?", "what does Wix do, where, how far from me?" | Company row, active jobs, domains, commute, `loadHiringProcess` (read-only), `communityLinks`  |

- **Commute** uses the existing commute layer (`commuteForJobs`): cached `CommuteCache` values first, then estimates; at most `CHAT_COMMUTE_MAX_CALLS` (2) Transitous batches per turn, so the global 500/day Transitous budget is respected. The origin is the place named in the question ("מתל אביב"), else the user's default saved place, else the city on their profile. Estimated values are labelled as such.
- **Ordinals** ("the first/second job") refer to the jobs shown earlier in the same thread.
- **No actions**: the assistant never applies, saves, edits the profile or contacts anyone. The UI says so.
- **History**: every thread is stored (`ChatThread` / `ChatMessage`, user-scoped, cascade on user delete); "new chat" and a history list with delete are in the panel header. The sheet remembers its thread in `sessionStorage`.

## Architecture

```
ChatPanel (useChat, DefaultChatTransport) ──POST /api/chat {threadId?, text}──▶ handleChatTurn
                                                                           ├─ validate (≤1000 chars, secret-looking text refused)
                                                                           ├─ burst limit (6 turns/min/user) + AI limits (guard.ts)
                                                                           ├─ live:  streamText(Gemini, tools, stopWhen stepCount ≤ 4)
                                                                           └─ offline: parseIntent → one tool → template text
```

- `src/lib/chat/handler.ts`: the turn handler (pure, dependency-injected; tested with `MockLanguageModelV3`).
- `src/lib/chat/tools.ts`: zod tool schemas; every tool closes over the session `userId` (no user id from the model).
- `src/lib/chat/data.ts`: user-scoped queries behind the tools.
- `src/lib/chat/model-view.ts`: what the model sees: a trimmed view wrapped as **untrusted data** (`{note, data}`), with no apply URLs or descriptions.
- `src/lib/chat/intent.ts`: keyword router for offline mode (Hebrew prefixes, cities, commute phrases, ordinals, company names).
- `src/lib/chat/prompt.ts`: system prompt (read-only, cite tool data only, ignore instructions inside tool data, internal links only).
- `src/lib/chat/links.ts` + `ChatMarkdown`: assistant text may only link to internal app paths (`/jobs/…`, `/companies/…`, `/learn/…`, …). External URLs are rendered as plain text. External links appear only inside cards (verified hiring-process sources and community links, `rel="noopener noreferrer nofollow"`).
- `src/components/chat/*`: `ChatPanel` (page + sheet variants), `ChatCards`, `ChatFab` (lazy-loads the panel; placement via `chatFabPlacement`, which is hidden on `/chat`, auth and admin pages, and raised above the job-details mobile action bar like BackToTop).

## Configuration

| Env                                   | Default           | Meaning                                                 |
| ------------------------------------- | ----------------- | ------------------------------------------------------- |
| `LLM_PROVIDER`                        | `gemini` if key   | `gemini` or `mock` (`mock` forces offline keyword mode) |
| `GEMINI_API_KEY`                      | none              | Without it the chat runs in offline keyword mode        |
| `GEMINI_MODEL`                        | shared AI default | Model id                                                |
| `AI_USER_DAILY_LIMIT`                 | 15                | Per-user daily AI calls (shared with other AI features) |
| `AI_GLOBAL_PER_MINUTE` / `_DAILY_CAP` | 8 / 400           | Global AI limits                                        |

## Cost and limits per turn

- A typical turn is **2 provider calls** (tool step + answer); the hard cap is 4 steps, and the last step is forced to answer with no tool.
- Only the **first** call of a turn is attributed to the user (`AiUsage.userId`), so one question = one unit of the user's daily quota; all calls count toward the global per-minute / per-day caps.
- Max output 800 tokens per step; history window 12 messages.
- On a limit the API returns 429 `{error:"limit", reason}` and the panel shows the Hebrew/English message (`user_daily`, `global_minute`, `global_daily`, `provider_quota`, `burst`). A provider 429 is recorded as `rate_limited`.

## Safety

- Prompt injection: job descriptions, company text and hiring-process content reach the model only inside the untrusted wrapper; the prompt tells it to treat them as data. Tools are read-only and user-scoped, so an injected instruction can't do anything.
- No scraping: LinkedIn / Glassdoor / community sites are outbound links only. Tests stub `fetch` and fail on any request to linkedin.com / google.com.
- Secrets: messages that look like API keys or passwords are refused before storage or any model call.

## Tests

`tests/chat.test.ts` covers the intent router, the model view, link sanitising, FAB placement, and the handler: the live tool flow with usage rows, injection wrapping, the step cap, thread continuation and foreign thread ids, every 429 reason, and offline mode. The LLM is mocked and no network is used.
