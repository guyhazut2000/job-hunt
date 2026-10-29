import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  follows: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  matchAlerts: [] as Array<{ userId: string; data: unknown }>,
  companies: [] as Array<Record<string, unknown>>,
  alerts: new Set<string>(),
  admins: [] as Array<{ id: string; locale: string }>,
  notified: [] as Array<{ userId: string; n: Record<string, unknown> }>,
  running: false,
}));

vi.mock("@/lib/notifications/create", () => ({
  notify: vi.fn(async (userId: string, n: Record<string, unknown>) => {
    store.notified.push({ userId, n });
    return { id: `n${store.notified.length}` };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    companyFollow: {
      findMany: vi.fn(async ({ where }: { where?: { companyId?: { in: string[] } } } = {}) =>
        store.follows.filter((f) => !where?.companyId || where.companyId.in.includes(f.companyId as string)),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(
          store.follows.find((f) => f.id === where.id)!,
          data,
        );
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        for (const f of store.follows) Object.assign(f, data);
      }),
    },
    job: {
      findMany: vi.fn(async ({ where }: { where: { createdAt: { gt: Date; lte: Date } } }) =>
        store.jobs.filter(
          (j) =>
            j.isActive && (j.createdAt as Date) > where.createdAt.gt && (j.createdAt as Date) <= where.createdAt.lte,
        ),
      ),
    },
    notification: { findMany: vi.fn(async () => store.matchAlerts) },
    company: { findMany: vi.fn(async () => store.companies) },
    scanFailureAlert: {
      create: vi.fn(async ({ data }: { data: { companyId: string; streakKey: string } }) => {
        const key = `${data.companyId}|${data.streakKey}`;
        if (store.alerts.has(key))
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
        store.alerts.add(key);
        return data;
      }),
    },
    user: { findMany: vi.fn(async () => store.admins) },
    ingestionRun: { findFirst: vi.fn(async () => (store.running ? { id: "r" } : null)) },
  },
}));

import { CAP_EXEMPT, channelEnabled, NOTIFICATION_KINDS } from "@/lib/notifications/kinds";
import { alreadyAlerted, buildCompanyAlert, runFollowedCompanyAlerts } from "@/lib/notifications/company-follow";
import {
  buildAdminAlert,
  buildFollowerAlert,
  runScanFailureAlerts,
  streakKey,
} from "@/lib/notifications/scan-failures";
import { authorized, scanInProgress } from "@/lib/ingestion/fast-scan";

const now = new Date("2026-11-04T10:00:00Z");
const before = new Date("2026-11-04T09:00:00Z");
const company = { name: "Acme", slug: "acme" };

beforeEach(() => {
  store.follows = [];
  store.jobs = [];
  store.matchAlerts = [];
  store.companies = [];
  store.alerts = new Set();
  store.admins = [];
  store.notified = [];
  store.running = false;
});

describe("new kinds", () => {
  it("are registered with sensible channel defaults", () => {
    expect(NOTIFICATION_KINDS).toEqual(expect.arrayContaining(["COMPANY_JOBS", "SCAN_FAILED"]));
    expect(channelEnabled({}, "COMPANY_JOBS", "push")).toBe(true);
    expect(channelEnabled({}, "COMPANY_JOBS", "telegram")).toBe(true);
    // A broken feed isn't urgent: Telegram + in-site, no phone buzz unless turned on.
    expect(channelEnabled({}, "SCAN_FAILED", "push")).toBe(false);
    expect(channelEnabled({}, "SCAN_FAILED", "telegram")).toBe(true);
    expect(channelEnabled({ SCAN_FAILED: { push: true } }, "SCAN_FAILED", "push")).toBe(true);
    expect(CAP_EXEMPT).not.toContain("SCAN_FAILED");
  });
});

describe("followed-company alert text", () => {
  it("names a single job and links to it", () => {
    const a = buildCompanyAlert("en", company, [{ id: "j1", title: "Backend Engineer", location: "Tel Aviv" }]);
    expect(a.title).toBe("New at Acme: Backend Engineer");
    expect(a.url).toBe("/jobs/j1");
    expect(a.body).toContain("Tel Aviv");
  });
  it("groups many jobs and links to the company", () => {
    const jobs = Array.from({ length: 5 }, (_, i) => ({ id: `j${i}`, title: `Role ${i}`, location: "TLV" }));
    const a = buildCompanyAlert("he", company, jobs);
    expect(a.title).toContain("5");
    expect(a.url).toBe("/companies/acme");
    expect(a.body.split("\n")).toHaveLength(4); // 3 listed + "and 2 more"
  });
  it("collects job ids already sent by saved-search alerts", () => {
    const m = alreadyAlerted([
      { userId: "u1", data: { jobIds: ["a", "b"] } },
      { userId: "u1", data: { jobIds: ["c"] } },
      { userId: "u2", data: null },
    ]);
    expect([...m.get("u1")!]).toEqual(["a", "b", "c"]);
    expect(m.has("u2")).toBe(false);
  });
});

