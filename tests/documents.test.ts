import { beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_RE, MAX_DOCUMENT_BYTES, USER_QUOTA_BYTES, keyPrefix } from "@/lib/documents/constants";
import { filterDocuments } from "@/lib/documents/filter";
import { defaultSelection, sanitizeSelection, toggleSelection, type AttachableDocument } from "@/lib/documents/picker";
import { signFileToken, verifyFileToken } from "@/lib/documents/signing";
import { takeToken } from "@/lib/documents/rate-limit";
import {
  checkQuota,
  contentDisposition,
  expiryStatus,
  metadataSchema,
  ownsKey,
  precheckUpload,
  sniffMime,
  titleFromFileName,
  verifyBytes,
} from "@/lib/documents/validate";

// ---------- fixtures ----------
const pdf = () => new Uint8Array(Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj<<>>endobj\n%%EOF"));
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
const docx = () => new Uint8Array(Buffer.from("PK\x03\x04....[Content_Types].xml....word/document.xml...", "latin1"));
const xlsx = () => new Uint8Array(Buffer.from("PK\x03\x04....[Content_Types].xml....xl/workbook.xml...", "latin1"));
const exe = () => new Uint8Array(Buffer.from("MZ\x90\x00\x03", "latin1"));

const USER = "cluser0000000000000001";
const OTHER = "cluser0000000000000002";
const key = (u = USER, ext = "pdf") => `${keyPrefix(u)}123e4567-e89b-42d3-a456-426614174000.${ext}`;

describe("magic-byte validation", () => {
  it("sniffs the allowed types", () => {
    expect(sniffMime(pdf())).toBe("application/pdf");
    expect(sniffMime(png())).toBe("image/png");
    expect(sniffMime(jpg())).toBe("image/jpeg");
    expect(sniffMime(docx())).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
  it("rejects other zips and executables", () => {
    expect(sniffMime(xlsx())).toBeNull();
    expect(sniffMime(exe())).toBeNull();
    expect(sniffMime(new Uint8Array())).toBeNull();
  });
  it("requires content to match the extension", () => {
    expect(verifyBytes("cv.pdf", pdf())).toEqual({ ok: true, mime: "application/pdf" });
    expect(verifyBytes("photo.JPEG", jpg())).toEqual({ ok: true, mime: "image/jpeg" });
    expect(verifyBytes("evil.pdf", exe())).toEqual({ ok: false, error: "badType" });
    expect(verifyBytes("renamed.png", pdf())).toEqual({ ok: false, error: "mismatch" });
    expect(verifyBytes("empty.pdf", new Uint8Array())).toEqual({ ok: false, error: "noFile" });
  });
  it("rejects files over 10MB", () => {
    const big = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    big.set(pdf());
    expect(verifyBytes("big.pdf", big)).toEqual({ ok: false, error: "tooLarge" });
  });
  it("prechecks name, size and declared type before uploading", () => {
    expect(precheckUpload({ name: "a.pdf", size: 1000, type: "application/pdf" })).toBeNull();
    expect(precheckUpload({ name: "a.exe", size: 1000 })).toBe("badType");
    expect(precheckUpload({ name: "a.pdf", size: 0 })).toBe("noFile");
    expect(precheckUpload({ name: "a.pdf", size: MAX_DOCUMENT_BYTES + 1 })).toBe("tooLarge");
  });
});

describe("ownership of storage keys", () => {
  it("accepts only well-formed keys under the caller's prefix", () => {
    expect(ownsKey(USER, key())).toBe(true);
    expect(ownsKey(USER, key(OTHER))).toBe(false);
    expect(ownsKey(USER, `${keyPrefix(USER)}../${OTHER}/x.pdf`)).toBe(false);
    expect(ownsKey(USER, `${keyPrefix(USER)}123e4567-e89b-42d3-a456-426614174000.exe`)).toBe(false);
    expect(KEY_RE.test("documents/abc/x.pdf")).toBe(false);
  });
});

describe("quota and rate limits", () => {
  const base = { usedBytes: 0, count: 0, recentUploads: 0 };
  it("enforces the 100MB per-user quota", () => {
    expect(checkQuota(base, 5_000_000)).toBeNull();
    expect(checkQuota({ ...base, usedBytes: USER_QUOTA_BYTES - 10 }, 11)).toBe("quota");
  });
  it("credits the replaced version's bytes", () => {
    expect(checkQuota({ ...base, usedBytes: USER_QUOTA_BYTES - 10, count: 3 }, 100, 200)).toBeNull();
  });
  it("rate-limits uploads per hour and caps document count", () => {
    expect(checkQuota({ ...base, recentUploads: 30 }, 1, 0, 30)).toBe("rateLimited");
    expect(checkQuota({ ...base, count: 200 }, 1)).toBe("tooMany");
    expect(checkQuota({ ...base, count: 200 }, 1, 50)).toBeNull();
  });
  it("in-memory token limiter slides", () => {
    const k = `t-${Math.random()}`;
    expect(takeToken(k, 2, 1000, 0)).toBe(true);
    expect(takeToken(k, 2, 1000, 10)).toBe(true);
    expect(takeToken(k, 2, 1000, 20)).toBe(false);
    expect(takeToken(k, 2, 1000, 1500)).toBe(true);
  });
});

describe("signed file URLs", () => {
  const secret = "test-secret";
  it("verifies for the same doc, user and before expiry only", () => {
    const now = 1_800_000_000_000;
    const { exp, sig } = signFileToken("doc1", USER, now, 600, secret);
    expect(verifyFileToken("doc1", USER, exp, sig, now + 1000, secret)).toBe(true);
    expect(verifyFileToken("doc1", OTHER, exp, sig, now, secret)).toBe(false);
    expect(verifyFileToken("doc2", USER, exp, sig, now, secret)).toBe(false);
    expect(verifyFileToken("doc1", USER, exp, sig, now + 601_000, secret)).toBe(false);
    expect(verifyFileToken("doc1", USER, exp + 60, sig, now, secret)).toBe(false);
    expect(verifyFileToken("doc1", USER, exp, "x", now, secret)).toBe(false);
  });
});

describe("metadata", () => {
  it("parses and normalizes", () => {
    const r = metadataSchema.parse({
      type: "CERTIFICATION",
      title: "  AWS SAA ",
      issueDate: "2025-01-10",
      expiryDate: "2028-01-10",
      language: "",
      tags: "aws, cloud,, aws",
    });
    expect(r.title).toBe("AWS SAA");
    expect(r.language).toBeNull();
    expect(r.tags).toEqual(["aws", "cloud"]);
    expect(r.issueDate?.toISOString().slice(0, 10)).toBe("2025-01-10");
  });
  it("rejects CV type, bad dates and expiry before issue", () => {
    expect(metadataSchema.safeParse({ type: "CV", title: "x" }).success).toBe(false);
    expect(metadataSchema.safeParse({ type: "OTHER", title: "x", issueDate: "10/01/2025" }).success).toBe(false);
    const r = metadataSchema.safeParse({
      type: "DEGREE",
      title: "x",
      issueDate: "2025-01-10",
      expiryDate: "2024-01-10",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("expiryBeforeIssue");
  });
  it("expiry status", () => {
    const now = new Date("2026-10-28T00:00:00Z");
    expect(expiryStatus(null, now)).toBe("none");
    expect(expiryStatus(new Date("2026-10-01"), now)).toBe("expired");
    expect(expiryStatus(new Date("2026-11-15"), now)).toBe("soon");
    expect(expiryStatus(new Date("2027-11-15"), now)).toBe("valid");
  });
  it("titles and headers", () => {
    expect(titleFromFileName("BSc_transcript-2024.pdf")).toBe("BSc transcript 2024");
    expect(contentDisposition("inline", 'גיליון "ציונים".pdf')).toMatch(
      /^inline; filename="[^"]*"; filename\*=UTF-8''/,
    );
  });
});

describe("list filter", () => {
  const row = (o: Partial<Parameters<typeof filterDocuments>[0][number]>) => ({
    type: "OTHER" as const,
    title: "t",
    issuer: null,
    fileName: "f.pdf",
    notes: null,
    tags: [],
    expiry: "none" as const,
    ...o,
  });
  it("filters by text, type and expiry", () => {
    const docs = [
      row({ title: "Transcript BSc", type: "TRANSCRIPT" }),
      row({ title: "AWS", type: "CERTIFICATION", expiry: "expired", tags: ["cloud"] }),
      row({ title: "CKA", type: "CERTIFICATION", issuer: "Linux Foundation", expiry: "soon" }),
    ];
    expect(filterDocuments(docs, "cloud", "all", "all").map((d) => d.title)).toEqual(["AWS"]);
    expect(filterDocuments(docs, "linux", "all", "all").map((d) => d.title)).toEqual(["CKA"]);
    expect(filterDocuments(docs, "", "CERTIFICATION", "soon").map((d) => d.title)).toEqual(["CKA"]);
    expect(filterDocuments(docs, "", "TRANSCRIPT", "all")).toHaveLength(1);
  });
});

describe("picker logic", () => {
  const d = (
    ref: string,
    type: AttachableDocument["type"],
    o: Partial<AttachableDocument> = {},
  ): AttachableDocument => ({
    ref,
    id: ref.split(":")[1]!,
    source: ref.startsWith("cv:") ? "resume" : "document",
    type,
    title: ref,
    fileName: `${ref}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 1000,
    isDefault: false,
    expired: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...o,
  });
  const docs = [
    d("cv:a", "CV", { isDefault: true }),
    d("cv:b", "CV", { createdAt: "2026-05-01T00:00:00Z" }),
    d("doc:t1", "TRANSCRIPT", { createdAt: "2026-03-01T00:00:00Z" }),
    d("doc:t2", "TRANSCRIPT", { createdAt: "2026-04-01T00:00:00Z" }),
    d("doc:c1", "CERTIFICATION", { isDefault: true, expired: true }),
    d("doc:c2", "CERTIFICATION"),
  ];
  const rules = { maxPerType: { CV: 1, TRANSCRIPT: 1 }, maxTotal: 3 } as const;

  it("preselects defaults, else newest for single types, never expired", () => {
    expect(defaultSelection(docs, rules).sort()).toEqual(["cv:a", "doc:t2"]);
    expect(defaultSelection(docs, { types: ["CERTIFICATION"] })).toEqual([]);
  });
  it("swaps within a single-choice type", () => {
    expect(toggleSelection(["cv:a"], "cv:b", docs, rules).selected).toEqual(["cv:b"]);
  });
  it("unselects", () => {
    expect(toggleSelection(["cv:a", "doc:t1"], "cv:a", docs, rules).selected).toEqual(["doc:t1"]);
  });
  it("enforces total count and size", () => {
    expect(toggleSelection(["cv:a", "doc:t1", "doc:c2"], "doc:c1", docs, rules).error).toBe("maxTotal");
    expect(toggleSelection(["cv:a"], "doc:c2", docs, { maxTotalBytes: 1500 }).error).toBe("maxBytes");
  });
  it("sanitizes submitted selections server-side", () => {
    expect(sanitizeSelection(["cv:a", "cv:b", "doc:zzz", "doc:t1", "doc:t1"], docs, rules)).toEqual(["cv:b", "doc:t1"]);
    expect(sanitizeSelection(["doc:t1", "cv:a"], docs, { ...rules, types: ["CV"] })).toEqual(["cv:a"]);
  });
});

// ---------- server actions: ownership ----------
const store = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(),
  docs: [] as Array<Record<string, unknown>>,
  deleted: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn(async () => ({ id: USER })) }));
vi.mock("@/lib/learning/graph", () => ({
  GRAPH: { byId: new Map(), nodes: [] },
  learnedSkillItem: vi.fn(),
  resolveSkill: vi.fn(),
}));
vi.mock("@/lib/documents/storage", () => ({
  readObject: vi.fn(async (k: string) => store.objects.get(k) ?? null),
  deleteObject: vi.fn(async (k: string) => {
    store.deleted.push(k);
    store.objects.delete(k);
  }),
}));
vi.mock("@/lib/db", () => {
  const match = (d: Record<string, unknown>, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "gte" in (v as object) ? true : d[k] === v));
  const document = {
    findUnique: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) => store.docs.find((d) => match(d, where)) ?? null,
    ),
    findFirst: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) => store.docs.find((d) => match(d, where)) ?? null,
    ),
    count: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) => store.docs.filter((d) => match(d, where)).length,
    ),
    aggregate: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const rows = store.docs.filter((d) => match(d, where));
      return { _sum: { sizeBytes: rows.reduce((s, d) => s + (d.sizeBytes as number), 0) }, _count: rows.length };
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `doc${store.docs.length + 1}`, version: 1, ...data };
      store.docs.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = store.docs.find((d) => d.id === where.id)!;
      Object.assign(row, data, data.version ? { version: (row.version as number) + 1 } : {});
      return row;
    }),
    updateMany: vi.fn(async () => ({ count: 0 })),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.docs = store.docs.filter((d) => d.id !== where.id);
    }),
  };
  return { db: { document, $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)) } };
});

describe("document actions (ownership, verification, quota)", () => {
  beforeEach(() => {
    store.objects.clear();
    store.docs = [];
    store.deleted = [];
  });

  it("finalizes the caller's own upload after verifying stored bytes", async () => {
    const { finalizeDocument } = await import("@/app/documents/actions");
    store.objects.set(key(), Buffer.from(pdf()));
    const res = await finalizeDocument({ key: key(), fileName: "My Transcript.pdf", type: "TRANSCRIPT" });
    expect(res).toEqual({ ok: true, id: "doc1" });
    expect(store.docs[0]).toMatchObject({
      userId: USER,
      type: "TRANSCRIPT",
      isDefault: true,
      mimeType: "application/pdf",
    });
    expect(store.docs[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses another user's storage key", async () => {
    const { finalizeDocument } = await import("@/app/documents/actions");
    store.objects.set(key(OTHER), Buffer.from(pdf()));
    expect(await finalizeDocument({ key: key(OTHER), fileName: "x.pdf", type: "OTHER" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(store.docs).toHaveLength(0);
    expect(store.objects.has(key(OTHER))).toBe(true); // never touches someone else's object
  });

  it("deletes the object when the bytes are not what they claim", async () => {
    const { finalizeDocument } = await import("@/app/documents/actions");
    store.objects.set(key(), Buffer.from(exe()));
    expect(await finalizeDocument({ key: key(), fileName: "x.pdf", type: "OTHER" })).toEqual({
      ok: false,
      error: "badType",
    });
    expect(store.deleted).toContain(key());
  });

  it("rejects uploads over quota and cleans up", async () => {
    const { finalizeDocument } = await import("@/app/documents/actions");
    store.docs.push({ id: "old", userId: USER, type: "OTHER", sizeBytes: USER_QUOTA_BYTES - 5, storageKey: "k" });
    store.objects.set(key(), Buffer.from(pdf()));
    expect(await finalizeDocument({ key: key(), fileName: "x.pdf", type: "OTHER" })).toEqual({
      ok: false,
      error: "quota",
    });
    expect(store.deleted).toContain(key());
  });

  it("can't replace, delete or sign URLs for someone else's document", async () => {
    const { finalizeDocument, deleteDocument, documentFileUrl, setDefaultDocument } =
      await import("@/app/documents/actions");
    store.docs.push({ id: "theirs", userId: OTHER, type: "OTHER", sizeBytes: 10, storageKey: key(OTHER) });
    store.objects.set(key(), Buffer.from(pdf()));
    expect(await finalizeDocument({ key: key(), fileName: "x.pdf", replaceId: "theirs" })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await deleteDocument("theirs")).toEqual({ ok: false });
    expect(await setDefaultDocument("theirs")).toEqual({ ok: false });
    expect(await documentFileUrl("theirs")).toBeNull();
    expect(store.docs.map((d) => d.id)).toEqual(["theirs"]);
  });

  it("replaces a file: new version, old object deleted", async () => {
    const { finalizeDocument } = await import("@/app/documents/actions");
    store.docs.push({
      id: "mine",
      userId: USER,
      type: "DEGREE",
      sizeBytes: 10,
      version: 1,
      storageKey: "documents/old.pdf",
    });
    store.objects.set(key(USER, "png"), Buffer.from(png()));
    const res = await finalizeDocument({ key: key(USER, "png"), fileName: "scan.png", replaceId: "mine" });
    expect(res).toEqual({ ok: true, id: "mine" });
    expect(store.docs[0]).toMatchObject({ version: 2, mimeType: "image/png", storageKey: key(USER, "png") });
    expect(store.deleted).toEqual(["documents/old.pdf"]);
  });
});
