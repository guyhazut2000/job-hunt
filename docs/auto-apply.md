# Auto-apply preparation (#30)

Preparing an application is in the product. Unattended sending is not, unless a specific
employer's API key is configured and the user has opted in.

Default: the user opens a job, clicks **הכן הגשה**, reviews a draft (profile fields, documents,
flagged questions), and clicks **אשר ושלח** once per application. **Fully automatic** in
`/apply/settings` is off. When it is on, that same click sends immediately only if the rules pass
and the board has a real submission endpoint. There is no crawler that applies to new jobs.

## What each ATS actually accepts

Checked against the vendor docs (November 2026):

| Board      | Read the form                                                                                                         | Submit                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse | Public `GET /v1/boards/{token}/jobs/{id}?questions=true`. No key.                                                     | `POST` the same job requires the **employer's Job Board API key** (HTTP Basic, empty password). [Job Board API](https://developers.greenhouse.io/job-board.html).                                                                         |
| Lever      | Public postings JSON has the job, not custom questions.                                                               | `POST /v0/postings/{site}/{id}?key=` requires that site's API key, and posting without the custom questions would file an incomplete candidate. **This app never POSTs to Lever.** [Postings API](https://github.com/lever/postings-api). |
| Ashby      | Public job-board API is GET-only (the list we already ingest). The form is `jobPosting.info`, which needs `jobsRead`. | `applicationForm.submit` needs `candidatesWrite`. [Public job posting API](https://developers.ashbyhq.com/docs/public-job-posting-api), [custom careers page](https://developers.ashbyhq.com/docs/creating-a-custom-careers-page).        |

Without a key, **אשר ושלח** stores the packet on the application and opens the company's form.
It does not pretend the ATS received it. Greenhouse location is not posted: the docs ignore
`location` unless latitude and longitude are sent, and this app does not invent coordinates.
EEO and demographic answers stay on the company form (different payload shape).

`APPLY_BOARD_KEYS` is optional JSON, empty by default:

```json
{ "GREENHOUSE": { "boardToken": "<job board api key>" }, "ASHBY": { "orgSlug": "<api key>" } }
```

Keys are sent as Basic auth and are never written to logs, snapshots, or prompts. Posts are not
retried (a retry can create a second candidate). Hosts are paced at one submit every two seconds.

LinkedIn URLs and `mailto:` links are never fetched. Nothing is emailed on the user's behalf.

## Rules

`/apply/settings`, stored on `ApplySettings` (missing row = these defaults):

- Minimum match score **70** (0–100). One application can override a low or missing score.
- Blocked companies, by exact company name.
- Daily cap **5** approvals (API sends and handoffs) per Asia/Jerusalem day. `0` pauses approval.
- Fully automatic **off**.

A blocked company and the daily cap cannot be overridden.

## Drafts and the tracker

`ApplyDraft` is one row per user and job. The manual queue (`/apply`, tracker hub) holds jobs
this flow cannot post (other ATS boards, career pages, LinkedIn, email) with the direct link and
a status.

On approve, the application row gets `sentSnapshot` (field labels and values, plus the document
list — never file bytes), `applyDelivery` (`HANDOFF`, `API`, or `MANUAL`), and `applyRecordedAt`.
`API` also moves a `SAVED` application to `APPLIED` and sets `appliedAt`. A handoff stays `SAVED`
so the tracker does not count a company-site visit as a sent application. The queue shows it as
"נשמר · להשלמה באתר".

Documents go through `getAttachableDocuments` and `<DocumentPicker>` (`sanitizeSelection` on save).
An API post that includes a profile CV calls `requireCvStandard` first.

## Answers

Screening questions the profile does not answer go through `guardedLLM("apply_answers")` (cached,
rate-limited). The prompt has the job title, company, and profile facts (skills, salary band,
availability). It does not include email-account tokens or anything `looksLikeSecret` matches.
Visa, citizenship, and demographic questions are not sent to the model. Low confidence stays
flagged. If the model is mock, limited, or errors, those questions are left blank and flagged.

## Code

`src/lib/auto-apply/` (pure rules, mapping, and queue logic are covered by `tests/auto-apply.test.ts`).
Pages: `/jobs/[id]/apply`, `/apply`, `/apply/settings`.
