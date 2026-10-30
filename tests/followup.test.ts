import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  apps: [] as Array<Record<string, unknown>>,
  candidates: [] as Array<{ applicationId: string; receivedAt: Date }>,
  notifications: [] as Array<Record<string, unknown>>,
  deliveries: [] as Array<{ notificationId: string; channelId: string; nextAttemptAt: Date }>,
  prefs: null as Record<string, unknown> | null,
  llm: { name: "mock", complete: async (): Promise<string> => "" } as {
    name: string;
    complete: (...a: unknown[]) => Promise<string>;
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    application: { findMany: vi.fn(async () => store.apps) },
    emailCandidate: { findMany: vi.fn(async () => store.candidates) },
    notificationPreference: { findUnique: vi.fn(async () => store.prefs) },
    notificationChannel: { findMany: vi.fn(async () => [{ id: "tg", type: "TELEGRAM" }]) },
    notification: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (store.notifications.some((n) => n.userId === data.userId && n.dedupeKey === data.dedupeKey))
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
        store.notifications.push(data);
        return { id: `n${store.notifications.length}` };
      }),
    },
    notificationDelivery: {
      createMany: vi.fn(async ({ data }: { data: typeof store.deliveries }) => {
        store.deliveries.push(...data);
      }),
    },
  },
}));

vi.mock("@/lib/ai", () => ({ guardedLLM: vi.fn(async () => store.llm) }));

import { AiLimitError } from "@/lib/ai/errors";
import {
  gmailComposeLink,
  mailtoLink,
  recruiterFrom,
  templateDraft,
  validateAiDraft,
  type FollowUpFacts,
} from "@/lib/followup/draft";
import { generateDraft } from "@/lib/followup/server";
import { followUpDedupeKey, followUpState, type FollowUpApp } from "@/lib/followup/timing";
import { runFollowUpReminders } from "@/lib/notifications/reminders";

const D = (s: string) => new Date(s);
const prefs = { followUpEnabled: true, followUpDays: 10 };
const applied = D("2026-10-01T09:00:00Z");
const base: FollowUpApp = { id: "a1", status: "APPLIED", appliedAt: applied, createdAt: applied };

describe("follow-up timing", () => {
  it("waits N days (default 10) from the application date", () => {
    expect(followUpState(base, prefs, D("2026-10-10T09:00:00Z")).kind).toBe("waiting");
    const s = followUpState(base, prefs, D("2026-10-11T09:00:00Z"));
    expect(s).toMatchObject({ kind: "due", round: 1, days: 10 });
  });
  it("respects the user's N and clamps silly values", () => {
    expect(followUpState(base, { ...prefs, followUpDays: 3 }, D("2026-10-04T10:00:00Z")).kind).toBe("due");
    expect(followUpState(base, { ...prefs, followUpDays: 999 }, D("2026-11-20T10:00:00Z")).kind).toBe("waiting");
  });
  it("a status change moves the anchor", () => {
    const app = { ...base, statusChangedAt: D("2026-10-08T09:00:00Z") };
    expect(followUpState(app, prefs, D("2026-10-12T09:00:00Z")).kind).toBe("waiting");
    expect(followUpState(app, prefs, D("2026-10-18T09:00:00Z")).kind).toBe("due");
  });
  it("sent follow-up resets the timer; 2nd round after N more days; then the no-response suggestion", () => {
    const one = { ...base, followUpCount: 1, lastFollowUpAt: D("2026-10-12T09:00:00Z") };
    expect(followUpState(one, prefs, D("2026-10-20T09:00:00Z")).kind).toBe("waiting");
    expect(followUpState(one, prefs, D("2026-10-22T09:00:00Z"))).toMatchObject({ kind: "due", round: 2 });
    const two = { ...base, followUpCount: 2, lastFollowUpAt: D("2026-10-23T09:00:00Z") };
    expect(followUpState(two, prefs, D("2026-10-30T09:00:00Z")).kind).toBe("waiting");
    expect(followUpState(two, prefs, D("2026-11-03T09:00:00Z")).kind).toBe("ghost");
  });
  it("snooze hides the reminder until it ends, then re-arms it", () => {
    const app = { ...base, followUpSnoozedUntil: D("2026-10-14T09:00:00Z") };
    expect(followUpState(app, prefs, D("2026-10-12T09:00:00Z")).kind).toBe("snoozed");
    const s = followUpState(app, prefs, D("2026-10-15T09:00:00Z"));
    expect(s).toMatchObject({ kind: "due", snoozedUntil: D("2026-10-14T09:00:00Z") });
  });
});

