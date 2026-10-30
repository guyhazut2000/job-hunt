import { beforeEach, describe, expect, it, vi } from "vitest";

// ── in-memory db (just enough of Prisma for the email auto-apply paths) ──
type Row = Record<string, unknown> & { id: string };
const store = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  seq: 0,
  notified: [] as { userId: string; n: Record<string, unknown> }[],
}));

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = row[k];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(v);
      if ("gte" in c) return (v as number | Date) >= (c.gte as number | Date);
      if ("gt" in c) return (v as number | Date) > (c.gt as number | Date);
      if ("startsWith" in c) return typeof v === "string" && v.startsWith(c.startsWith as string);
      return false;
    }
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    return (v ?? null) === (cond ?? null);
  });
}

vi.mock("@/lib/db", () => {
  const T = (name: string) => (store.tables[name] ??= []);
  const unique: Record<string, (r: Row) => string | null> = {
    emailCandidate: (r) => `${r.userId}|${r.provider}|${r.messageId}`,
    application: (r) => (r.jobId ? `${r.userId}|${r.jobId}` : null),
    applicationStatusChange: (r) => (r.emailCandidateId ? String(r.emailCandidateId) : null),
  };
  const defaults: Record<string, Record<string, unknown>> = {
    application: { status: "SAVED", jobId: null, statusChangedAt: null, appliedAt: null },
    applicationStatusChange: { undoneAt: null, emailCandidateId: null, emailDate: null },
  };
  const sortBy = (rows: Row[], orderBy?: Record<string, "asc" | "desc">) => {
    if (!orderBy) return rows;
    const [[k, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => {
      const x = a[k] as number | Date;
      const y = b[k] as number | Date;
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
    });
  };
  const model = (name: string) => ({
    findMany: async ({
      where,
      orderBy,
      take,
    }: { where?: Record<string, unknown>; orderBy?: never; take?: number } = {}) =>
      sortBy(
        T(name).filter((r) => matches(r, where)),
        orderBy,
      )
        .slice(0, take ?? Infinity)
        .map((r) => ({ ...r })),
    // Copies, like Prisma: later writes must not change rows already read.
    findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => {
      const r = T(name).find((x) => matches(x, where));
      return r ? { ...r } : null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const r = T(name).find((x) => matches(x, where));
      return r ? { ...r } : null;
    },
    count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      T(name).filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      store.seq++;
      const row = {
        ...defaults[name],
        id: `${name}-${store.seq}`,
        createdAt: new Date(Date.UTC(2026, 9, 30, 8, 0, store.seq)),
        ...data,
      } as Row;
      const key = unique[name]?.(row);
      if (key && T(name).some((r) => unique[name](r) === key))
        throw Object.assign(new Error("unique"), { code: "P2002" });
      T(name).push(row);
      return { ...row };
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const rows = T(name).filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const before = T(name).length;
      store.tables[name] = T(name).filter((r) => !matches(r, where));
      if (name === "application")
        store.tables.applicationStatusChange = T("applicationStatusChange").filter((c) =>
          T("application").some((a) => a.id === c.applicationId),
        );
      return { count: before - T(name).length };
    },
  });
  const db: Record<string, unknown> = {
    company: model("company"),
    job: model("job"),
    user: model("user"),
    application: model("application"),
    emailCandidate: model("emailCandidate"),
    applicationStatusChange: model("applicationStatusChange"),
  };
  db.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(db);
  return { db };
});

vi.mock("@/lib/notifications/create", () => ({
  notify: async (userId: string, n: Record<string, unknown>) => {
    store.notified.push({ userId, n });
    return { id: "n1" };
  },
}));

import type { EmailSyncSettings } from "@prisma/client";
import { analyzeMessage, type AnalyzeContext } from "@/lib/email/analyze";
import { planUndo, undoAutoChange, type AutoChange } from "@/lib/email/auto-apply";
import { autoChangesMessage } from "@/lib/email/auto-notify";
import { FIXTURE_COMPANIES, FIXTURE_EMAILS as E, FIXTURE_JOBS } from "@/lib/email/fixtures";
import { applyPendingCandidates, processMessages } from "@/lib/email/scan";
import { clampThreshold, isStaleEmail, shouldAutoApply } from "@/lib/email/score";

