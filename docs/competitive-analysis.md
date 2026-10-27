# Competitive analysis — Israeli tech job-search tools

> Method: passive review of competitors' **public marketing pages** only (no sign-up, no scraping of
> listings, no API probing). Nothing — code, copy, assets, branding or design — is copied into job-hunt.
> Observations are paraphrased in our own words. Date: October 2026.

## 1. HireMe (hiremetech.com)

**Positioning (as publicly described):** an AI-first job-search platform for tech roles in Israel, in Hebrew and English.

| Area          | What they publicly claim                                                                  | Notes for us                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Supply        | Thousands of live tech jobs aggregated from 1,500+ company career sites; 2,000+ companies | Coverage is the moat. We start from public ATS APIs (Greenhouse, Lever, Comeet) which are legal, structured and stable. |
| Match score   | 0–100 relevance score per job vs. the user's profile                                      | Table stakes. We make ours **explainable** (skills / role / seniority / location breakdown).                            |
| CV help       | AI suggestions per job to pass ATS screening                                              | Same category; we add honest "never invent experience" guardrails.                                                      |
| Auto-apply    | Bulk/automatic submission to matching jobs with filters, block lists and pause            | Strong hook but risky (quality of applications, ATS ToS, employer perception). **Not in MVP** — see open decisions.     |
| Tracking      | Dashboard of applications, incl. ones added manually                                      | Table stakes; we ship a kanban board.                                                                                   |
| Alerts        | WhatsApp group updates by field/seniority                                                 | Good distribution channel in Israel; later phase (email first).                                                         |
| Employer side | Recruitment product, monthly pricing by open jobs, freemium for small employers           | Two-sided marketplace is a later-phase option.                                                                          |

## 2. Other alternatives in the Israeli market (category level)

- **LinkedIn Jobs** — biggest supply, weak Hebrew UX, noisy listings, Easy Apply.
- **Generic Israeli job boards** (AllJobs, Drushim, JobMaster, etc.) — broad, not tech-focused, agency-heavy listings.
- **Company career pages / ATS boards** — the source of truth, but fragmented across hundreds of sites.
- **Community channels** (Facebook/WhatsApp/Telegram groups, referral networks) — high trust, zero structure.
- **Global AI job copilots** — strong AI, little Israel-specific coverage or Hebrew support.

## 3. Gaps / opportunity for job-hunt

1. **Freshness and trust** — link only to the real application on the company's own ATS, show "last synced", deactivate stale jobs automatically.
2. **Transparency** — explain the score; users trust what they understand.
3. **Hebrew-first UX** that still handles English job descriptions and tech terms properly (RTL + LTR islands).
4. **Privacy as a feature** — Israeli Privacy Protection Law compliance, CV text never shared without consent, clear deletion.
5. **Quality over volume** — help users send fewer, better applications rather than mass auto-apply.

## 4. Differentiation summary

|             | job-hunt (MVP)                            | Typical competitor |
| ----------- | ----------------------------------------- | ------------------ |
| Data source | Public ATS APIs, pluggable adapters       | Scrapers / mixed   |
| Match score | Deterministic + explainable, LLM optional | Black box          |
| AI provider | Pluggable (mock / OpenAI-compatible)      | Fixed              |
| Auto-apply  | Not yet (deliberate)                      | Yes                |
| Pricing     | Free + Pro (₪49/mo placeholder)           | Varies             |
