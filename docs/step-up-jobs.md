# Step-up jobs — "משרות שדרוג" (#85)

Route: **`/jobs/step-up`** (signed in). Linked from `/jobs` ("משרות שדרוג").

Jobs that are **one step above** the user's current role, each with a gap analysis and an
"apply anyway?" verdict. Everything is deterministic and labelled as a rule of thumb in the UI.

## Where you stand (`currentPosition`)

- **Role:** a manual override (`?role=`), else the first target role, else the role inferred from
  the newest experience title, else `fullstack`.
- **Level:** a manual override (`?level=`), else years of experience (`inferSeniorityFromYears`,
  bumped up when the newest title is already senior/lead), else `Profile.seniority`, else `MID`.
  Target seniorities are where the user _wants_ to go, so they aren't used as the current level.
- The header shows where each value came from, plus chips to correct it (a URL param, nothing is saved).

## Career ladder and role graph (`src/lib/career/ladder.ts`)

Curated by hand, not mined from data:

- **Rungs:** Junior → Mid → Senior → Lead (tech lead / Staff) → Manager.
- **Broader roles (`ROLE_UP`):**
  - frontend → fullstack
  - backend → fullstack or devops/platform
  - mobile → fullstack
  - qa → devops or backend
  - data → ml
  - design → product
- **Moves (`stepUpMove`):**
  - `level`: same track, exactly one rung up.
  - `broaden`: a broader role at the same rung or one up.
  - `technical`: at Senior or above, Staff / Principal / Architect / Platform titles on the same or a broader track.
  - People management (MANAGER) counts only for people already at Lead.
  - Two-rung jumps and step-downs are never step-ups.

## Seniority detection (`detectJobLevel`)

The title-derived `Job.seniority` is used first. When the title is neutral (Mid with no level word),
the smallest years number the description asks for decides instead:

| Years asked | Level  |
| ----------- | ------ |
| ≥ 8         | Lead   |
| ≥ 5         | Senior |
| ≤ 1         | Junior |

The card then says the level came "from the requirements". Years are parsed with the existing
`requiredYears` from `cv-tailor`. Leadership asks (mentoring, leading a team, "הובלת צוות") are
detected too.

## Gap analysis (`gapFor`)

| Gap                                                                | Points                 |
| ------------------------------------------------------------------ | ---------------------- |
| Each tech in the posting that isn't in the profile                 | 1 (at most 4 in total) |
| Years short of the ask                                             | 1, or 2 if ≥ 2 years   |
| Leadership asked, but none in the profile's titles or descriptions | 1                      |

The total points give the verdict:

- 0–2: **"כדאי להגיש בכל זאת"** (worth applying anyway). Ads are wish lists.
- 3–4: a stretch.
- 5 or more: a big gap for now.

Results are sorted by verdict, then points, then the profile match score, then the newest.

## Data and cost

- No migration and no LLM calls.
- One indexed query (`roleCategory` × `seniority`, up to 600 rows), then pure scoring.
- At most 40 cards are shown, with tabs per move kind and a "small gaps only" filter.

## Tests

`tests/step-up.test.ts` covers the position, the moves, detection, gaps and ordering.
