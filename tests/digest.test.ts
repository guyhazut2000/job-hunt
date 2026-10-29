import { describe, expect, it } from "vitest";
import {
  digestDue,
  digestIsEmpty,
  digestSections,
  digestSummary,
  digestTelegramHtml,
  digestWindowStart,
  emptyDigestData,
  fallbackSuggestions,
  parseDigestData,
  parseSuggestions,
  type DigestData,
} from "@/lib/digest/build";
import { digestFacts, normalizeSuggestions } from "@/lib/digest/ai";
import { reminderStrings } from "@/lib/i18n/reminders";
import {
  buildInterviewReminder,
  hoursUntil,
  interviewDedupeKey,
  interviewReminderStage,
} from "@/lib/notifications/interviews";
import { israelLocalToUtc, toIsraelLocalInput } from "@/lib/notifications/israel-time";
import { inLearningSlot, planLearningReminder, type LearningSnapshot } from "@/lib/notifications/learning";
import { CAP_EXEMPT, channelEnabled, NOTIFICATION_KINDS } from "@/lib/notifications/kinds";
import { cleanWeekdays, DEFAULT_PREFS, toEffective } from "@/lib/notifications/prefs";
import { telegramText } from "@/lib/notifications/senders";

const H = 3_600_000;
// Wednesday 4 Nov 2026, 10:00 UTC = 12:00 Israel (winter, UTC+2).
const now = new Date("2026-11-04T10:00:00Z");

