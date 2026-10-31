# CV templates (`/cv`, `/cv/templates/[id]`, `/api/cv/export`)

Five designs that render **the profile** (or a tailored CV from `/cv/tailor`) as PDF or DOCX, in
Hebrew or English. Refs #78.

## Single source of truth

- **Content** comes only from `/profile` (`contentFromProfile`) — or from a tailored CV
  (`contentFromTailored`, which overrides headline/summary/experience/skills/education/languages and keeps
  the profile's other sections). Templates never store or invent content.
- **A template** controls only layout, section order, visibility and section headings.
  Saved per user per template in `CvLayout` (`sections` JSON, validated by `layoutSchema`).
  `Profile.cvTemplate` is the user's default pick.
- Missing profile fields (projects, volunteering, custom sections, phone) were added to `/profile` in #80.

## Code map (`src/lib/cv-templates/`)

| File                           | What                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `templates.ts`                 | Design tokens for the 5 templates + `recommendTemplate(role, seniority…)`                                                          |
| `sections.ts`                  | Built-in section ids, layout schema, `normalizeLayout` (merges saved order with defaults and current custom sections), `moveEntry` |
| `content.ts`                   | `CvContent` + builders from profile / tailored CV, demo content                                                                    |
| `resolve.ts`                   | Content + layout + template → ordered blocks (shared by every renderer)                                                            |
| `bidi.ts`                      | Direction per paragraph, script runs for DOCX, LTR-safe dates, short URLs                                                          |
| `pdf.tsx`                      | `@react-pdf/renderer` document                                                                                                     |
| `docx.ts`                      | `docx` document: `bidirectional` paragraphs, `rightToLeft` runs per script, embedded font                                          |
| `translate.ts`                 | Optional translation through `guardedLLM("cv_translate")`                                                                          |
| `fonts/`                       | IBM Plex Sans Hebrew + David Libre (SIL OFL 1.1, licence files alongside)                                                          |
| `src/lib/i18n/cv-templates.ts` | Fixed section labels (he/en per template), gallery/editor strings, "מתאים ל:" lines                                                |

The HTML preview (`src/components/cv-templates/CvPreview.tsx`) mirrors `pdf.tsx` from the same tokens and
`resolveBlocks`, using the same fonts via `next/font/local`.

## Export

`GET /api/cv/export?template=<id>&lang=he|en&format=pdf|docx[&tailored=<id>][&demo=1]` — signed-in owner
only, `runtime = "nodejs"`, `maxDuration = 60`. Header `X-Cv-Translation` reports what happened.

- `next.config.ts`: `serverExternalPackages: ["@react-pdf/renderer"]` and
  `outputFileTracingIncludes` for the fonts (read from `process.cwd()/src/lib/cv-templates/fonts`).
- Sizes: a typical one-page CV is ~40–120 KB PDF (subset font) and ~150–250 KB DOCX (embedded font);
  smoke tests cap PDF < 1.5 MB, DOCX < 2 MB — far below the 4.5 MB Vercel response limit.
- Bidi: in a Hebrew CV a paragraph with any Hebrew is RTL, pure-Latin lines (emails, URLs, English
  titles) are LTR; dates are rendered LTR (`03/2022 – היום`); in DOCX every run carries `rightToLeft`
  according to its script, so Word/LibreOffice order mixed text correctly.

## Translation

When the export language differs from the detected content language, `translateContent` sends only
the strings that need it (`needsTranslation`) in one call: Gemini free tier via `guardedLLM`
(30-day cache, 15/day per user), schema `{ items: string[] }`. Each item is checked by
`acceptTranslation` (numbers, emails and URLs preserved, sane length) or the original is kept.
Without a key / over the limit the file still downloads, with fixed labels in the target language and the
content as written. Fixed labels never go through the LLM.

## Tests

`tests/cv-templates-*.test.ts`: ordering/normalization, bidi, translation guards (LLM mocked),
recommendation, tailored content, and PDF/DOCX smoke renders for all 5 × 2. Set `CV_SAMPLES_DIR=/tmp/x`
to write the sample files (`npx vitest run tests/cv-templates-render.test.ts`).