describe("runFollowedCompanyAlerts", () => {
  const follow = (id: string, userId: string, companyId: string) => ({
    id,
    userId,
    companyId,
    lastCheckedAt: before,
    company,
    user: { locale: "en" },
  });
  it("alerts once per follow, skips jobs already sent as a search match, and advances lastCheckedAt", async () => {
    store.follows = [follow("f1", "u1", "c1"), follow("f2", "u2", "c2")];
    const at = new Date("2026-11-04T09:30:00Z");
    store.jobs = [
      { id: "j1", title: "A", location: "TLV", companyId: "c1", createdAt: at, isActive: true },
      { id: "j2", title: "B", location: "TLV", companyId: "c1", createdAt: at, isActive: true },
      {
        id: "old",
        title: "C",
        location: "TLV",
        companyId: "c1",
        createdAt: new Date("2026-11-04T08:00:00Z"),
        isActive: true,
      },
    ];
    store.matchAlerts = [{ userId: "u1", data: { jobIds: ["j2"] } }];
    const r = await runFollowedCompanyAlerts(now);
    expect(r).toEqual({ follows: 2, notified: 1, jobs: 1 });
    expect(store.notified).toHaveLength(1);
    const { userId, n } = store.notified[0];
    expect(userId).toBe("u1");
    expect(n.kind).toBe("COMPANY_JOBS");
    expect(n.data).toEqual({ companyId: "c1", jobIds: ["j1"] });
    expect(n.dedupeKey).toBe(`company:f1:${now.toISOString()}`);
    expect(store.follows.every((f) => (f.lastCheckedAt as Date).getTime() === now.getTime())).toBe(true);
    // Next run: nothing new → nothing sent.
    store.notified = [];
    await runFollowedCompanyAlerts(new Date("2026-11-04T10:15:00Z"));
    expect(store.notified).toHaveLength(0);
  });
});

describe("scan-failure alerts", () => {
  const failing = (id: string, lastSyncedAt: Date | null) => ({
    id,
    name: id.toUpperCase(),
    slug: id,
    syncFailures: 3,
    lastSyncError: "HTTP 403",
    lastSyncedAt,
  });
  it("streak key is stable for a whole failing streak", () => {
    expect(streakKey({ lastSyncedAt: null })).toBe("never");
    expect(streakKey({ lastSyncedAt: before })).toBe(before.toISOString());
  });
  it("texts: admins get a grouped list, followers a same-site link", () => {
    const cs = [failing("a", null), failing("b", null)];
    const admin = buildAdminAlert("en", cs);
    expect(admin.title).toBe("2 companies stopped syncing");
    expect(admin.body).toContain("A (3×): HTTP 403");
    expect(buildAdminAlert("en", cs.slice(0, 1)).title).toBe("Sync failing: A");
    const f = buildFollowerAlert("en", cs[0]);
    expect(f.url).toBe("/companies/a");
    expect(f.url.startsWith("/")).toBe(true);
  });
  it("alerts admins once and non-admin followers once per streak, not per scan", async () => {
    store.companies = [failing("c1", before), failing("c2", null)];
    store.admins = [{ id: "admin", locale: "he" }];
    store.follows = [
      { userId: "u1", companyId: "c1", user: { locale: "en" } },
      { userId: "admin", companyId: "c2", user: { locale: "he" } },
    ];
    const r1 = await runScanFailureAlerts(now);
    expect(r1).toEqual({ newlyFailing: 2, admins: 1, followers: 1 });
    expect(store.notified.map((x) => [x.userId, x.n.kind])).toEqual([
      ["admin", "SCAN_FAILED"],
      ["u1", "SCAN_FAILED"],
    ]);
    // The next scans fail too: same streak → silence.
    store.notified = [];
    const r2 = await runScanFailureAlerts(new Date("2026-11-04T10:15:00Z"));
    expect(r2.newlyFailing).toBe(0);
    expect(store.notified).toHaveLength(0);
    // c1 recovered (lastSyncedAt moved) and broke again → a new streak, alerted again.
    store.companies = [failing("c1", now)];
    const r3 = await runScanFailureAlerts(new Date("2026-11-05T10:00:00Z"));
    expect(r3.newlyFailing).toBe(1);
  });
});

describe("fast scan endpoint helpers", () => {
  const secret = "s".repeat(64);
  it("accepts only an exact bearer secret", () => {
    expect(authorized(`Bearer ${secret}`, [undefined, secret])).toBe(true);
    expect(authorized(`Bearer ${secret}x`, [secret])).toBe(false);
    expect(authorized(secret, [secret])).toBe(false);
    expect(authorized(null, [secret])).toBe(false);
    // Unset / too-short secrets never authorize (e.g. an empty env var).
    expect(authorized("Bearer ", [""])).toBe(false);
    expect(authorized("Bearer short", ["short"])).toBe(false);
  });
  it("detects a scan in progress", async () => {
    expect(await scanInProgress(now)).toBe(false);
    store.running = true;
    expect(await scanInProgress(now)).toBe(true);
  });
});
