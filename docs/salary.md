# Salary bands (הערכות שכר)

Gives a rough monthly gross base-salary band per job, and per role × seniority on company pages, so a
user can decide whether a job is worth applying to and what to ask for. **Everything shown is an
estimate unless the posting itself states a range.**

## Data sources

### Used

| Source                                                             | What we use                                                | Link                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| SQLink salary survey 2026                                          | Role × years-of-experience ranges (tech)                   | https://www.sqlink.com/salary/                                                         |
| TechJob software salary survey 2026                                | Cross-check of tech ranges                                 | https://www.techjob.co.il/salary-survey/software                                       |
| AllJobs salary survey                                              | Business/ops roles (sales, marketing, finance, HR, legal)  | https://www.alljobs.co.il/User/SalaryCompound/SalarySurvey.aspx                        |
| JobInfo salary tables                                              | Cross-check for business roles                             | https://www.jobinfo.co.il/%D7%98%D7%91%D7%9C%D7%90%D7%95%D7%AA-%D7%A9%D7%9B%D7%A8.aspx |
| CBS (Israeli Central Bureau of Statistics), July 2026 wage release | Sanity anchor: average hi-tech wage ₪34,301/month          | https://www.cbs.gov.il/he/mediarelease/DocLib/2026/275/26_26_275b.pdf                  |
| Salary ranges stated in job descriptions                           | Overrides the estimate (parser: `src/lib/salary/parse.ts`) | n/a (our own ingested postings)                                                        |
| In-app anonymous reports                                           | Blended in once a bucket has n ≥ 5                         | n/a (`SalaryReport` table)                                                             |

The surveys were read by hand and summarised into a curated table (`src/lib/salary/reference.ts`,
values in ₪K: p25 / median / p75). No survey text or tables are copied verbatim, and nothing is scraped
at runtime. Review the table once a year when the surveys are republished and bump `REFERENCE_YEAR`.

### Rejected

- **Glassdoor / Indeed**: their ToS forbid scraping and they have no public salary API. Excluded per the brief.
- **Levels.fyi**: the ToS forbid automated access and building derived datasets
  (https://www.levels.fyi/about/terms.html). Data licensing is a paid enterprise product
  (https://www.levels.fyi/offerings/data/, ≈ $9.6K+/yr). Could be revisited with a licence.
- **Adzuna API**: no Israel market (https://developer.adzuna.com/overview lists the supported countries).
- **Israel Innovation Authority / IVC reports**: sector-level aggregates (average wage, headcount),
  with no role × seniority bands. Useful context, but not usable as a band source.
- **CBS per-role data**: CBS publishes by industry/occupation group, not by tech function or seniority,
  so it is only a sanity anchor.

## How the estimate works (`src/lib/salary/estimate.ts`)

1. **Posted range wins.** If the description contains an ILS range near a salary keyword
   (שכר / salary / compensation…), we show it as-is: basis `posted`, high confidence, not an estimate.
   Hourly and yearly amounts are normalised to monthly (182 h/month, ÷12). Implausible values are
   ignored: outside ₪6K–150K/month, or max > 3×min. USD/EUR ranges (e.g. US-based postings) are shown
   as info only and are not converted.
2. **Reference band.** Otherwise: family (from `roleCategory` + title) × level (from `seniority`) →
   reference p25/median/p75. Interns get ×0.6 and VP/C-level ×1.3. Both are marked extrapolated, low confidence.
3. **Market reports.** Anonymous reports for the same family × level at _other_ companies, once
   n ≥ 5, are blended in with weight `min(0.5, n/(n+20))`, after outlier filtering (0.4–2.5× the reference median).
4. **Company tier (estimate).** ×1.08 for a curated list of established / high-paying Israeli
   companies or size 1000+, ×0.95 for size ≤ 50, ×1.0 otherwise. Labeled in the UI as an adjustment.
   Skipped when the company has its own reports.
5. **Company reports.** Once n ≥ 5 for this company × family × level, blended with weight
   `min(0.8, n/(n+5))`. Basis becomes `reports`.
6. **Confidence.** medium for well-covered tech rows; low for thin rows (business roles, design)
   or extrapolated levels; high only for posted ranges or ≥ 15 company reports.

**What to ask for** (`askFor`): compares the user's profile years with the level's typical years.
Below the range, the anchor is near p25; inside it, interpolated; above it, near p75. The ask is
`[max(p25, anchor×1.03), min(p75×1.1, anchor×1.1)]`, rounded to ₪500. We also show where the
user's stated minimum salary falls relative to the band, plus a reminder to negotiate the whole
package (equity, bonus, keren hishtalmut, car).

## Privacy and abuse controls (anonymous reports)

- Fields stored: company, family, level, optional years, monthly gross. No user id, name, email,
  title text or free text.
- `reporterKey` = HMAC-SHA256(AUTH_SECRET, userId). It is pseudonymous and is used only for the
  one-report-per (company, family) upsert and the rate limit (5 per 24 h).
- Login required. zod validation: gross ₪3K–200K, years 0–50. Plausibility check: 0.3–3× the reference median.
- **k-anonymity:** no bucket with fewer than 5 reports is ever returned to the client or blended
  in, and individual values are never shown, only rounded percentiles.

## Caveats

- Bands are base gross monthly salary only. Equity and bonuses can dominate at senior levels.
- The survey ranges are placement-firm data skewed to Tel Aviv / center. Periphery is likely lower.
- Business-role coverage is thin.
- None of the currently ingested Israeli postings state an ILS range. The parser is ready for when they
  do (and for ATS structured pay fields, see follow-ups).

## Follow-ups

- Ingest Greenhouse `pay_input_ranges` / Lever `salaryRange` structured fields.
- Jobs-list salary sort/filter, deferred to avoid conflicting with PR #8 (feat/job-sort-filters).
  Reuse its `jobFunction` for family mapping once merged.
- Job cards use survey + tier only (no per-card DB query). Reports show up on the job and company pages.
- Delete or rotate the `reporterKey` link on account deletion (reports are already unlinkable without AUTH_SECRET).