describe("follow-up stop conditions", () => {
  const late = D("2026-11-20T09:00:00Z");
  it.each(["SCREENING", "INTERVIEW", "OFFER", "REJECTED", "SAVED"])("stops on status %s", (status) => {
    expect(followUpState({ ...base, status }, prefs, late)).toEqual({ kind: "stopped", reason: "status" });
  });
  it("stops on don't-remind, no-response, an email reply, or reminders disabled", () => {
    expect(followUpState({ ...base, followUpOff: true }, prefs, late)).toMatchObject({ reason: "off" });
    expect(followUpState({ ...base, noResponseAt: late }, prefs, late)).toMatchObject({ reason: "no_response" });
    expect(followUpState(base, prefs, late, { emailResponse: true })).toMatchObject({ reason: "email_response" });
    expect(followUpState(base, { ...prefs, followUpEnabled: false }, late)).toMatchObject({ reason: "disabled" });
  });
});

describe("dedupe keys", () => {
  it("keeps the legacy key for a plain first reminder", () => {
    const s = followUpState(base, prefs, D("2026-10-12T09:00:00Z"));
    expect(followUpDedupeKey(base, s)).toBe("followup:a1:2026-10-01");
  });
  it("differs per round, snooze and ghost", () => {
    const one = { ...base, followUpCount: 1, lastFollowUpAt: D("2026-10-12T09:00:00Z") };
    expect(followUpDedupeKey(one, followUpState(one, prefs, D("2026-10-23T09:00:00Z")))).toBe(
      "followup:a1:r2:2026-10-12",
    );
    const sn = { ...base, followUpSnoozedUntil: D("2026-10-14T09:00:00Z") };
    expect(followUpDedupeKey(sn, followUpState(sn, prefs, D("2026-10-15T09:00:00Z")))).toBe(
      "followup:a1:r1:2026-10-01:s2026-10-14",
    );
    const two = { ...base, followUpCount: 2, lastFollowUpAt: D("2026-10-23T09:00:00Z") };
    expect(followUpDedupeKey(two, followUpState(two, prefs, D("2026-11-03T09:00:00Z")))).toBe(
      "followup:a1:ghost:2026-10-23",
    );
    expect(followUpDedupeKey(base, followUpState(base, prefs, D("2026-10-05T09:00:00Z")))).toBeNull();
  });
});

describe("runFollowUpReminders (cron)", () => {
  const app = (over: Record<string, unknown> = {}) => ({
    ...base,
    userId: "u1",
    title: "Frontend Developer",
    company: "Wix",
    statusChangedAt: null,
    followUpCount: 0,
    lastFollowUpAt: null,
    followUpSnoozedUntil: null,
    followUpOff: false,
    noResponseAt: null,
    jobId: null,
    user: { locale: "he", notificationPrefs: store.prefs },
    ...over,
  });
  beforeEach(() => {
    store.notifications = [];
    store.deliveries = [];
    store.candidates = [];
    store.prefs = null;
  });

  it("is idempotent: a second run creates nothing", async () => {
    store.apps = [app(), app({ id: "a2" })];
    const now = D("2026-10-12T09:00:00Z"); // 12:00 Israel — not quiet
    expect(await runFollowUpReminders(now)).toEqual({ reminded: 2 });
    expect(await runFollowUpReminders(now)).toEqual({ reminded: 0 });
    expect(await runFollowUpReminders(D("2026-10-13T09:00:00Z"))).toEqual({ reminded: 0 });
    expect(store.notifications).toHaveLength(2);
    expect(store.notifications[0]).toMatchObject({
      kind: "FOLLOW_UP",
      url: "/dashboard?followup=a1#app-a1",
      dedupeKey: "followup:a1:2026-10-01",
    });
    expect(String(store.notifications[0].title)).toContain("Frontend Developer");
  });

  it("skips applications with an email reply", async () => {
    store.apps = [app(), app({ id: "a2" })];
    store.candidates = [{ applicationId: "a2", receivedAt: D("2026-10-05T09:00:00Z") }];
    expect(await runFollowUpReminders(D("2026-10-12T09:00:00Z"))).toEqual({ reminded: 1 });
    expect(store.notifications.map((n) => (n.data as { applicationId: string }).applicationId)).toEqual(["a1"]);
  });

  it("holds Telegram/push until quiet hours end", async () => {
    store.apps = [app()];
    const night = D("2026-10-12T20:30:00Z"); // 23:30 Israel (IDT, UTC+3) — inside 22–07
    await runFollowUpReminders(night);
    expect(store.notifications).toHaveLength(1); // in-site right away
    expect(store.deliveries[0].nextAttemptAt.toISOString()).toBe("2026-10-13T04:00:00.000Z"); // 07:00 Israel
  });

  it("digest mode sends no instant deliveries", async () => {
    store.prefs = {
      quietEnabled: false,
      quietStart: 22,
      quietEnd: 7,
      quietShabbat: false,
      followUpEnabled: true,
      followUpDays: 10,
      maxPerHour: 6,
      channels: {},
      modes: { FOLLOW_UP: "digest" },
    };
    store.apps = [app({ user: { locale: "he", notificationPrefs: store.prefs } })];
    await runFollowUpReminders(D("2026-10-12T09:00:00Z"));
    expect(store.notifications[0].data).toMatchObject({ delivery: "digest" });
    expect(store.deliveries).toHaveLength(0);
  });
});