const ctx = (over: Partial<AnalyzeContext> = {}): AnalyzeContext => ({
  autoApply: { enabled: true, threshold: 60 },
  detectStatusUpdates: true,
  companies: FIXTURE_COMPANIES,
  jobs: FIXTURE_JOBS,
  applications: [],
  ...over,
});
/** A rejection without the role or an ATS sender: scores 65, like the real-world borderline case. */
const vagueRejection = {
  ...E.rejection,
  id: "fx-reject-vague",
  from: "Nimbus Data <talent@nimbusdata.example>",
  snippet: "Unfortunately, we have decided to move forward with other candidates.",
};
const nimbusApp = (over: Record<string, unknown> = {}) => ({
  id: "a-nimbus",
  jobId: "j_nimbus_ds",
  company: "Nimbus Data Ltd.",
  title: "Data Scientist",
  status: "APPLIED" as const,
  ...over,
});

/** Threshold just above the vague rejection's score (when matched to the Nimbus application). */
const ABOVE_VAGUE = () => analyzeMessage(vagueRejection, ctx({ applications: [nimbusApp()] }))!.confidence + 5;

describe("threshold", () => {
  it("clamps to 40–100 and defaults to 60", () => {
    expect(clampThreshold(undefined)).toBe(60);
    expect(clampThreshold(10)).toBe(40);
    expect(clampThreshold(150)).toBe(100);
    expect(clampThreshold(72.4)).toBe(72);
  });
  it("auto-applies at exactly the threshold, reviews just below it, and never when off", () => {
    const score = analyzeMessage(vagueRejection, ctx({ applications: [nimbusApp()] }))!.confidence;
    expect(score).toBeLessThan(100);
    const at = (threshold: number, enabled = true) =>
      analyzeMessage(vagueRejection, ctx({ autoApply: { enabled, threshold }, applications: [nimbusApp()] }))!.action;
    expect(at(score)).toBe("update");
    expect(at(score + 1)).toBe("review");
    expect(at(40, false)).toBe("review");
    expect(shouldAutoApply(99, { enabled: true, threshold: 200 })).toBe(false);
  });
  it("adds a confident rejection for a job not on the board yet as REJECTED", () => {
    expect(analyzeMessage(E.rejection, ctx())!).toMatchObject({
      action: "create",
      newStatus: "REJECTED",
      company: "Nimbus Data Ltd.",
      matchedJobId: "j_nimbus_ds",
    });
  });
});

describe("ordering", () => {
  const later = new Date(E.rejection.date.getTime() + 86_400_000);
  const earlier = new Date(E.rejection.date.getTime() - 86_400_000);
  it("an older rejection never overrides a later interview; it goes to review", () => {
    const a = analyzeMessage(
      E.rejection,
      ctx({ applications: [nimbusApp({ status: "INTERVIEW", statusAt: later })] }),
    )!;
    expect(a.action).toBe("review");
    expect(a.reasons).toContain("older_than_status");
  });
  it("a newer rejection after an interview applies", () => {
    const a = analyzeMessage(
      E.rejection,
      ctx({ applications: [nimbusApp({ status: "INTERVIEW", statusAt: earlier })] }),
    )!;
    expect(a).toMatchObject({ action: "update", newStatus: "REJECTED" });
  });
  it("a rejection never overwrites an offer, whatever the date", () => {
    for (const statusAt of [earlier, later])
      expect(
        analyzeMessage(E.rejection, ctx({ applications: [nimbusApp({ status: "OFFER", statusAt })] }))!.action,
      ).toBe("duplicate");
  });
  it("only guards later-stage statuses", () => {
    expect(isStaleEmail("APPLIED", later, E.rejection.date)).toBe(false);
    expect(isStaleEmail("SCREENING", later, E.rejection.date)).toBe(true);
    expect(isStaleEmail("INTERVIEW", null, E.rejection.date)).toBe(false);
  });
});

describe("planUndo", () => {
  const change = {
    id: "c1",
    fromStatus: "APPLIED" as const,
    toStatus: "REJECTED" as const,
    prevStatusChangedAt: null,
    undoneAt: null,
    createdAt: new Date(),
  };
  it("restores the previous status", () => {
    expect(planUndo(change, { status: "REJECTED" }, 0)).toEqual({
      kind: "restore",
      status: "APPLIED",
      statusChangedAt: null,
    });
  });
  it("deletes an application the change created", () => {
    expect(planUndo({ ...change, fromStatus: null }, { status: "REJECTED" }, 0)).toEqual({ kind: "delete" });
  });
  it("refuses when the application moved on, and is a no-op when already undone", () => {
    expect(planUndo(change, { status: "OFFER" }, 0).kind).toBe("conflict");
    expect(planUndo(change, { status: "REJECTED" }, 1).kind).toBe("conflict");
    expect(planUndo({ ...change, undoneAt: new Date() }, { status: "REJECTED" }, 0).kind).toBe("noop");
  });
});

