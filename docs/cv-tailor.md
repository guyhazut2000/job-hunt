# Tailored CV per job (#31)

Build a version of your CV for one specific job, side by side with your base CV, then edit it, save versions and export a PDF.

## Where

- Job page → "קו״ח מותאם למשרה" (desktop sidebar card and the mobile insights block).
- Dashboard Kanban card → "קו״ח מותאם" (`/cv/tailor?app=<applicationId>`). Manual applications without a linked job ask you to paste the posting once (saved on the version as `jobText`).
- `/profile?tab=documents` → "קורות חיים מותאמים": latest version per job, with the version count.

## How it works

1. **Base CV** (`src/lib/cv-tailor/base.ts`): the structured profile (filled from the uploaded CV and edited by you) plus skills and phone completed from the primary resume text. Nothing generated.
2. **Match summary** (`match.ts`, deterministic): tech keywords (taxonomy), years of experience, degree, English/Hebrew, each marked covered (with where it was found) or missing.
3. **Tailoring** (`server.ts → tailorCv`): one Gemini call through `guardedLLM("cv_tailor")` (daily per-user cap, DB cache). The model may only reorder, rephrase and emphasise.
4. **Never invent** (`tailor.ts → enforceFacts`), enforced in code, not just in the prompt:
   - companies, titles, dates and education always come from the base CV;
   - every original bullet appears exactly once (the model can rephrase it, not drop or add);
   - skills are a subset of the base skills (reordered only);
   - a rephrasing that introduces a technology or a number not in your CV is reverted to the original line (the page says how many);
   - empty sections stay empty.
     Gaps (missing requirements, AI ideas) go to a separate **suggestions** list, never into the CV.
5. **Offline / limits**: `LLM_PROVIDER=mock`, a hit limit or a bad answer → heuristic tailoring (relevant skills and bullets first, text unchanged), labelled "offline" / "limit reached".

## Editing and versions

- Tabs: **compare** (word diff vs the base CV, "moved up" markers), **edit** (headline, summary, bullets, skills; role names and dates are locked), **preview**.
- Saving an edit creates a new version (`source = "edited"`). Versions are linked to the job or application (`TailoredCv.jobId` / `applicationId`).
- Language: auto-detected from the posting (Hebrew letters ≥ 30%), or pick Hebrew / English. Headings and direction (RTL/LTR) follow the CV language.

## PDF

`/cv/tailor/[id]/print` is a clean A4 page; "Print / save as PDF" uses the browser's save-as-PDF (keeps Hebrew RTL text exact and costs nothing). Site chrome is hidden in print.

## Data

`TailoredCv` (additive migration `20261030140000_tailored_cv`): `content` (tailored CvDoc), `base` (snapshot of the base CV at generation time), `match`, `suggestions`, `language`, `version`, `source`.

## Tests

`tests/cv-tailor.test.ts`: language and years detection, match summary, heuristic tailoring, the no-invention rules, offline/limited/AI paths, base CV builder, word diff, schema.
