# Bilingual search (Hebrew ↔ English)

Typing a company, city, role or technology in either language finds the same results:
`אינטל` = `Intel`, `חיפה` = `Haifa`, `ריאקט` = `React`. It also fixes text typed on the wrong
keyboard layout (`thbyk` → `אינטל` → Intel, `ןמאקך` → `intel`).

Applies everywhere search runs: `/jobs` (list + map), `/companies`, the chatbot (`searchJobs`,
`findCompany`), saved-search notifications, the search-box autocomplete and the company picker.

## How a query is parsed (`src/lib/search/query.ts`)

1. **Normalize** (`text.ts`): lower-case, strip niqqud/diacritics, unify geresh/gershayim/curly
   quotes and maqaf, collapse spaces. Final letters are folded for keys (`ם` → `מ`).
2. **Split** into terms (quoted phrases stay one term). Terms are ANDed; the variants of a term are ORed.
3. For each run of words, longest first (up to 5 words), look up:
   - **company lexicon** — exact name/alias, then the keyboard-layout swap, then a phonetic
     (transliteration) key for companies with no Hebrew name;
   - **glossary** (`glossary.ts`) — ~110 bilingual groups of roles, levels, work modes, cities and tech.
     A one-letter Hebrew prefix (ב/ה/ו/ל/מ/ש/כ) is stripped when the rest is a known word (`באינטל`).
4. Each term carries `variants`, the matched `companyIds`, and `also` labels for the
   "מציג גם תוצאות עבור …" hint.

Common Hebrew words (`common-hebrew-words.ts`) never become company/phonetic matches, and very
short or generic Hebrew aliases (`AMBIGUOUS_HE` in `lexicon.ts`: כלל, טבע, לאומי…) are not used as
text variants (they still resolve the company by id).

## Where company names come from

- `Company.nameHe`, `Company.aliases`, `Company.aliasesSource` (migration
  `20261030170000_company_aliases`, additive; it fills rows only where `nameHe IS NULL`).
- `company-names.ts` — curated Hebrew names and aliases (~246 companies).
- `company-names.generated.ts` — a one-time Gemini batch for the rest (559 names), reviewed and
  stored; nothing calls Gemini at runtime.

`lexicon-server.ts` builds the lexicon from the DB (+ the maps) and caches it for 5 minutes.
Client components must not import `lexicon.ts` (it pulls the big maps); they get `nameHe`/keywords
from the server (SearchBox suggestions, CompanyPicker options).

## Adding a company name

Edit the company row (`nameHe`, `aliases`) or add it to `company-names.ts`. Then run
`npx vitest run tests/bilingual-search.test.ts`.

## Known asymmetries

- `heOnly` glossary words widen only the Hebrew side (`מפתח` also finds "engineer"; "developer" does not find "מהנדס").
- A Hebrew alias shared by several companies (Oracle / Oracle Israel) matches all of them.
- Ambiguous Hebrew aliases are resolved by id only, not as free text.
