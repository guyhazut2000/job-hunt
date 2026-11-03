import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { job: { id: string; title: string; location: string; company: { name: string } }; personal: P };
type P = { score: number; parts: Record<string, number | null>; hidden: boolean; reasons: unknown[] };

const store = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  rows: {} as Record<string, Row[]>,
  rankPrefs: {} as Record<string, unknown>,
  sentToday: {} as Record<string, number>,
  newJobs: 1,
  upserts: [] as Array<{ userId: string; at: Date }>,
  notified: [] as Array<{ userId: string; n: Record<string, unknown> }>,
  rankCalls: [] as Array<{ userId: string; where: unknown }>,
  dupes: new Set<string>(),
}));

vi.mock("@/lib/notifications/create", () => ({
  notify: vi.fn(async (userId: string, n: Record<string, unknown>) => {
    const key = `${userId}|${n.dedupeKey}`;
    if (store.dupes.has(key)) return null;
    store.dupes.add(key);
    store.notified.push({ userId, n });
    return { id: `n${store.notified.length}` };
  }),
}));

vi.mock("@/lib/ranking/server", () => ({
  getRankingPrefs: vi.fn(async (userId: string) => store.rankPrefs[userId] ?? null),
  rankPersonal: vi.fn(async ({ userId, where }: { userId: string; where: unknown }) => {
    store.rankCalls.push({ userId, where });
    return { rows: store.rows[userId] ?? [], hidden: 0 };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn(async () => store.users) },
    job: { count: vi.fn(async () => store.newJobs) },
    company: { findMany: vi.fn(async () => []) },
    notification: {
      count: vi.fn(async ({ where }: { where: { userId: string } }) => store.sentToday[where.userId] ?? 0),
    },
    notificationPreference: {
      upsert: vi.fn(async ({ where, update }: { where: { userId: string }; update: { highMatchCheckedAt: Date } }) => {
        store.upserts.push({ userId: where.userId, at: update.highMatchCheckedAt });
      }),
    },
  },
}));

import {
  buildHighMatchAlert,
  FIRST_LOOKBACK_MS,
  israelDayStart,
  MAX_LOOKBACK_MS,
  pickHighMatches,
  runHighMatchAlerts,
  windowStart,
} from "@/lib/notifications/high-match";
import { NOTIFICATION_KINDS, channelEnabled } from "@/lib/notifications/kinds";
import { DEFAULT_PREFS, toEffective } from "@/lib/notifications/prefs";
import { notificationStrings } from "@/lib/i18n/notifications";

const now = new Date("2026-11-04T10:00:00Z"); // 12:00 Israel

const profile = {
  // Enough for hasScorableProfile: skills + target role.
  skills: ["TypeScript", "React", "Node.js"],
  targetRoles: ["Full Stack Engineer"],
  yearsExperience: 4,
  headline: "Full stack engineer",
};

function row(id: string, score: number, extra: Partial<P> = {}): Row {
  return {
    job: { id, title: `Engineer ${id}`, location: "Tel Aviv", company: { name: `Co ${id}` } },
    personal: {
      score,
      parts: { match: score, keywords: null, recency: 100, response: null },
      hidden: false,
      reasons: [
        { key: "match", score, points: 30 },
        { key: "fresh", days: 0, points: 10 },
      ],
      ...extra,
    },
  };
}

function user(id: string, prefs: Record<string, unknown> | null = {}, locale = "he") {
  return {
    id,
    locale,
    profile,
    notificationPrefs: prefs === null ? null : { ...DEFAULT_PREFS, highMatchCheckedAt: null, ...prefs },
  };
}

beforeEach(() => {
  store.users = [];
  store.rows = {};
  store.rankPrefs = {};
  store.sentToday = {};
  store.newJobs = 1;
  store.upserts = [];
  store.notified = [];
  store.rankCalls = [];
  store.dupes = new Set();
});

