import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsApp } from "@/lib/stats/search-stats";

const store = vi.hoisted(() => ({
  users: [] as Array<{ id: string }>,
  apps: [] as unknown[],
  contacts: [] as unknown[],
  profile: { id: "p1" } as { id: string } | null,
  reports: [] as Array<{ userId: string; week: string; create: Record<string, unknown> }>,
  notified: [] as Array<{ userId: string; n: Record<string, unknown> }>,
  findManyWhere: null as unknown,
  llm: { name: "mock", out: "" } as { name: string; out: string; throwLimit?: boolean },
}));

vi.mock("@/lib/notifications/create", () => ({
  notify: vi.fn(async (userId: string, n: Record<string, unknown>) => {
    store.notified.push({ userId, n });
    return { id: "n1" };
  }),
}));

vi.mock("@/lib/ai", async () => {
  const { AiLimitError } = await import("@/lib/ai/errors");
  return {
    guardedLLM: vi.fn(async () => ({
      name: store.llm.name,
      complete: vi.fn(async () => {
        if (store.llm.throwLimit) throw new AiLimitError("user_daily");
        return store.llm.out;
      }),
    })),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUniqueOrThrow: vi.fn(async () => ({ locale: "he" })),
      findMany: vi.fn(async ({ where }: { where: unknown }) => {
        store.findManyWhere = where;
        return store.users;
      }),
    },
    application: { findMany: vi.fn(async () => store.apps) },
    contact: { findMany: vi.fn(async () => store.contacts) },
    profile: { findUnique: vi.fn(async () => store.profile) },
    coachReport: {
      upsert: vi.fn(
        async ({ where, create }: { where: { userId_week: { userId: string; week: string } }; create: never }) => {
          store.reports.push({ ...where.userId_week, create });
          return { id: `r${store.reports.length}` };
        },
      ),
    },
  },
}));

import { normalizeCoachAi } from "@/lib/coach/ai";
import { buildCoachData, lastWeek, recommend, WEEKLY_APPLY_TARGET, type CoachContact } from "@/lib/coach/build";
import { generateCoachReport, runWeeklyCoach } from "@/lib/coach/run";
import { coachNotification, recText } from "@/lib/coach/text";
import { coachStrings } from "@/lib/i18n/coach";

// Sunday 2026-11-08 10:00 Israel (08:00 UTC). Last completed week: Sun 2026-11-01 … Sat 2026-11-07.
const NOW = new Date("2026-11-08T08:00:00Z");
const d = (s: string) => new Date(s);

function app(id: string, over: Partial<StatsApp> = {}): StatsApp {
  return {
    id,
    title: `Engineer ${id}`,
    company: `Co ${id}`,
    status: "APPLIED",
    createdAt: d("2026-11-02T10:00:00Z"),
    appliedAt: d("2026-11-02T10:00:00Z"),
    statusChangedAt: null,
    source: "APP",
    jobId: null,
    domain: null,
    provider: null,
    changes: [],
    ...over,
  };
}
const contact = (over: Partial<CoachContact>): CoachContact => ({
  status: "SENT",
  sentAt: null,
  statusAt: null,
  followedUpAt: null,
  ...over,
});

