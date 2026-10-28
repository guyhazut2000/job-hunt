# Documents (`/documents`)

Users keep application documents next to their CVs: transcripts, degree certificates,
certifications, recommendation letters, portfolios, cover letters and anything else. The future
apply flow attaches them through one server helper and one picker component.

## Data model

`Document` (Prisma, `prisma/migrations/20261028100000_documents`, additive only):

| field                                                         | notes                                                                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                                        | `DocumentType` enum: `CV TRANSCRIPT DEGREE CERTIFICATION RECOMMENDATION_LETTER PORTFOLIO COVER_LETTER OTHER`. `CV` is reserved for the unified view (CVs still live in `Resume`/`ResumeFile`). |
| `title, issuer, issueDate, expiryDate, language, tags, notes` | editable metadata                                                                                                                                                                              |
| `skills`                                                      | learning-graph node ids a certification proves (added to the profile on save)                                                                                                                  |
| `fileName, mimeType, sizeBytes, sha256`                       | `mimeType` is the **sniffed** type, never the browser's claim                                                                                                                                  |
| `storageKey`                                                  | `documents/<userId>/<uuid>.<ext>` in private storage                                                                                                                                           |
| `version`                                                     | bumps on "replace file"                                                                                                                                                                        |
| `isDefault`                                                   | one default per (user, type); preselected by the picker                                                                                                                                        |
| `uploadedAt`                                                  | when the current file version was uploaded (rate limit)                                                                                                                                        |

CVs are unchanged: upload/parse/review keep working through `/profile?tab=cvs`. `/documents` shows
them read-only as a CV group.

## Storage

- **Production / previews:** a private Vercel Blob store (`job-hunt-documents`, fra1). Env var:
  `BLOB_READ_WRITE_TOKEN` (set automatically by the store's project connection). Preview
  deployments share the store.
- **Development:** without that token and outside production, files go to `.data/documents/`
  (gitignored) through the dev-only route `/api/documents/local-upload`.
- **Production without a token:** uploads are disabled with a message; nothing else breaks.

## Upload flow

1. Browser prechecks name/extension/size (`precheckUpload`).
2. Browser uploads directly to Blob (`@vercel/blob/client` `upload`, `access: "private"`) to a
   key under its own prefix. `/api/documents/upload` issues the client token only after checking
   the session, that the key is under `documents/<userId>/`, quota, document count and a rate
   limit; the token allows only PDF/DOCX/PNG/JPEG, at most 10MB, valid 10 minutes, no overwrite.
   (Direct upload is required because function request bodies cap at 4.5MB.)
3. Browser calls the `finalizeDocument` server action. It re-checks key ownership, **reads the
   stored bytes from storage**, verifies magic bytes against the extension (`verifyBytes`),
   re-checks quota and the hourly upload limit (30/h, from `uploadedAt`), computes sha256 and
   creates the row. Any failure deletes the uploaded object.
4. Replace = same flow with `replaceId`; the row keeps its id/metadata, `version` + 1, and the old
   object is deleted.

Limits (`src/lib/documents/constants.ts`): 10MB per file, 100MB per user, 200 documents, 30
uploads/hour (+ 20 upload tokens per 10 minutes per instance).

## Access

Files are never public. `/api/documents/[id]/file?exp&sig[&download=1]` requires the session,
an owned document, and an HMAC token (`AUTH_SECRET`) binding document, user and expiry (10 min).
Signed URLs are created on demand by the `documentFileUrl` action. Responses are `private,
no-store`, `nosniff`, same-origin framing; DOCX always downloads, PDFs/images preview inline. File
contents are never logged.

## For the apply feature

### `getAttachableDocuments(userId, types?)` — `src/lib/documents/server.ts`

Returns `AttachableDocument[]` (no bytes, no storage keys), CVs first then documents:

```ts
{ ref: "doc:<id>" | "cv:<resumeId>", id, source: "document" | "resume", type, title,
  fileName, mimeType, sizeBytes, isDefault, expired, createdAt }
```

```ts
const docs = await getAttachableDocuments(user.id, ["CV", "TRANSCRIPT", "CERTIFICATION"]);
```

### `<DocumentPicker>` — `src/components/documents/DocumentPicker.tsx`

```tsx
<DocumentPicker
  t={documentStrings(locale)}
  docs={docs}
  rules={{ maxPerType: { CV: 1, TRANSCRIPT: 1 }, maxTotal: 5, maxTotalBytes: 20 * 1024 * 1024 }}
  name="documents" // one hidden input per selected ref when inside a <form>
/>
```

- Preselects the default (else newest) non-expired document for single-choice types.
- Types with `maxPerType: 1` behave like radios (picking another swaps); other limits show an error.
- Controlled (`value`/`onChange`) or uncontrolled.

On submit, **always** re-validate on the server:

```ts
const refs = sanitizeSelection(
  formData.getAll("documents").map(String),
  await getAttachableDocuments(user.id, types),
  rules,
);
```

To read a file server-side (e.g. to attach it to an email): `doc:` → `readObject(storageKey, MAX_DOCUMENT_BYTES)`
from `src/lib/documents/storage.ts` after a `{ id, userId }` lookup; `cv:` → `ResumeFile.data`.

## Certifications and skills

On a `CERTIFICATION`, the edit sheet offers learning-graph skills. Saving adds the ones missing from
the profile (`addCertifiedSkills`, level BASIC); it never removes skills.

## Known gaps

- An upload that is never finalized (tab closed between upload and finalize) leaves an orphan
  object under the user's prefix. It is not counted in quota and is not reachable. A periodic
  sweep (list `documents/` and delete keys with no row, older than a day) can be added later.
- No virus scanning; only magic-byte type checks.