describe("high-match helpers", () => {
  it("windowStart: watermark, else a 2h look-back, never more than 24h", () => {
    const mark = new Date(now.getTime() - 15 * 60_000);
    expect(windowStart(mark, now)).toEqual(mark);
    expect(windowStart(null, now)).toEqual(new Date(now.getTime() - FIRST_LOOKBACK_MS));
    expect(windowStart(new Date("2026-10-01T00:00:00Z"), now)).toEqual(new Date(now.getTime() - MAX_LOOKBACK_MS));
  });

  it("pickHighMatches keeps scores at or above the threshold and drops hidden jobs", () => {
    const rows = [row("a", 92), row("b", 80), row("c", 79), row("d", 95, { hidden: true })];
    expect(pickHighMatches(rows, 80).map((r) => r.job.id)).toEqual(["a", "b"]);
    expect(pickHighMatches(rows, 95)).toEqual([]);
  });

  it("israelDayStart is local midnight (UTC+2 in winter, UTC+3 in summer)", () => {
    expect(israelDayStart(now).toISOString()).toBe("2026-11-03T22:00:00.000Z");
    expect(israelDayStart(new Date("2026-07-01T10:00:00Z")).toISOString()).toBe("2026-06-30T21:00:00.000Z");
    // 23:30 UTC on Nov 3 is already Nov 4 in Israel.
    expect(israelDayStart(new Date("2026-11-03T23:30:00Z")).toISOString()).toBe("2026-11-03T22:00:00.000Z");
  });

  it("one job: score in the title, company, location and the reasons, links to the job", () => {
    const a = buildHighMatchAlert("he", [row("j1", 87)] as never);
    expect(a.title).toBe("87% התאמה אישית: Engineer j1");
    expect(a.body).toContain("Co j1 · Tel Aviv");
    expect(a.body).toContain("87");
    expect(a.url).toBe("/jobs/j1");
    const en = buildHighMatchAlert("en", [row("j1", 87)] as never);
    expect(en.title).toBe("87% personal fit: Engineer j1");
  });

  it("several jobs: count in the title, top 3 listed, rest summarized, links to the personal sort", () => {
    const a = buildHighMatchAlert("he", [row("a", 95), row("b", 90), row("c", 85), row("d", 82)] as never);
    expect(a.title).toBe("4 משרות חדשות עם התאמה אישית גבוהה");
    expect(a.body.split("\n")).toEqual([
      "• 95% · Engineer a · Co a",
      "• 90% · Engineer b · Co b",
      "• 85% · Engineer c · Co c",
      "ועוד 1",
    ]);
    expect(a.url).toBe("/jobs?sort=personal");
  });

  it("HIGH_MATCH is a real kind with strings and push/Telegram on by default", () => {
    expect(NOTIFICATION_KINDS).toContain("HIGH_MATCH");
    expect(channelEnabled({}, "HIGH_MATCH", "push")).toBe(true);
    expect(channelEnabled({}, "HIGH_MATCH", "telegram")).toBe(true);
    for (const l of ["he", "en"] as const) {
      expect(notificationStrings(l).kinds.HIGH_MATCH).toBeTruthy();
      expect(notificationStrings(l).kindHints.HIGH_MATCH).toBeTruthy();
    }
  });

  it("defaults: on, threshold 80, 3 a day", () => {
    const e = toEffective(null);
    expect([e.highMatchEnabled, e.highMatchThreshold, e.highMatchDailyCap]).toEqual([true, 80, 3]);
  });
});

describe("runHighMatchAlerts", () => {
  it("alerts on new jobs at or above the user's threshold and advances the watermark", async () => {
    store.users = [user("u1")];
    store.rows.u1 = [row("j1", 88), row("j2", 60)];
    const r = await runHighMatchAlerts(now);
    expect(r).toMatchObject({ users: 1, notified: 1, jobs: 1 });
    expect(store.notified).toHaveLength(1);
    expect(store.notified[0].n).toMatchObject({
      kind: "HIGH_MATCH",
      url: "/jobs/j1",
      dedupeKey: "highmatch:j1",
      data: { jobIds: ["j1"], scores: [88], threshold: 80 },
    });
    expect(store.upserts).toEqual([{ userId: "u1", at: now }]);
    // Only jobs created inside the window are scored.
    const where = JSON.stringify(store.rankCalls[0].where);
    expect(where).toContain(new Date(now.getTime() - FIRST_LOOKBACK_MS).toISOString());
    expect(where).toContain(now.toISOString());
  });

  it("uses each user's own threshold", async () => {
    store.users = [user("strict", { highMatchThreshold: 90 }), user("loose", { highMatchThreshold: 60 })];
    store.rows.strict = [row("j1", 88)];
    store.rows.loose = [row("j1", 88)];
    await runHighMatchAlerts(now);
    expect(store.notified.map((n) => n.userId)).toEqual(["loose"]);
  });

  it("respects the daily cap but still advances the watermark (no replay tomorrow)", async () => {
    store.users = [user("u1", { highMatchDailyCap: 2 })];
    store.sentToday.u1 = 2;
    store.rows.u1 = [row("j1", 95)];
    const r = await runHighMatchAlerts(now);
    expect(r).toMatchObject({ notified: 0, capped: 1 });
    expect(store.notified).toEqual([]);
    expect(store.upserts).toHaveLength(1);
  });

  it("dedups: the same top job is never alerted twice", async () => {
    store.users = [user("u1")];
    store.rows.u1 = [row("j1", 95)];
    await runHighMatchAlerts(now);
    await runHighMatchAlerts(new Date(now.getTime() + 15 * 60_000));
    expect(store.notified).toHaveLength(1);
  });

  it("skips users with no profile and no ranking keywords (score would be freshness only)", async () => {
    store.users = [{ ...user("u1"), profile: null }];
    store.rows.u1 = [row("j1", 100)];
    const r = await runHighMatchAlerts(now);
    expect(r.users).toBe(0);
    expect(store.notified).toEqual([]);
  });

  it("keyword-only users are scored", async () => {
    store.users = [{ ...user("u1"), profile: null }];
    store.rankPrefs.u1 = {
      include: [{ term: "TypeScript", must: false }],
      exclude: [],
      weights: { match: 3, keywords: 2, recency: 1, response: 1 },
      defaultSort: false,
    };
    store.rows.u1 = [row("j1", 90)];
    await runHighMatchAlerts(now);
    expect(store.notified).toHaveLength(1);
  });

  it("no new jobs: nothing is scored, watermarks still advance", async () => {
    store.users = [user("u1")];
    store.newJobs = 0;
    store.rows.u1 = [row("j1", 99)];
    await runHighMatchAlerts(now);
    expect(store.rankCalls).toEqual([]);
    expect(store.upserts).toHaveLength(1);
  });

  it("users without a prefs row get the defaults (on, 80)", async () => {
    store.users = [user("u1", null)];
    store.rows.u1 = [row("j1", 80), row("j2", 81)];
    await runHighMatchAlerts(now);
    expect(store.notified[0].n).toMatchObject({ url: "/jobs?sort=personal", data: { jobIds: ["j1", "j2"] } });
  });
});
