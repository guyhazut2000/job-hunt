# Concepts (מושגים)

A personal glossary inside `/learn` for learning and drilling into concepts with AI — Docker, OSI, image layers, `sudo`, Homebrew, feature-based structure, CI/CD — and company-specific ones such as Amazon's Leadership Principles or the STAR method.

## Routes

| Route                  | What                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/learn/concepts`      | Add a concept (free text + mic, or a suggestion chip), search / filter your list, contextual suggestions from the skills you're learning |
| `/learn/concepts/[id]` | Overview → drill-down buttons → saved chat; status, confidence, tags, category, notes; docs / roadmap / official links                   |
| `/learn/[skill]`       | "Concepts around {skill}" chips (e.g. Docker → OSI, image layers, best practices)                                                        |
| `/companies/[slug]`    | "Concepts & culture" — your concepts for that company + suggestions (LPs, STAR, how they hire…)                                          |

Signed-in only (`requireUser`). The `/learn` hub has an entry card and the header "more" menu links to it.

## Flow

1. **Add** — `addConcept` → `ensureConcept` (idempotent per `userId + slug`). Slugs are normalised with aliases (`brew → homebrew`, `osi → osi-model`, `k8s → kubernetes`, `star → star-method`). Company concepts are namespaced: `amazon~leadership-principles`.
2. **Overview** — what it is, why it exists, how it's used, an example, key points, related concepts. Loaded as: stored shared overview → curated (10 concepts, he/en) → offline fallback (learning-graph summary or a generic template) while the client calls `requestOverview` to generate one with AI.
3. **Drill down** — buttons _go deeper_, _simpler_, _prod example_, _common mistakes_, _compare with X_, plus free chat. Every turn is saved in `ConceptMessage`; opening a NEW concept's chat moves it to LEARNING.
4. **Graph** — related concepts are chips: clicking one creates (with `parentId`) or opens it. Company concepts' related chips stay under the same company.

## Data (additive migration `20261029150000_concepts`)

- `Concept` — per user: `slug`, `name`, `kind` (TECH | COMPANY), `companyId?`, `status` (NEW | LEARNING | UNDERSTOOD), `confidence` 1–5, `notes`, `category`, `tags[]`, `skill?` (learning-graph id → roadmap link), `parentId?` (concept graph), `lastOpenedAt`.
- `ConceptMessage` — saved conversation (`role`, `action`, `content`, `source` ai | offline | limited).
- `ConceptOverview` — **shared across users**, unique per `key` (slug) × `locale`, so one Gemini call serves everyone.

## AI

- Features `concept_overview` and `concept_chat` through `guardedLLM` — counted against `AI_USER_DAILY_LIMIT` (15/day) and the global limits; identical prompts hit the DB cache (first-turn drill-downs carry no history, so they're shared too).
- Prompts: answer in the UI language, keep technical terms in English; learner text is fenced `<<< >>>`; history window 8 messages; ≤ 900 output tokens.
- Company concepts add rules: general public knowledge only, say so when unsure, never invent quotes, numbers or URLs, no links.
- `LLM_PROVIDER=mock` / no key → labelled offline content ("Offline mode"). At the limit → `aiLimitMessage` notice; nothing breaks.
- Secrets pasted into chat are refused (`looksLikeSecret`).

## Trust labels

- AI overviews/answers are labelled "AI-generated · general knowledge, not verified".
- Company concepts show a disclaimer and **official** links only from a curated, checked list (`COMPANY_SOURCES` — amazon.jobs, Google/Microsoft/Meta/Apple/NVIDIA/monday/Wix/Mobileye careers pages).
- Community links (Glassdoor, Blind, Reddit, Indeed, Geektime) are outbound search links with the "מקור חיצוני · לא מאומת" badge — never fetched or scraped.
- roadmap.sh is linked only through the skill page, never copied.

## Code

`src/lib/concepts/{core,catalog,prompts,fallback,server,store}.ts`, actions in `src/app/learn/concepts/actions.ts`, UI in `src/components/concepts/`, strings in `src/lib/i18n/concepts.ts`, tests in `tests/concepts.test.ts`.
