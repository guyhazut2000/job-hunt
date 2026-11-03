import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/ai/types";
import {
  DEFAULT_PREFS,
  QUEUE_AUDIENCE,
  followUpDedupeKey,
  followUpDue,
  goalProgress,
  israelDay,
  pickQueue,
  prefsSchema,
  prevDay,
  statusPatch,
  type FollowUpContact,
} from "@/lib/outreach/assistant";
import { FOLLOW_UP_LIMIT, followUpTemplate, generateFollowUp } from "@/lib/outreach/followup";
import { NAME_TOKEN, type OutreachContext } from "@/lib/outreach/messages";

const DAY = 86_400_000;
// 2026-11-03 12:00 Israel time (UTC+2)
const NOW = new Date("2026-11-03T10:00:00Z");
const at = (daysAgo: number, hourUtc = 10) => new Date(Date.UTC(2026, 10, 3 - daysAgo, hourUtc));

const ctx: OutreachContext = {
  company: "Wix",
  job: { title: "Backend Engineer", url: "https://job-hunt.example/jobs/1" },
  candidate: { name: "Guy Hazut", headline: "Backend Engineer", years: 6, skills: ["Node.js", "Go", "Kafka"] },
};

describe("israel day helpers", () => {
  it("uses Israel time for the day boundary", () => {
    expect(israelDay(new Date("2026-11-02T22:30:00Z"))).toBe("2026-11-03"); // 00:30 IL
    expect(israelDay(new Date("2026-11-02T21:30:00Z"))).toBe("2026-11-02");
  });
  it("prevDay crosses months", () => {
    expect(prevDay("2026-11-01")).toBe("2026-10-31");
  });
});

describe("prefs", () => {
  it("validates ranges and coerces form strings", () => {
    expect(prefsSchema.safeParse({ dailyGoal: "4", followUpDays: "5", queueSize: "5" }).success).toBe(true);
    expect(prefsSchema.safeParse({ dailyGoal: 0, followUpDays: 5, queueSize: 5 }).success).toBe(false);
    expect(prefsSchema.safeParse({ dailyGoal: 3, followUpDays: 30, queueSize: 5 }).success).toBe(false);
    expect(DEFAULT_PREFS.dailyGoal).toBe(3);
  });
});

describe("goalProgress", () => {
  it("counts today and builds a 7-day week, today last", () => {
    const p = goalProgress([at(0), at(0, 8), at(1)], 3, NOW);
    expect(p.today).toBe(2);
    expect(p.met).toBe(false);
    expect(p.week).toHaveLength(7);
    expect(p.week[6]).toMatchObject({ day: "2026-11-03", count: 2 });
    expect(p.week[5]).toMatchObject({ day: "2026-11-02", count: 1 });
  });
  it("keeps yesterday's streak alive while today is still open", () => {
    const sent = [at(1), at(1), at(2), at(2), at(3)];
    expect(goalProgress(sent, 2, NOW).streak).toBe(2);
    expect(goalProgress([...sent, at(0), at(0)], 2, NOW).streak).toBe(3);
  });
  it("breaks the streak on a missed day", () => {
    expect(goalProgress([at(0), at(2)], 1, NOW).streak).toBe(1);
    expect(goalProgress([at(2), at(3)], 1, NOW).streak).toBe(0);
  });
});

describe("followUpDue", () => {
  const base: FollowUpContact = { status: "SENT", sentAt: null, statusAt: null, createdAt: at(30), followedUpAt: null };
  it("nudges an unanswered request after followUpDays", () => {
    expect(followUpDue({ ...base, sentAt: at(4) }, 5, NOW)).toBeNull();
    expect(followUpDue({ ...base, sentAt: at(5) }, 5, NOW)).toMatchObject({ kind: "nudge", days: 5 });
  });
  it("follows up an accepted request from the next day", () => {
    const c = { ...base, status: "ACCEPTED" as const, sentAt: at(10) };
    expect(followUpDue({ ...c, statusAt: new Date(NOW.getTime() - DAY / 2) }, 5, NOW)).toBeNull();
    expect(followUpDue({ ...c, statusAt: at(1) }, 5, NOW)).toMatchObject({ kind: "accepted", days: 1 });
  });
  it("never for replied/referred/not-contacted or after a follow-up", () => {
    for (const status of ["REPLIED", "REFERRED", "NOT_CONTACTED"] as const)
      expect(followUpDue({ ...base, status, sentAt: at(20) }, 5, NOW)).toBeNull();
    expect(followUpDue({ ...base, sentAt: at(20), followedUpAt: at(1) }, 5, NOW)).toBeNull();
  });
  it("dedupe key is stable per contact + kind + anchor day", () => {
    const due = followUpDue({ ...base, sentAt: at(6) }, 5, NOW)!;
    expect(followUpDedupeKey("c1", due)).toBe("outreach:c1:nudge:2026-10-28");
  });
});

