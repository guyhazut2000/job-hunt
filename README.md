# job-hunt

Tech job search for Israel — aggregated jobs from company ATS boards, explainable match scores,
AI CV suggestions and an application tracker. Hebrew-first (RTL) with English support.

> Working name. See [docs/product-spec.md](docs/product-spec.md) and
> [docs/competitive-analysis.md](docs/competitive-analysis.md).

## Features (MVP)

- **Job feed** with filters (text, role, seniority, location, work mode, tech) and pagination
- **Pluggable ATS ingestion** — Greenhouse, Lever, Comeet adapters + demo seed data
- **Auth** — email/password via Auth.js (credentials, JWT), USER / ADMIN roles
- **Profile & CV** — upload PDF/DOCX/TXT, text extraction, skill detection
- **Match score** 0–100 with matched/missing skills breakdown
- **AI CV suggestions** per job behind a pluggable LLM provider (offline mock by default)
- **Kanban application tracker** (drag & drop, manual entries)
- **Company pages**, **pricing / Stripe-ready billing stub**, **admin area**
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
npm run db:seed               # demo companies, jobs and users
npm run dev                   # http://localhost:3000
```

Demo accounts (password `password123`):

| Email                  | Role                             |
| ---------------------- | -------------------------------- |
| `admin@job-hunt.local` | Admin (access to `/admin`)       |
| `demo@job-hunt.local`  | Job seeker with a filled profile |

## Scripts

| Script                                                   | Purpose                       |
| -------------------------------------------------------- | ----------------------------- |
| `npm run dev` / `build` / `start`                        | Next.js                       |
| `npm run lint` · `typecheck` · `test` · `format:check`   | Quality gates (all run in CI) |
| `npm run db:up` · `db:migrate` · `db:deploy` · `db:seed` | Database                      |

## Environment variables

See [`.env.example`](.env.example). Only `DATABASE_URL` and `AUTH_SECRET` are required.

| Variable                                                         | Notes                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`       | Empty → mock provider. `openai` works with any OpenAI-compatible API. |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` | Billing stays disabled until set.                                     |
| `CRON_SECRET`                                                    | Protects `POST /api/cron/ingest`.                                     |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER`                                 | `console` or `none`.                                                  |

## Ingesting real jobs

1. Sign in as admin → `/admin` → **Add company**: choose provider and board id
   - Greenhouse: board token (`boards.greenhouse.io/<token>`)
   - Lever: site name (`jobs.lever.co/<site>`)
   - Comeet: `<companyUid>:<token>`
2. Click **Sync all**, or schedule:

```bash
curl -X POST https://your-app/api/cron/ingest -H "Authorization: Bearer $CRON_SECRET"
```

Adding an ATS = implement `AtsAdapter` in `src/lib/ingestion/adapters/` and register it in `registry.ts`.

## Architecture

```
src/
  app/                 routes (feed, job, companies, dashboard, profile, pricing, admin, legal, api)
  app/actions.ts       server actions (zod-validated, user-scoped)
  components/          UI components
  lib/ingestion/       ATS adapters, normalization, sync runner
  lib/ai/              LLMProvider interface, mock + OpenAI-compatible providers, match score, CV tips
  lib/cv/              CV text extraction + parsing
  lib/i18n/            he/en dictionaries
  lib/billing.ts       plans + Stripe stub
  lib/analytics.ts     track() hook
prisma/                schema, migrations, seed
tests/                 vitest unit tests
```

Demo companies in the seed are fictional.

---

## תקציר בעברית

**job-hunt** היא פלטפורמת SaaS לחיפוש עבודה בהייטק בישראל: משרות שנאספות ישירות ממערכות הגיוס של החברות
(Greenhouse, Lever, Comeet), ציון התאמה שקוף לפרופיל, הצעות AI לשיפור קורות החיים לכל משרה, ולוח מעקב מועמדויות.
הממשק בעברית (RTL) עם תמיכה מלאה באנגלית.

הרצה מקומית: `npm install` ← `cp .env.example .env` ← `npm run db:up` ← `npx prisma migrate dev` ← `npm run db:seed` ← `npm run dev`.

משתמשי דמו: `admin@job-hunt.local` / `demo@job-hunt.local` עם הסיסמה `password123`.
