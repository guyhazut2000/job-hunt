# job-hunt

Tech job search for Israel — aggregated jobs from company ATS boards, explainable match scores,
AI CV suggestions and an application tracker. Hebrew-first (RTL) with English support.

> A non-commercial practice project, open source under the [MIT License](LICENSE). No pricing, plans or
> payments: every feature is available to every user. See [docs/product-spec.md](docs/product-spec.md).

## Features (MVP)

- **Job feed** with filters (text, role, seniority, location, work mode, tech) and pagination
- **Real Israeli hi-tech jobs** — 45 curated companies on public Greenhouse/Lever boards, filtered to Israel, synced daily (Comeet adapter included)
- **Auth** — email/password via Auth.js (credentials, JWT), USER / ADMIN roles
- **Profile & CV** — upload PDF/DOCX/TXT, text extraction, skill detection
- **Match score** 0–100 with matched/missing skills breakdown
- **AI CV suggestions** per job behind a pluggable LLM provider (offline mock by default)
- **Kanban application tracker** (drag & drop, manual entries)
- **Company pages**, **admin area**
- Privacy & Terms placeholders, analytics hooks, HE/EN i18n

## Stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL 16 ·
Auth.js v5 · Vitest · ESLint · Prettier · GitHub Actions

## Getting started

Requirements: Node 20+, Docker.

```bash
npm install
cp .env.example .env          # set AUTH_SECRET (npx auth secret)
npm run db:up                 # Postgres in Docker
npx prisma migrate dev        # create schema
npm run db:seed               # users, the 45 real sources, and fictional demo jobs (local only)
npm run ingest                # optional: fetch real jobs from the public boards
npm run dev                   # http://localhost:3000
```

Demo accounts (password `password123`):

| Email                  | Role                             |
| ---------------------- | -------------------------------- |
| `admin@job-hunt.local` | Admin (access to `/admin`)       |
| `demo@job-hunt.local`  | Job seeker with a filled profile |

## Scripts

| Script                                                   | Purpose                                |
| -------------------------------------------------------- | -------------------------------------- |
| `npm run dev` / `build` / `start`                        | Next.js                                |
| `npm run lint` · `typecheck` · `test` · `format:check`   | Quality gates (all run in CI)          |
| `npm run db:up` · `db:migrate` · `db:deploy` · `db:seed` | Database                               |
| `npm run ingest`                                         | Sync all sources into `DATABASE_URL`   |
| `npm run sources:verify`                                 | Check every curated board live (no DB) |

## Environment variables

See [`.env.example`](.env.example). Only `DATABASE_URL` and `AUTH_SECRET` are required.