describe("statusPatch", () => {
  it("sets sentAt once and always statusAt", () => {
    expect(statusPatch({ sentAt: null }, "SENT", NOW)).toEqual({ status: "SENT", statusAt: NOW, sentAt: NOW });
    const later = statusPatch({ sentAt: at(3) }, "REPLIED", NOW);
    expect(later.sentAt).toBeUndefined();
    expect(later.statusAt).toEqual(NOW);
    expect(statusPatch({ sentAt: null }, "NOT_CONTACTED", NOW).sentAt).toBeUndefined();
  });
});

describe("pickQueue", () => {
  const c = (source: "saved" | "applied" | "fresh", companyId: string, at: number) => ({
    source,
    companyId,
    jobId: `${companyId}-${at}`,
    at,
  });
  it("orders saved → applied → fresh, newest first, one per company, skipping recent", () => {
    const out = pickQueue(
      [
        c("fresh", "a", 9),
        c("applied", "b", 1),
        c("saved", "c", 2),
        c("saved", "c", 5),
        c("saved", "d", 3),
        c("fresh", "e", 1),
      ],
      new Set(["d"]),
      3,
    );
    expect(out.map((x) => `${x.source}:${x.companyId}:${x.at}`)).toEqual(["saved:c:5", "applied:b:1", "fresh:a:9"]);
  });
  it("maps each source to an audience", () => {
    expect(QUEUE_AUDIENCE).toEqual({ saved: "PEER", applied: "TEAM_LEAD", fresh: "RECRUITER" });
  });
});

describe("follow-up drafts", () => {
  it("templates in he and en carry the name token and the right ask", () => {
    const he = followUpTemplate("accepted", "PEER", ctx, "he");
    expect(he.text).toContain(NAME_TOKEN);
    expect(he.text).toContain("הפניה");
    expect(he.source).toBe("template");
    const en = followUpTemplate("nudge", "RECRUITER", ctx, "en");
    expect(en.text).toContain(NAME_TOKEN);
    expect(en.text).toMatch(/CV/);
    expect(followUpTemplate("nudge", "TEAM_LEAD", ctx, "en").text).toMatch(/chat/);
  });
  const fake = (out: string | Error): LLMProvider => ({
    name: "fake",
    complete: async () => {
      if (out instanceof Error) throw out;
      return out;
    },
  });
  it("mock provider → template", async () => {
    const m = await generateFollowUp({ name: "mock", complete: async () => "" }, "nudge", "PEER", ctx, "en");
    expect(m.source).toBe("template");
  });
  it("uses AI text when valid", async () => {
    const text = `Hi ${NAME_TOKEN}, thanks for connecting! I'd love a quick chat about the backend role at Wix.`;
    const m = await generateFollowUp(fake(JSON.stringify({ text })), "accepted", "PEER", ctx, "en");
    expect(m).toEqual({ text, source: "ai" });
  });
  it("falls back on errors, missing name token or too-long text", async () => {
    const noName = JSON.stringify({ text: "Hello there, thanks for connecting, would love a chat about the role!" });
    const long = JSON.stringify({ text: `Hi ${NAME_TOKEN} ` + "x".repeat(FOLLOW_UP_LIMIT) });
    for (const out of [new Error("boom"), noName, long, "not json"]) {
      const m = await generateFollowUp(fake(out), "nudge", "PEER", ctx, "en");
      expect(m.source).toBe("template");
    }
  });
});