describe("buildCoachData", () => {
  it("summarizes the last completed Israel week", () => {
    expect(lastWeek(NOW)).toBe("2026-11-01");
    const data = buildCoachData({
      apps: [
        app("a"),
        app("b"),
        app("old", { appliedAt: d("2026-10-27T10:00:00Z"), createdAt: d("2026-10-27T10:00:00Z") }),
        app("resp", {
          status: "SCREENING",
          changes: [
            {
              fromStatus: "APPLIED",
              toStatus: "SCREENING",
              source: "EMAIL_AUTO",
              at: d("2026-11-04T09:00:00Z"),
              undone: false,
            },
          ],
        }),
        app("saved", { status: "SAVED", appliedAt: null }),
      ],
      contacts: [
        contact({ sentAt: d("2026-11-03T09:00:00Z") }),
        contact({ status: "REPLIED", sentAt: d("2026-10-20T09:00:00Z"), statusAt: d("2026-11-05T09:00:00Z") }),
        contact({ sentAt: d("2026-10-28T09:00:00Z") }),
        contact({ status: "NOT_CONTACTED" }),
      ],
      hasProfile: true,
      now: NOW,
    });
    expect(data.week).toBe("2026-11-01");
    expect(data.weekEnd).toBe("2026-11-07");
    expect(data.partial).toBe(false);
    expect(data.activity.applied).toBe(3);
    expect(data.prevWeek.applied).toBe(1);
    expect(data.activity.responses).toBe(1);
    expect(data.totals.saved).toBe(1);
    expect(data.responseRate).toBeNull(); // 4 applications < MIN_FOR_RATES
    expect(data.outreach).toMatchObject({ sent: 1, prevSent: 1, replies: 1, total: 3 });
    // The 2026-10-28 message is >7 days old, still SENT, never followed up.
    expect(data.outreach.waiting).toBe(1);
    expect(data.recommendations).toHaveLength(3);
  });

  it("uses an Israel Sunday boundary (Saturday night UTC is already Sunday in Israel)", () => {
    const data = buildCoachData({
      apps: [app("x", { appliedAt: d("2026-11-07T22:30:00Z"), createdAt: d("2026-11-07T22:30:00Z") })],
      contacts: [],
      hasProfile: true,
      now: NOW,
    });
    expect(data.activity.applied).toBe(0);
  });

  it("flags stuck applications with their stage and days", () => {
    const stale = d("2026-10-10T10:00:00Z");
    const data = buildCoachData({
      apps: [app("s1", { appliedAt: stale, createdAt: stale }), app("s2", { appliedAt: stale, createdAt: stale })],
      contacts: [],
      hasProfile: true,
      now: NOW,
    });
    expect(data.stuck.total).toBe(2);
    expect(data.stuck.topStage).toBe("APPLIED");
    const r = data.recommendations[0];
    expect(r.id).toBe("follow_up_stuck");
    expect(r.basis).toMatchObject({ count: 2, stage: "APPLIED", stageCount: 2, days: 28 });
    expect(r.href).toBe("/dashboard");
  });
});

describe("recommend", () => {
  const base = buildCoachData({ apps: [], contacts: [], hasProfile: true, now: NOW });

  it("always returns exactly three unique recommendations, even with no signals", () => {
    const recs = recommend({
      ...base,
      activity: { applied: 9, responses: 2, interviews: 1, rejections: 0 },
      outreach: { ...base.outreach, sent: 5 },
    });
    expect(recs.map((r) => r.id)).toEqual(["keep_pace", "review_stats", "practice_interview"]);
  });

  it("orders by priority: missing profile, saved jobs to apply to, low response rate", () => {
    const recs = recommend({
      ...base,
      hasProfile: false,
      totals: { ...base.totals, applied: 20, responded: 1, saved: 4 },
      responseRate: 0.05,
      activity: { ...base.activity, applied: 1 },
    });
    expect(recs.map((r) => r.id)).toEqual(["complete_profile", "apply_saved", "boost_response"]);
    expect(recs[1].basis).toEqual({ applied: 1, target: WEEKLY_APPLY_TARGET, saved: 4 });
    expect(recs[2].basis).toEqual({ rate: 5, responded: 1, applied: 20 });
  });

  it("suggests interview prep when the drop-off is after the response", () => {
    const recs = recommend({
      ...base,
      activity: { ...base.activity, applied: 6 },
      outreach: { ...base.outreach, sent: 4 },
      responseRate: 0.4,
      bottleneck: { from: "responded", to: "interviewed", rate: 0.1 },
    });
    expect(recs[0]).toMatchObject({ id: "interview_prep", href: "/interview", basis: { rate: 10 } });
  });

  it("every recommendation has wording in both languages with no leftover placeholders", () => {
    const all = [
      ...recommend({ ...base, hasProfile: false, responseRate: 0.05, outreach: { ...base.outreach, waiting: 2 } }),
      ...recommend({
        ...base,
        activity: { ...base.activity, applied: 9 },
        outreach: { ...base.outreach, sent: 9 },
      }),
    ];
    for (const loc of ["he", "en"] as const) {
      for (const id of Object.keys(coachStrings("en").rec)) expect(coachStrings(loc).rec[id as never]).toBeTruthy();
      for (const r of all) {
        const t = recText(loc, r);
        expect(t.title + t.detail).not.toMatch(/\{\w+\}/);
      }
    }
    const stuck = recText("he", {
      id: "follow_up_stuck",
      href: "/dashboard",
      basis: { count: 2, stage: "APPLIED", stageCount: 2, days: 20 },
    });
    expect(stuck.detail).toContain("„הוגש”");
  });
});

