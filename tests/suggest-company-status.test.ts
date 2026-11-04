import { describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({
  candidate: null as Record<string, unknown> | null,
  user: { locale: "he" } as { locale: string } | null,
  notified: [] as { userId: string; n: Record<string, unknown> }[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    startupCandidate: { findUnique: async () => st.candidate },
    user: { findUnique: async () => st.user },
  },
}));
vi.mock("@/lib/notifications/create", () => ({
  notify: async (userId: string, n: Record<string, unknown>) => {
    st.notified.push({ userId, n });
    return { id: "n1" };
  },
}));

const { suggestionStatus, nextNightlyRun, reviewReason, suggesterId } =
  await import("@/lib/discovery/suggestion-status");
const { notifySuggestionOutcome, buildSuggestionAlert } = await import("@/lib/notifications/suggestion");

const now = new Date("2026-11-04T17:00:00Z");
const base = {
  status: "PENDING" as const,
  createdAt: new Date(now.getTime() - 10_000),
  checkedAt: null,
  checkError: null,
  careersUrl: null,
  website: "https://acme.io",
};

describe("suggestion status mapping", () => {
  it("is 'checking' right after it was saved", () => {
    expect(suggestionStatus(base, now)).toEqual({ kind: "checking" });
  });
  it("waits for the nightly run (03:30 UTC) when the instant check didn't finish", () => {
    const st = suggestionStatus({ ...base, createdAt: new Date(now.getTime() - 3_600_000) }, now);
    expect(st).toEqual({ kind: "nightly", at: new Date("2026-11-05T03:30:00Z") });
    expect(nextNightlyRun(new Date("2026-11-04T02:00:00Z"))).toEqual(new Date("2026-11-04T03:30:00Z"));
  });
  it("checked but still pending → admin review with a plain reason", () => {
    const checked = { ...base, checkedAt: now };
    expect(suggestionStatus(checked, now)).toEqual({ kind: "review", reason: "noCareersPage" });
    expect(reviewReason({ ...checked, careersUrl: "https://acme.io/careers" })).toBe("noBoard");
    expect(reviewReason({ ...checked, checkError: "no jobs: GREENHOUSE/acme" })).toBe("noIsraelJobs");
    expect(reviewReason({ ...checked, checkError: "fetch failed" })).toBe("siteError");
  });
  it("maps added / rejected / duplicate", () => {
    expect(suggestionStatus({ ...base, status: "ADDED", company: { slug: "acme", jobs: 4 } }, now)).toEqual({
      kind: "added",
      companySlug: "acme",
      jobs: 4,
    });
    expect(suggestionStatus({ ...base, status: "REJECTED" }, now)).toEqual({ kind: "rejected" });
    expect(suggestionStatus({ ...base, status: "DUPLICATE", company: { slug: "acme" } }, now)).toEqual({
      kind: "duplicate",
      companySlug: "acme",
    });
  });
  it("reads the suggester from the sourceUrl marker", () => {
    expect(suggesterId("user:u1")).toBe("u1");
    expect(suggesterId("https://techmap")).toBeNull();
    expect(suggesterId(null)).toBeNull();
  });
});

describe("suggestion notifications", () => {
  it("builds added and rejected messages, nothing while pending", () => {
    expect(buildSuggestionAlert("he", { name: "Acme", status: "ADDED", company: { slug: "acme" } })?.url).toBe(
      "/companies/acme",
    );
    expect(buildSuggestionAlert("en", { name: "Acme", status: "REJECTED" })?.title).toContain("Acme");
    expect(buildSuggestionAlert("he", { name: "Acme", status: "PENDING" })).toBeNull();
  });
  it("notifies the suggester once per outcome", async () => {
    st.notified = [];
    st.candidate = {
      id: "c1",
      name: "Acme",
      status: "ADDED",
      source: "USER",
      sourceUrl: "user:u1",
      company: { slug: "acme" },
    };
    expect(await notifySuggestionOutcome("c1")).toBe(true);
    expect(st.notified[0].userId).toBe("u1");
    expect(st.notified[0].n).toMatchObject({ kind: "COMPANY_SUGGESTION", dedupeKey: "suggestion:c1:ADDED" });
    st.candidate = { ...st.candidate, status: "REJECTED", company: null };
    await notifySuggestionOutcome("c1");
    expect(st.notified[1].n.dedupeKey).toBe("suggestion:c1:REJECTED");
  });
  it("skips non-user sources and pending candidates", async () => {
    st.notified = [];
    st.candidate = { id: "c2", name: "X", status: "ADDED", source: "TECHMAP", sourceUrl: null, company: { slug: "x" } };
    expect(await notifySuggestionOutcome("c2")).toBe(false);
    st.candidate = { id: "c3", name: "Y", status: "PENDING", source: "USER", sourceUrl: "user:u1", company: null };
    expect(await notifySuggestionOutcome("c3")).toBe(false);
    expect(st.notified).toHaveLength(0);
  });
});