| Variable                                                   | Notes                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | Empty → mock provider. `openai` works with any OpenAI-compatible API.                 |
| `CRON_SECRET`                                              | Protects `/api/cron/ingest` (GET from Vercel Cron, or POST).                          |
| `SEED_DEMO_DATA`                                           | `false` skips fictional demo companies (always skipped when `VERCEL_ENV=production`). |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER`                           | `console` or `none`.                                                                  |

## Ingesting real jobs

Sources live in [`src/lib/ingestion/sources.ts`](src/lib/ingestion/sources.ts): 45 Israeli (or Israel-office) hi-tech
companies whose careers pages use a **public, documented job-board API** — 38 on Greenhouse
([Job Board API](https://developers.greenhouse.io/job-board.html)) and 7 on Lever
([Postings API](https://github.com/lever/postings-api), `eu:` prefix = Lever EU instance). Every board was checked to
return Israeli openings (`npm run sources:verify`).

- **Israel only** — postings are kept when their location/offices (Greenhouse), `country`/locations (Lever) or
  location (Comeet) is in Israel; city names are canonicalized (English + Hebrew, e.g. `תל אביב`, `Petach Tikva`).
- **Polite** — one request per board per run, identifying `User-Agent`, 20s timeout, 750 ms pause between companies,
  read-only public endpoints. A failing board keeps its existing jobs.
- **Attribution** — each job page credits the source board and links to the original posting; “Apply” always goes to
  the company’s own page.
- **Schedule** — Vercel Cron (`vercel.json`) calls `GET /api/cron/ingest` daily at 04:00 UTC with
  `Authorization: Bearer $CRON_SECRET`. Admins can also click **Sync all** in `/admin`, or:

```bash
curl -X POST https://your-app/api/cron/ingest -H "Authorization: Bearer $CRON_SECRET"
```

To add a company: append it to `sources.ts` (or use `/admin` → **Add company**), then run `npm run sources:verify`.

- Greenhouse: board token (`boards.greenhouse.io/<token>`)
- Lever: site name (`jobs.lever.co/<site>`; `eu:<site>` for `jobs.eu.lever.co`)
- Comeet: `<companyUid>:<token>` — the Careers API token is issued by the company, so Comeet sources need the
  company's cooperation; none are configured yet.

### Manual companies & startup discovery

Companies whose jobs can't be pulled automatically are **never dropped**: they are listed as _manual check_
(`syncMode = MANUAL`) with a link to their official careers page and a note (he/en). The curated list lives in
[`src/lib/companies/manual.ts`](src/lib/companies/manual.ts) and is synced by every ingest run; `/admin` can add a
manual company or switch one to manual. An AUTO company whose feed fails 3 runs in a row stays listed, flagged with
its last error. `/companies` filters all / auto / manual.

New Israeli startups are found from open data (TechMap, YC, Wikidata) — no LinkedIn, robots.txt respected — and
added as AUTO when a public ATS board is detected, as MANUAL with a careers link otherwise, or queued for review in
`/admin`. Details, alternatives and costs: [`docs/startup-discovery.md`](docs/startup-discovery.md).

Adding an ATS = implement `AtsAdapter` (`fetchRaw`, `isInIsrael`, `normalize`) in `src/lib/ingestion/adapters/` and
register it in `registry.ts`. Tests use JSON fixtures in `tests/fixtures/`.

Functions run in `fra1` (Frankfurt, closest to Israel) via `vercel.json`.

## Architecture

```
src/
  app/                 routes (feed, job, companies, dashboard, profile, learn, admin, legal, api)
  app/actions.ts       server actions (zod-validated, user-scoped)
  components/          UI components
  lib/ingestion/       ATS adapters, normalization, sync runner
  lib/ai/              LLMProvider interface, mock + OpenAI-compatible providers, match score, CV tips
  lib/cv/              CV text extraction + parsing
  lib/i18n/            he/en dictionaries
  lib/analytics.ts     track() hook
prisma/                schema, migrations, seed
tests/                 vitest unit tests
```

Demo companies in the seed are fictional and are only seeded for local development, never in production.

---

## תקציר בעברית

**job-hunt** הוא פרויקט תרגול לא מסחרי לחיפוש עבודה בהייטק בישראל: משרות שנאספות ישירות ממערכות הגיוס של החברות
(Greenhouse, Lever, Comeet), ציון התאמה שקוף לפרופיל, הצעות AI לשיפור קורות החיים לכל משרה, ולוח מעקב מועמדויות.
הממשק בעברית (RTL) עם תמיכה מלאה באנגלית.

הרצה מקומית: `npm install` ← `cp .env.example .env` ← `npm run db:up` ← `npx prisma migrate dev` ← `npm run db:seed` ← `npm run dev`.

משתמשי דמו: `admin@job-hunt.local` / `demo@job-hunt.local` עם הסיסמה `password123`.

## License

[MIT](LICENSE) © 2026 Guy Hazut. This is a non-commercial practice project; there are no paid plans. Being
open source and non-commercial also keeps it within the terms of the free Transitous routing API used by the jobs
map (see [docs/jobs-map.md](docs/jobs-map.md)).

רישיון: [MIT](LICENSE). פרויקט תרגול לא מסחרי, בלי מחירים או מנויים.