describe("normalizeCoachAi", () => {
  const data = buildCoachData({ apps: [app("a")], contacts: [], hasProfile: true, now: NOW });
  const ids = data.recommendations.map((r) => r.id);
  const recs = ids.map((id) => ({ id, title: "צעד", detail: "פירוט" }));

  it("accepts output covering exactly the rule ids", () => {
    const ai = normalizeCoachAi({ summary: "שבוע עם 1 הגשה", recs }, data);
    expect(ai?.summary).toBe("שבוע עם 1 הגשה");
    expect(Object.keys(ai!.recs).sort()).toEqual([...ids].sort());
  });

  it("rejects invented numbers, missing ids and bad shapes", () => {
    expect(normalizeCoachAi({ summary: "שלחת 47 הגשות", recs }, data)).toBeNull();
    expect(normalizeCoachAi({ summary: "ok", recs: recs.slice(0, 2) }, data)).toBeNull();
    expect(
      normalizeCoachAi({ summary: "ok", recs: [...recs.slice(0, 2), { id: "x", title: "a", detail: "b" }] }, data),
    ).toBeNull();
    expect(normalizeCoachAi({ nope: 1 }, data)).toBeNull();
  });
});

describe("generateCoachReport / runWeeklyCoach", () => {
  beforeEach(() => {
    store.users = [{ id: "u1" }];
    store.apps = [];
    store.contacts = [];
    store.profile = { id: "p1" };
    store.reports = [];
    store.notified = [];
    store.llm = { name: "mock", out: "" };
  });
  const row = (id: string) => ({
    id,
    title: "Dev",
    company: "Acme",
    status: "APPLIED",
    createdAt: d("2026-11-02T10:00:00Z"),
    appliedAt: d("2026-11-02T10:00:00Z"),
    statusChangedAt: null,
    source: "APP",
    jobId: null,
    job: null,
    statusChanges: [],
  });

  it("stores the week's report and notifies once per week (rule-based on mock)", async () => {
    store.apps = [row("a"), row("b")];
    const r = await generateCoachReport("u1", NOW);
    expect(r.sent).toBe(true);
    expect(store.reports[0]).toMatchObject({ userId: "u1", week: "2026-11-01" });
    expect(store.reports[0].create).toMatchObject({ aiSource: "offline" });
    const n = store.notified[0].n;
    expect(n).toMatchObject({ kind: "WEEKLY_COACH", url: "/coach", dedupeKey: "coach:2026-11-01" });
    expect(n.title).toBe("המאמן השבועי: 2 הגשות, 0 תגובות");
  });

  it("uses AI phrasing when valid, falls back on the daily limit", async () => {
    store.apps = [row("a")];
    const data = buildCoachData({
      apps: [app("a")],
      contacts: [],
      hasProfile: true,
      now: NOW,
    });
    store.llm = {
      name: "gemini",
      out: JSON.stringify({
        summary: "שבוע שקט",
        recs: data.recommendations.map((x) => ({ id: x.id, title: "t", detail: "d" })),
      }),
    };
    await generateCoachReport("u1", NOW);
    expect(store.reports[0].create).toMatchObject({ aiSource: "ai", ai: { summary: "שבוע שקט" } });
    expect(store.notified[0].n.body).toBe("שבוע שקט");
    store.llm = { name: "gemini", out: "", throwLimit: true };
    await generateCoachReport("u1", NOW);
    expect(store.reports[1].create).toMatchObject({ aiSource: "limited" });
  });

  it("refresh (send: false) never notifies; empty users are stored but not notified", async () => {
    store.apps = [row("a")];
    await generateCoachReport("u1", NOW, { send: false });
    store.apps = [];
    const r = await generateCoachReport("u1", NOW);
    expect(r.empty).toBe(true);
    expect(store.notified).toHaveLength(0);
  });

  it("runs from Sunday 09:00 Israel for users without a report for last week", async () => {
    store.apps = [row("a")];
    expect(await runWeeklyCoach(new Date("2026-11-08T05:00:00Z"))).toEqual({ due: 0, generated: 0, sent: 0 });
    const res = await runWeeklyCoach(NOW);
    expect(res).toEqual({ due: 1, generated: 1, sent: 1 });
    expect(store.findManyWhere).toMatchObject({ coachReports: { none: { week: "2026-11-01" } } });
  });

  it("notification text is built from the data", () => {
    const data = buildCoachData({ apps: [app("a")], contacts: [], hasProfile: true, now: NOW });
    const n = coachNotification("en", data);
    expect(n.title).toBe("Your weekly coach: 1 applications, 0 responses");
    expect(n.body.startsWith("This week: ")).toBe(true);
  });
});