describe("notification text", () => {
  const ch = (company: string): AutoChange => ({
    changeId: `x-${company}`,
    applicationId: "a",
    company,
    title: "Data Scientist",
    fromStatus: "APPLIED",
    toStatus: "REJECTED",
    confidence: 80,
  });
  it("summarizes one or many changes in Hebrew", () => {
    expect(autoChangesMessage([], "he")).toBeNull();
    expect(autoChangesMessage([ch("Nimbus")], "he")!.title).toContain("Nimbus");
    const many = autoChangesMessage([ch("A"), ch("B")], "he")!;
    expect(many.title).toContain("2");
    expect(many.body).toContain("נדח");
  });
});

// ── scan pipeline against the in-memory db ──
const USER = "u1";
const settings = {
  userId: USER,
  autoApplyEnabled: true,
  autoApplyThreshold: 60,
  detectStatusUpdates: true,
} as unknown as EmailSyncSettings;

function seed(apps: Row[] = []) {
  store.tables = {
    company: FIXTURE_COMPANIES.map((c) => ({ ...c })),
    job: FIXTURE_JOBS.map((j) => ({ ...j })),
    user: [{ id: USER, locale: "he" }],
    application: apps,
    emailCandidate: [],
    applicationStatusChange: [],
  };
  store.notified = [];
}
const appRow = (over: Record<string, unknown> = {}): Row => ({
  ...nimbusApp(),
  userId: USER,
  statusChangedAt: null,
  appliedAt: new Date(Date.UTC(2026, 9, 1)),
  createdAt: new Date(Date.UTC(2026, 9, 1)),
  ...over,
});

describe("processMessages (auto-apply)", () => {
  beforeEach(() => seed([appRow()]));

  it("applies a confident rejection, logs it, and is idempotent on re-scan", async () => {
    const changes: AutoChange[] = [];
    const first = await processMessages(USER, "GMAIL", [E.rejection], settings, { changes });
    expect(first).toMatchObject({ updated: 1, pending: 0 });
    expect(store.tables.application[0].status).toBe("REJECTED");
    expect(changes).toHaveLength(1);
    const log = store.tables.applicationStatusChange[0];
    expect(log).toMatchObject({
      source: "EMAIL_AUTO",
      fromStatus: "APPLIED",
      toStatus: "REJECTED",
      emailDate: E.rejection.date,
    });
    expect(log.confidence).toBeGreaterThanOrEqual(60);
    expect(log.emailCandidateId).toBe(store.tables.emailCandidate[0].id);

    const again = await processMessages(USER, "GMAIL", [E.rejection], settings);
    expect(again).toMatchObject({ updated: 0, duplicates: 1 });
    expect(store.tables.applicationStatusChange).toHaveLength(1);
    expect(store.tables.emailCandidate).toHaveLength(1);
  });

  it("keeps the review flow below the threshold", async () => {
    const sum = await processMessages(USER, "GMAIL", [vagueRejection], {
      ...settings,
      autoApplyThreshold: ABOVE_VAGUE(),
    });
    expect(sum).toMatchObject({ updated: 0, pending: 1 });
    expect(store.tables.application[0].status).toBe("APPLIED");
    expect(store.tables.applicationStatusChange).toHaveLength(0);
  });

  it("does not let an email older than a manual interview move the application", async () => {
    seed([appRow({ status: "INTERVIEW" })]);
    store.tables.applicationStatusChange.push({
      id: "manual-1",
      userId: USER,
      applicationId: "a-nimbus",
      fromStatus: "APPLIED",
      toStatus: "INTERVIEW",
      source: "MANUAL",
      undoneAt: null,
      emailDate: null,
      createdAt: new Date(E.rejection.date.getTime() + 3_600_000),
    });
    const sum = await processMessages(USER, "GMAIL", [E.rejection], settings);
    expect(sum).toMatchObject({ updated: 0, pending: 1 });
    expect(store.tables.application[0].status).toBe("INTERVIEW");
    // ...and re-checking the review queue doesn't apply it either.
    expect(await applyPendingCandidates(USER, settings)).toHaveLength(0);
  });

  it("processes a scan oldest-first: confirmation, then a later rejection", async () => {
    seed([]);
    const confirm = {
      ...E.rejection,
      id: "fx-nimbus-confirm",
      subject: "Thank you for applying to Nimbus Data",
      snippet: "Thanks for applying for the Data Scientist position at Nimbus Data. We'll review your application.",
      date: new Date(E.rejection.date.getTime() - 5 * 86_400_000),
    };
    const sum = await processMessages(USER, "GMAIL", [E.rejection, confirm], settings);
    expect(sum).toMatchObject({ created: 1, updated: 1 });
    expect(store.tables.application).toHaveLength(1);
    expect(store.tables.application[0].status).toBe("REJECTED");
  });
});

