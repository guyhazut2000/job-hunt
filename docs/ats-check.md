# ATS / screening-filter check (`/cv/ats`, #115)

Checks the CV **the app actually exports** (the one-page PDF from `/cv/standard` and the chosen
template), not the profile data. Nothing is sent anywhere; a pasted job description is not stored.

## What it checks

| Group   | Rule               | What                                                                                                         |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| parse   | `textLayer`        | The PDF text extracts back (the same text extraction used for CV uploads), i.e. a parser can read it at all. |
| parse   | `contactInText`    | Email / phone appear in the extracted text (not only in an icon or image).                                   |
| parse   | `headingsInText`   | Section headings survive extraction.                                                                         |
| parse   | `singleColumn`     | One reading order (multi-column layouts get interleaved by parsers).                                         |
| parse   | `standardHeadings` | Headings a parser recognises (Experience / ניסיון, Education / השכלה, …).                                    |
| parse   | `fileSize`         | Under Greenhouse's documented 2.5 MB upload limit.                                                           |
| parse   | `fullTitles`       | Job titles are not abbreviated (`Sr. SWE` → `Senior Software Engineer`).                                     |
| parse   | `dates`            | Every role has parseable dates.                                                                              |
| match   | `keywordCoverage`  | Share of the job's keywords found (Hebrew/English synonyms); pass ≥ 70%, warn ≥ 40%.                         |
| match   | `titleMatch`       | The target title's core words appear.                                                                        |
| match   | `skillsList`       | A plain skills list exists (keyword fields are matched against it).                                          |
| content | `quantified`       | Share of bullets with a number; pass ≥ 40%, warn ≥ 20%.                                                      |
| content | `seniority`        | Ownership / scope signals (led, owned, designed, mentored…).                                                 |
| content | `buzzwords`        | Clichés and LLM-style words (`spearheaded`, `leverage`, …) flagged with a fix.                               |

The score is a weighted share of passing rules (parsing failures weigh the most, because unread text
cannot match anything). It is **not** a simulation of any vendor's ATS and never claims a "pass rate".

## Sources

Shown on the page: Greenhouse support (parse failures, supported formats), Workable ("how ATS reads
resumes"), korotchaim.com (Hebrew support in Comeet / Greenhouse / Lever), HBS "Hidden Workers",
Harvard FAS resume guide, Tech Interview Handbook (resume), arXiv 2406.07016 (LLM-style vocabulary).

## Integration

Linked from `/cv/standard`; links on to `/cv/tailor` (fix keywords for one job) and `/learn/gaps`
(skills missing across many jobs). Code: `src/lib/ats/check.ts` (pure, tested in
`tests/ats-check.test.ts`), `src/lib/ats/server.ts`, `src/app/cv/ats/`.
