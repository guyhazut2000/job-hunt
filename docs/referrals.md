# חבר מביא חבר (Referrals) — #92

Route: `/referrals` (header "עוד" menu and mobile nav, signed-in only).

## What it does

- **Insider contacts**: people you know who work at a company. Add one by hand (name, company, title,
  how you know them, optional LinkedIn profile URL / email, notes — voice input on the free-text fields),
  or **import a CSV**: file or paste, `,` or `;`, Hebrew or English headers
  (`שם`/`name`, `שם פרטי`+`שם משפחה`/`First Name`+`Last Name`, `חברה`/`company`, `תפקיד`/`position`, `היכרות`/`relationship`, …).
  LinkedIn's own **Connections.csv export** works as-is (its "Notes:" lines before the header are skipped).
  Max 500 rows / 512 KB; rows without a name or company are skipped and counted; duplicates (name + company) merge.
  Company names are matched to the catalog conservatively (score ≥ 0.85); unmatched ones still work by name.
- **"יש לך מכר בפנים"**: a badge on job cards (`/jobs`) and a section on the company page, linking to the contact
  with that job pre-selected.
- **Request draft**: pick the job (your applications first, then open jobs at that company), Hebrew or English,
  "ניסוח" → `guardedLLM("referral_request")` with a He/En template fallback (also when the daily AI limit hits).
  The draft is editable; **copy only** — then "שלחתי, סמן כ'ביקשתי'" creates the referral.
  The job link in the draft is the posting's `applyUrl` only when it's https and not LinkedIn.
- **Tracker**: statuses ביקשתי → הסכים → הוגש דרכו → תשובה (or לא מתאים), answer (חיובית / שלילית),
  linked to an application (change it any time), a note, dates. Stats at the top.
- **Follow-ups**: see `docs/notifications.md` → "Referral follow-ups". A due row shows a banner with "הזכרתי".
- **/outreach**: a contact that accepted / replied / referred gets "הוספה כמכר להפניה" — it becomes an insider
  contact without a duplicate. Referral-only contacts (imported, never messaged) don't show in the outreach
  tracker, the dashboard or "People at the company".

## Hard limits (by design)

- Nothing is sent: no LinkedIn messages, no email. The app drafts text; you copy and send yourself.
- No LinkedIn fetching or scraping — the profile URL is just a stored outbound link (`linkedin.com/in/…` only),
  shown as "מקור חיצוני · לא מאומת". The CSV is a file **you** exported.

## Code

- `src/lib/referrals/csv.ts` (CSV parsing), `followup.ts` (timing), `message.ts` (templates, AI prompt + validation),
  `server.ts` (company matching, insiders by company, facts, AI call).
- `src/app/referrals/page.tsx`, `actions.ts`; UI in `src/components/referrals/`; strings in `src/lib/i18n/referrals.ts`.
- `src/lib/notifications/referrals.ts` (cron), wired in `src/lib/notifications/run.ts`.
- Migration `20261103230500_referrals` (additive): `Contact.insider/companyName/email/relationship`,
  enum `ReferralStatus`, table `Referral`.
- Tests: `tests/referrals.test.ts`.

## Known gaps

- Company matching is name-based; a contact at a company that isn't in the catalog only matches jobs by exact-ish name.
- No automatic detection of a referral result from email — update the status yourself.
