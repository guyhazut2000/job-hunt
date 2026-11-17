# CV builder AI assist (`/cv/standard`)

Every step of the guided CV builder (contact, summary, experience, projects, education, skills)
has an **"עזרה מ-AI" / "AI help"** panel. It only _proposes_: each suggestion is previewed with
**accept / edit / reject**, accepting only changes the unsaved draft (live preview + standard
rules update immediately), and nothing reaches the profile until the user presses **Save**.

## What each step offers

| Step       | Import from my uploaded CV                                                                                                | AI                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Contact    | Phone / location / LinkedIn / GitHub / portfolio — only into empty fields                                                 | —                                                                  |
| Summary    | The CV's headline and summary (when different)                                                                            | Headline and summary: "שיפור ניסוח" and "התאמה למשרת יעד"          |
| Experience | Bullets the draft lacks for matched roles; whole roles that aren't in the profile (title, company, dates copied verbatim) | "ניסוח X-Y-Z" and "X-Y-Z מותאם למשרה" for all bullets (one call)   |
| Projects   | Same as experience                                                                                                        | Same as experience                                                 |
| Education  | Degrees, courses, certifications, bootcamps, service not yet listed                                                       | —                                                                  |
| Skills     | Skills / tech in the CV that aren't in the list                                                                           | Link to the profile's suggested skills (docs/skill-suggestions.md) |

The per-bullet "שפר ניסוח" button (`cv_improve`) is unchanged.

## How the upload import works

`loadUploadedCvs` (`src/lib/cv-assist/server.ts`) reads up to 5 of the user's `Resume` rows
(primary first, then newest). It uses the structured profile extracted at upload time
(`Resume.extracted`, from `extractProfile`). Older uploads without it are re-read with the rules
parser (`heuristicExtract`) from the stored text, or from the stored file through the upload's
own `extractText`. `importSuggestions` (`src/lib/cv-assist/core.ts`) diffs that against the draft:
roles match by company (suffix-tolerant), projects by name, education by institution + title,
skills by canonical key; near-duplicate bullets (token similarity ≥ 0.7) are skipped. No AI call.

Accepted new roles / projects / education live in the draft (`add` on an entry, `education[]`)
and are appended to the profile by `mergeDraft` on save; until then they show a "חדש" badge and can
be removed.

## Tailoring to a target job

The target is one of the user's top-5 matching jobs (same scorer as the jobs page) or all five.
Keywords come from today's skill-suggest extraction when it covers those jobs, otherwise the rules
reader (`loadTargetJobs`). They are split into keywords the user **has** somewhere in the CV (the
rewrite may surface them) and **missing** ones, which are only shown — never written into the CV.

## Never inventing

- Imports are verbatim copies from the user's own CV.
- AI rewrites pass `acceptAssist`: no number that isn't in the original text, no technology that
  isn't in the user's CV / uploaded CVs, no first person, sane length. Dropped rewrites are counted
  and reported.
- A missing result becomes a placeholder — `[X%]`, `[N]`, `[מדד]`, `[מספר]`. The editor flags it and
  **saving is blocked** (client and server, `draftPlaceholders`) until it's replaced with the real
  number or removed.
- Employers, titles and dates are never produced by the model.

## Limits and fallback

One model call per click through `guardedLLM("cv_assist")` (daily per-user / global limits and the
prompt cache). Without AI, or over the limit, bullets get a rules X-Y-Z template with placeholders and
the tailored headline is built from the user's own title + matching skills; summary rewrites need AI.
The one-page / standard checks are unchanged and re-run on save.