const facts: FollowUpFacts = {
  title: "Frontend Developer",
  company: "Wix",
  appliedAt: applied,
  round: 1,
  highlight: "Built a React design system used by 40 engineers.",
  skills: ["React"],
  name: "Guy Hazut",
  recipientName: "Dana",
};

describe("drafts", () => {
  it("templates are short, personal and placeholder-free in both languages", () => {
    for (const lang of ["he", "en"] as const) {
      for (const round of [1, 2] as const) {
        const d = templateDraft({ ...facts, round }, lang, "dana@wix.com");
        expect(d).toMatchObject({ lang, round, source: "template", to: "dana@wix.com" });
        expect(d.body).toContain("Wix");
        expect(d.body).not.toMatch(/\[|\{/);
        expect(d.body.split(/\s+/).length).toBeLessThan(160);
      }
    }
    expect(templateDraft(facts, "he").subject).toContain("Frontend Developer");
  });

  it("falls back to the template with the mock provider, on AI errors, limits and bad output", async () => {
    store.llm = { name: "mock", complete: async () => "" };
    expect((await generateDraft("u1", facts, "en", null)).source).toBe("template");
    store.llm = {
      name: "gemini",
      complete: async () => {
        throw new Error("boom");
      },
    };
    expect((await generateDraft("u1", facts, "en", null)).source).toBe("template");
    store.llm = {
      name: "gemini",
      complete: async () => {
        throw new AiLimitError("daily");
      },
    };
    expect((await generateDraft("u1", facts, "en", null)).source).toBe("limited");
    store.llm = { name: "gemini", complete: async () => JSON.stringify({ subject: "Hi", body: "Dear [Name]" }) };
    expect((await generateDraft("u1", facts, "en", null)).source).toBe("template");
  });

  it("uses a valid AI draft", async () => {
    const body =
      "Hi Dana,\n\nI applied for the Frontend Developer role at Wix on 1 October and wanted to follow up. I'd be glad to share more.\n\nThanks,\nGuy";
    store.llm = { name: "gemini", complete: async () => JSON.stringify({ subject: "Following up", body }) };
    expect(await generateDraft("u1", facts, "en", "dana@wix.com")).toMatchObject({ source: "ai", body });
  });

  it("validateAiDraft rejects drafts that ignore the job", () => {
    expect(
      validateAiDraft(
        { subject: "Hello there", body: "Just checking in about my application, any news yet? Thanks!" },
        facts,
      ),
    ).toBeNull();
  });

  it("recruiter detection skips system senders", () => {
    expect(recruiterFrom("Dana Cohen <dana@wix.com>")).toEqual({ email: "dana@wix.com", firstName: "Dana" });
    expect(recruiterFrom("Wix Careers <no-reply@wix.com>")).toBeNull();
    expect(recruiterFrom("notifications@greenhouse.io")).toBeNull();
  });

  it("builds mailto and Gmail compose links (the app never sends)", () => {
    const d = { to: "dana@wix.com", subject: "מעקב: Frontend", body: "שלום\nתודה" };
    const m = mailtoLink(d);
    expect(m.startsWith("mailto:dana@wix.com?")).toBe(true);
    expect(decodeURIComponent(m)).toContain("שלום\nתודה");
    const g = new URL(gmailComposeLink(d));
    expect(g.origin + g.pathname).toBe("https://mail.google.com/mail/");
    expect(g.searchParams.get("view")).toBe("cm");
    expect(g.searchParams.get("to")).toBe("dana@wix.com");
    expect(g.searchParams.get("su")).toBe(d.subject);
    expect(mailtoLink({ ...d, to: null }).startsWith("mailto:?")).toBe(true);
  });
});