describe("applyPendingCandidates + undo", () => {
  beforeEach(() => seed([appRow()]));

  it("applies waiting review items once they meet the threshold, exactly once", async () => {
    await processMessages(USER, "GMAIL", [vagueRejection], { ...settings, autoApplyThreshold: ABOVE_VAGUE() });
    expect(store.tables.emailCandidate[0].status).toBe("PENDING");
    const applied = await applyPendingCandidates(USER, settings);
    expect(applied).toHaveLength(1);
    expect(store.tables.application[0].status).toBe("REJECTED");
    expect(store.tables.emailCandidate[0]).toMatchObject({ status: "AUTO_ADDED", applicationId: "a-nimbus" });
    expect(await applyPendingCandidates(USER, settings)).toHaveLength(0);
    expect(await applyPendingCandidates(USER, { ...settings, autoApplyEnabled: false })).toHaveLength(0);
  });

  it("undo restores the previous status; re-scans and a second undo don't change it again", async () => {
    const changes: AutoChange[] = [];
    await processMessages(USER, "GMAIL", [E.rejection], settings, { changes });
    expect(await undoAutoChange(USER, changes[0].changeId)).toBe("restore");
    expect(store.tables.application[0]).toMatchObject({ status: "APPLIED", statusChangedAt: null });
    expect(store.tables.emailCandidate[0].status).toBe("DISMISSED");
    expect(await undoAutoChange(USER, changes[0].changeId)).toBe("noop");
    await processMessages(USER, "GMAIL", [E.rejection], settings);
    expect(await applyPendingCandidates(USER, settings)).toHaveLength(0);
    expect(store.tables.application[0].status).toBe("APPLIED");
    expect(await undoAutoChange("someone-else", changes[0].changeId)).toBe("not_found");
  });

  it("undo of a created application removes it", async () => {
    seed([]);
    const changes: AutoChange[] = [];
    await processMessages(USER, "GMAIL", [E.rejection], settings, { changes });
    expect(store.tables.application).toHaveLength(1);
    expect(await undoAutoChange(USER, changes[0].changeId)).toBe("delete");
    expect(store.tables.application).toHaveLength(0);
    expect(store.tables.emailCandidate[0]).toMatchObject({ status: "DISMISSED", applicationId: null });
  });

  it("undo refuses after a later manual change", async () => {
    const changes: AutoChange[] = [];
    await processMessages(USER, "GMAIL", [E.rejection], settings, { changes });
    store.tables.application[0].status = "OFFER";
    expect(await undoAutoChange(USER, changes[0].changeId)).toBe("conflict");
    expect(store.tables.application[0].status).toBe("OFFER");
  });
});

describe("buildHistory", () => {
  it("offers undo only while the latest active change is automatic and still current", async () => {
    const { buildHistory } = await import("@/lib/email/history");
    const d = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m));
    const base = { confidence: 80, undoneAt: null };
    const changes = [
      {
        ...base,
        id: "c1",
        applicationId: "a",
        fromStatus: null,
        toStatus: "APPLIED" as const,
        source: "EMAIL_AUTO" as const,
        createdAt: d(1),
      },
      {
        ...base,
        id: "c2",
        applicationId: "a",
        fromStatus: "APPLIED" as const,
        toStatus: "REJECTED" as const,
        source: "EMAIL_AUTO" as const,
        createdAt: d(2),
      },
      {
        ...base,
        id: "c3",
        applicationId: "b",
        fromStatus: "APPLIED" as const,
        toStatus: "REJECTED" as const,
        source: "EMAIL_AUTO" as const,
        createdAt: d(1),
      },
      {
        ...base,
        id: "c4",
        applicationId: "b",
        fromStatus: "REJECTED" as const,
        toStatus: "INTERVIEW" as const,
        source: "MANUAL" as const,
        createdAt: d(3),
      },
      {
        ...base,
        id: "c5",
        applicationId: "c",
        fromStatus: "APPLIED" as const,
        toStatus: "REJECTED" as const,
        source: "EMAIL_AUTO" as const,
        createdAt: d(1),
        undoneAt: d(2),
      },
    ];
    const status = new Map([
      ["a", "REJECTED" as const],
      ["b", "INTERVIEW" as const],
      ["c", "APPLIED" as const],
    ]);
    const { timeline, auto } = buildHistory(changes, status, (x) => x.toISOString());
    expect(auto.get("a")).toEqual({ changeId: "c2", canUndo: true });
    expect(auto.has("b")).toBe(false);
    expect(auto.has("c")).toBe(false);
    expect(timeline.get("a")!.map((e) => e.id)).toEqual(["c1", "c2"]);
    expect(timeline.get("c")![0].undone).toBe(true);
  });
});