describe("Israel wall time", () => {
  it("converts datetime-local values in winter and summer", () => {
    expect(israelLocalToUtc("2026-11-05T14:00")?.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(israelLocalToUtc("2026-07-01T14:00")?.toISOString()).toBe("2026-07-01T11:00:00.000Z");
  });
  it("round-trips and rejects junk", () => {
    expect(toIsraelLocalInput(new Date("2026-11-05T12:00:00Z"))).toBe("2026-11-05T14:00");
    expect(toIsraelLocalInput(israelLocalToUtc("2026-03-30T09:15")!)).toBe("2026-03-30T09:15");
    expect(israelLocalToUtc("tomorrow")).toBeNull();
    expect(israelLocalToUtc("2026-13-01T10:00")).toBeNull();
  });
});

describe("interview reminders", () => {
  const at = (h: number) => new Date(now.getTime() + h * H);
  it("picks the 24h and 2h windows (wide enough for hourly cron jitter)", () => {
    expect(interviewReminderStage(at(30), now)).toBeNull();
    expect(interviewReminderStage(at(26.5), now)).toBe("24h");
    expect(interviewReminderStage(at(5), now)).toBe("24h");
    expect(interviewReminderStage(at(2.9), now)).toBe("2h");
    expect(interviewReminderStage(at(0.5), now)).toBe("2h");
    expect(interviewReminderStage(at(-0.1), now)).toBeNull();
  });
  it("dedupes per application, date and stage (a moved date reminds again)", () => {
    expect(interviewDedupeKey("a1", at(5), "24h")).not.toBe(interviewDedupeKey("a1", at(6), "24h"));
    expect(interviewDedupeKey("a1", at(5), "24h")).not.toBe(interviewDedupeKey("a1", at(5), "2h"));
  });
  it("builds a localized message", () => {
    expect(hoursUntil(at(2.2), now)).toBe(2);
    const m = buildInterviewReminder(
      "en",
      { id: "a", title: "Backend Engineer", company: "Acme", interviewAt: at(2.2), interviewNote: "Zoom link in mail" },
      "2h",
      now,
    );
    expect(m.title).toContain("Acme");
    expect(m.body).toContain("Backend Engineer");
    expect(m.body).toContain("Zoom link in mail");
    const he = buildInterviewReminder(
      "he",
      { id: "a", title: "x", company: "Acme", interviewAt: at(20), interviewNote: null },
      "24h",
      now,
    );
    expect(he.title).toContain("ראיון");
  });
});

describe("learning reminders", () => {
  const prefs = { learningEnabled: true, learningHour: 12, learningDays: [0, 1, 2, 3, 4] };
  it("fires only in the slot (weekday + hour … +3h, Israel time)", () => {
    expect(inLearningSlot(prefs, now)).toBe(true); // Wed 12:00
    expect(inLearningSlot(prefs, new Date(now.getTime() + 3 * H))).toBe(true); // 15:00
    expect(inLearningSlot(prefs, new Date(now.getTime() + 4 * H))).toBe(false); // 16:00
    expect(inLearningSlot(prefs, new Date(now.getTime() - H))).toBe(false); // 11:00
    expect(inLearningSlot({ ...prefs, learningDays: [5, 6] }, now)).toBe(false);
    expect(inLearningSlot({ ...prefs, learningEnabled: false }, now)).toBe(false);
  });

  const snap = (over: Partial<LearningSnapshot> = {}): LearningSnapshot => ({
    lastActivity: new Date(now.getTime() - 26 * H),
    streak: 4,
    reviewsDue: 0,
    overdue: [],
    next: { skill: "react", stage: "fundamentals", label: "React" },
    ...over,
  });

  it("stays silent for people who never studied or already studied today", () => {
    expect(planLearningReminder(snap({ lastActivity: null }), 2, now, "en")).toBeNull();
    expect(planLearningReminder(snap({ lastActivity: new Date(now.getTime() - H) }), 2, now, "en")).toBeNull();
  });
  it("leads with a streak at risk and links the next topic", () => {
    const r = planLearningReminder(snap({ reviewsDue: 3 }), 2, now, "en")!;
    expect(r.reasons).toEqual(["streak", "reviews"]);
    expect(r.title).toContain("4-day");
    expect(r.body).toContain("3 review questions");
    expect(r.url).toBe("/learn/react/fundamentals");
  });
  it("nudges after the idle threshold, not before", () => {
    const idle3 = snap({ streak: 0, lastActivity: new Date(now.getTime() - 3 * 24 * H), next: null });
    expect(planLearningReminder(idle3, 2, now, "he")?.reasons).toEqual(["idle"]);
    expect(planLearningReminder(idle3, 2, now, "he")?.url).toBe("/learn/me");
    expect(planLearningReminder(idle3, 5, now, "he")).toBeNull();
  });
});

function sample(): DigestData {
  const d = emptyDigestData("2026-11-04", new Date(now.getTime() - 24 * H), now);
  d.newJobs = {
    fromSearches: 2,
    searches: [{ id: "s1", name: "Backend TLV", count: 2 }],
    matchCount: 3,
    top: [{ id: "j1", title: "Backend Engineer", company: "Acme", score: 88 }],
  };
  d.statusChanges = [{ id: "a1", title: "SRE", company: "Globex", status: "INTERVIEW", stage: null }];
  d.followUps = [{ id: "a2", title: "Dev", company: "Initech", days: 9, jobId: null }];
  d.interviews = [
    { id: "a1", title: "SRE", company: "Globex", at: "2026-11-05T12:00:00.000Z", note: null, jobId: "j9" },
  ];
  d.scans = { runs: 10, failed: 2, companies: ["Globex"] };
  d.pipeline = { ...d.pipeline, saved: 6, staleSaved: 4, screening: 1, stuckScreening: 1, interview: 1 };
  d.learning = {
    streak: 3,
    minutesThisWeek: 40,
    activeDaysThisWeek: 2,
    goalHours: 5,
    reviewsDue: 2,
    next: { label: "React", url: "/learn/react" },
  };
  return d;
}

describe("daily digest", () => {
  it("knows an empty day", () => {
    const e = emptyDigestData("2026-11-04", now, now);
    expect(digestIsEmpty(e)).toBe(true);
    expect(digestIsEmpty(sample())).toBe(false);
    expect(digestSummary(e, "en")).toBe(reminderStrings("en").sumQuiet);
  });
  it("builds sections and a summary", () => {
    const secs = digestSections(sample(), "en");
    expect(secs.map((s) => s.key)).toEqual(["jobs", "status", "followups", "interviews", "learning", "scans"]);
    expect(secs[0].items[0]).toEqual({ text: "Backend Engineer · Acme (88%)", url: "/jobs/j1" });
    const sum = digestSummary(sample(), "en");
    expect(sum).toContain("3 new jobs");
    expect(sum).toContain("1 follow-ups");
    expect(sum).toContain("2 failed scans");
    // Hebrew renders from the same stored data.
    expect(digestSections(sample(), "he")[0].title).toBe(reminderStrings("he").dgJobs);
  });
  it("suggests concrete rule-based steps, max 4, interview first", () => {
    const s = fallbackSuggestions(sample(), "en");
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s[0].title).toContain("Globex");
    expect(s[0].url).toBe("/jobs/j9");
    const quiet = fallbackSuggestions(emptyDigestData("2026-11-04", now, now), "he");
    expect(quiet.length).toBeGreaterThan(0);
  });
  it("renders Telegram HTML within the message limit, escaped, with the link", () => {
    const d = sample();
    d.newJobs.top = Array.from({ length: 5 }, (_, i) => ({
      id: `j${i}`,
      title: `<Dev ${i}> ${"x".repeat(300)}`,
      company: "A&B",
    }));
    const html = digestTelegramHtml(d, fallbackSuggestions(d, "en"), "en", "https://example.test/digest/1", 1500);
    expect(html.length).toBeLessThanOrEqual(1500);
    expect(html).not.toContain("<Dev");
    expect(html).toContain("https://example.test/digest/1");
    expect(html).toContain(reminderStrings("en").dgStreamline);
    // The send path uses the prerendered HTML verbatim.
    expect(telegramText({ id: "n1", title: "t", telegramHtml: html })).toBe(html);
  });
  it("is due once, after the chosen hour", () => {
    expect(digestDue({ digestEnabled: true, digestHour: 8 }, 7, false)).toBe(false);
    expect(digestDue({ digestEnabled: true, digestHour: 8 }, 8, false)).toBe(true);
    expect(digestDue({ digestEnabled: true, digestHour: 8 }, 22, false)).toBe(true);
    expect(digestDue({ digestEnabled: true, digestHour: 8 }, 9, true)).toBe(false);
    expect(digestDue({ digestEnabled: false, digestHour: 8 }, 9, false)).toBe(false);
  });
  it("covers the time since the last digest, at most a week", () => {
    expect(digestWindowStart(null, now).getTime()).toBe(now.getTime() - 24 * H);
    const last = new Date(now.getTime() - 30 * H);
    expect(digestWindowStart(last, now)).toEqual(last);
    expect(digestWindowStart(new Date(now.getTime() - 30 * 24 * H), now).getTime()).toBe(now.getTime() - 7 * 24 * H);
  });
  it("parses stored data and suggestions defensively", () => {
    expect(parseDigestData(null)).toBeNull();
    expect(parseDigestData({ version: 2, day: "x" })).toBeNull();
    const round = parseDigestData(JSON.parse(JSON.stringify(sample())));
    expect(round?.newJobs.top[0].id).toBe("j1");
    expect(parseSuggestions([{ title: "a", detail: "b", url: "//evil.test" }, { nope: 1 }, "x"])).toEqual([
      { title: "a", detail: "b" },
    ]);
  });
  it("validates AI suggestions and keeps PII out of the prompt", () => {
    expect(normalizeSuggestions({ suggestions: [] })).toBeNull();
    expect(normalizeSuggestions({ suggestions: [{ title: " Do X ", detail: "because" }] })).toEqual([
      { title: "Do X", detail: "because" },
    ]);
    expect(normalizeSuggestions("garbage")).toBeNull();
    const d = sample();
    d.interviews[0].note = "call +972-50-0000000";
    expect(JSON.stringify(digestFacts(d))).not.toContain("+972");
  });
});

describe("new notification kinds and prefs", () => {
  it("adds the kinds with sensible channel defaults", () => {
    expect(NOTIFICATION_KINDS).toEqual(expect.arrayContaining(["INTERVIEW", "LEARNING", "DIGEST"]));
    expect(channelEnabled({}, "INTERVIEW", "telegram")).toBe(true);
    expect(channelEnabled({}, "DIGEST", "telegram")).toBe(true);
    expect(channelEnabled({}, "DIGEST", "push")).toBe(false);
    expect(channelEnabled({ DIGEST: { telegram: false } }, "DIGEST", "telegram")).toBe(false);
    expect(CAP_EXEMPT).toEqual(expect.arrayContaining(["INTERVIEW", "DIGEST"]));
  });
  it("defaults and cleans the schedule", () => {
    expect(toEffective(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.digestHour).toBe(8);
    expect(cleanWeekdays(["3", "1", "9", "1", "x"])).toEqual([1, 3]);
  });
});
