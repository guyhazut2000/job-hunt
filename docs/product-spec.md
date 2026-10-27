# job-hunt — Product spec (MVP)

## Vision

The fastest, most trustworthy way for tech professionals in Israel to find and land their next job.
Hebrew-first, English supported, web first (mobile apps later).

## Target users

- **Primary:** software engineers, DevOps, data/ML, QA, product and design people in Israel (junior → manager).
- **Secondary:** students / bootcamp grads looking for a first role; returning reservists; olim who prefer English.

## Business model

- **Free:** full feed, filters, match scores, tracker, limited AI CV reviews.
- **Pro (placeholder ₪49/month):** unlimited AI suggestions, alerts, interview prep.
- Later: employer side (promoted jobs, candidate search), B2B for bootcamps/universities. Built as a sellable product: clean modules, documented env, no vendor lock-in.

## MVP scope

| #   | Feature             | Acceptance criteria                                                                                                                                                                                                                                                                                  |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Job feed            | Paginated list of active jobs; filters: free text, role, seniority, location, work mode, tech; URL-driven (shareable, SEO-friendly).                                                                                                                                                                 |
| 2   | Ingestion           | Adapter per ATS (Greenhouse, Lever, Comeet) implementing `AtsAdapter`; upsert by `(source, externalId)`; stale jobs deactivated; each run logged in `IngestionRun`; triggered from admin or the daily Vercel Cron (`/api/cron/ingest`); 45 curated real sources in `sources.ts`, Israel-only filter. |
| 3   | Auth                | Email + password (Auth.js credentials, bcrypt, JWT sessions). Roles: USER, ADMIN.                                                                                                                                                                                                                    |
| 4   | Profile & CV        | Profile fields (role, seniority, location, work mode, years, skills). CV upload PDF/DOCX/TXT ≤ 5MB, text extraction, skill detection, merge into profile. Only extracted text is stored.                                                                                                             |
| 5   | Match score         | 0–100 = skills (50) + role (20) + seniority (20) + location (10); shown on feed and job page with matched / missing skills.                                                                                                                                                                          |
| 6   | AI CV suggestions   | Per job, via `LLMProvider` interface; mock provider (heuristics) when no key; JSON-parsed LLM output with fallback.                                                                                                                                                                                  |
| 7   | Application tracker | Kanban: Saved → Applied → Screening → Interview → Offer / Rejected; drag & drop + select; manual entries for jobs found elsewhere.                                                                                                                                                                   |
| 8   | Company pages       | Company list with open-role counts; company page with details and its jobs.                                                                                                                                                                                                                          |
| 9   | Billing stub        | Plans config, upgrade button, Stripe webhook route; disabled until keys exist.                                                                                                                                                                                                                       |
| 10  | Admin               | Stats, add company ATS board, sync all, recent ingestion runs.                                                                                                                                                                                                                                       |
| 11  | Legal               | Privacy and Terms placeholder pages (HE/EN).                                                                                                                                                                                                                                                         |
| 12  | Analytics           | `track(event, props)` with pluggable sinks; no PII in events.                                                                                                                                                                                                                                        |
| 13  | i18n                | Hebrew (RTL, default) and English (LTR), cookie-based switch.                                                                                                                                                                                                                                        |

## Non-functional

- Next.js App Router, server components, server actions; TypeScript strict; Postgres via Prisma.
- Input validation with zod on every action; user-scoped queries for all user data.
- CI: lint, format check, typecheck, unit tests, migrate + seed + build.
- Accessibility: semantic HTML, labels on every field, keyboard-usable tracker (select fallback for drag & drop).

## Out of scope for MVP (roadmap)

1. Email verification, password reset, OAuth (Google / LinkedIn / GitHub).
2. Job alerts (email → WhatsApp/Telegram).
3. Real Stripe checkout + usage metering for AI reviews.
4. Semantic matching (embeddings) and LLM-explained match.
5. Object storage for original CV files; CV builder / tailored CV export.
6. Auto-apply (needs product + legal decision).
7. Employer side, salary insights, company reviews.
8. Mobile apps / PWA.

## Success metrics

Activation (profile + CV within 24h), weekly active job seekers, apply-clicks per WAU, tracker usage, free → Pro conversion.
