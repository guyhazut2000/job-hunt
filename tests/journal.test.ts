import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import {
  acceptJournalBullet,
  defaultRole,
  inPeriod,
  reminderDue,
  roleKey,
  ruleInsights,
  ruleJournalBullets,
  sanitizeInsights,
  sentences,
  stripTimeLead,
  type JournalEntryLite,
} from "@/lib/journal/core";
import { extractInsights, suggestJournalBullets } from "@/lib/journal/ai";

const GUY = "ביום ראשון פיתחתי אוטומציה שמאפשרת להעביר קבצים משרת לשרת, ועזרתי לפתח מערכת שמתקשרת עם מערכת אחרת.";

const llm = (answer: unknown | Error): LLMProvider => ({
  name: "openai",
  complete: async () => {
    if (answer instanceof Error) throw answer;
    return JSON.stringify(answer);
  },
});
const mock: LLMProvider = { name: "mock", complete: async () => "{}" };

const entry = (over: Partial<JournalEntryLite> = {}): JournalEntryLite => ({
  id: "e1",
  day: "2026-11-15",
  text: GUY,
  answers: [],
  insights: null,
  ...over,
});

describe("work journal — reading entries", () => {
  it("splits the example entry into two achievements and drops the time lead", () => {
    const s = sentences(GUY);
    expect(s).toHaveLength(2);
    expect(s[0]).toBe("פיתחתי אוטומציה שמאפשרת להעביר קבצים משרת לשרת");
    expect(s[1]).toBe("עזרתי לפתח מערכת שמתקשרת עם מערכת אחרת");
    expect(stripTimeLead("On Sunday, built a CI pipeline")).toBe("built a CI pipeline");
  });

  it("rules reading asks about time saved and the integration, max 3 questions", () => {
    const r = ruleInsights(GUY, "he");
    expect(r.source).toBe("rules");
    expect(r.achievements).toHaveLength(2);
    expect(r.questions.length).toBeGreaterThanOrEqual(2);
    expect(r.questions.length).toBeLessThanOrEqual(3);
    expect(r.questions[0]).toMatch(/אוטומציה/);
    expect(r.questions.join(" ")).toMatch(/מערכות/);
  });

  it("finds tech from the taxonomy in English entries", () => {
    const r = ruleInsights("Built a Python script that syncs Jira tickets to Slack", "en");
    expect(r.achievements[0].tech).toContain("Python");
  });

  it("drops model tech and numbers the entry doesn't support", () => {
    const s = sanitizeInsights(
      {
        achievements: [
          {
            action: "Built a file transfer automation",
            tech: ["Python", "Kafka"],
            systems: ["SFTP"],
            impact: "Saved 40 hours a week",
          },
          { action: "Moved 500 servers", tech: [], systems: [], impact: null },
        ],
        questions: ["How much time does it save?", "a?", "b?", "c?"].filter((q) => q.length > 3),
      },
      "Built a Python automation that moves files between servers over SFTP",
    );
    expect(s.achievements).toHaveLength(1);
    expect(s.achievements[0].tech).toEqual(["Python"]);
    expect(s.achievements[0].impact).toBeNull();
  });

  it("keeps a number the user gave in an answer", () => {
    const s = sanitizeInsights(
      {
        achievements: [{ action: "Built an automation", tech: [], systems: [], impact: "Saves about 6 hours a week" }],
        questions: [],
      },
      "Built an automation",
      [{ q: "time saved?", a: "6 hours a week" }],
    );
    expect(s.achievements[0].impact).toBe("Saves about 6 hours a week");
  });

  it("AI off → rules with status off; limit → limited; bad JSON → error", async () => {
    expect((await extractInsights(mock, { text: GUY, role: "", lang: "he" })).status).toBe("off");
    expect(
      (await extractInsights(llm(new AiLimitError("user_daily", "x")), { text: GUY, role: "", lang: "he" })).status,
    ).toBe("limited");
    expect((await extractInsights(llm({ nope: 1 }), { text: GUY, role: "", lang: "he" })).status).toBe("error");
  });

  it("AI reading validated and kept", async () => {
    const r = await extractInsights(
      llm({
        achievements: [
          {
            action: "פיתחתי אוטומציה להעברת קבצים בין שרתים",
            tech: [],
            systems: ["שרתי קבצים"],
            impact: "חיסכון בעבודה ידנית",
          },
        ],
        questions: ["כמה זמן זה חוסך בשבוע?"],
      }),
      { text: GUY, role: "Developer", lang: "he" },
    );
    expect(r.source).toBe("ai");
    expect(r.status).toBe("ok");
    expect(r.questions).toEqual(["כמה זמן זה חוסך בשבוע?"]);
  });
});

describe("work journal — bullets", () => {
  it("accepts placeholders, rejects invented numbers / tech / repeats", () => {
    const facts = GUY;
    expect(
      acceptJournalBullet("פיתחתי אוטומציה להעברת קבצים בין שרתים, שחסכה [N] שעות בשבוע", facts, "", []),
    ).toBeTruthy();
    expect(
      acceptJournalBullet("פיתחתי אוטומציה להעברת קבצים בין שרתים, שחסכה 20 שעות בשבוע", facts, "", []),
    ).toBeNull();
    expect(acceptJournalBullet("Built a Kafka pipeline moving files between servers", facts, "", [])).toBeNull();
    expect(
      acceptJournalBullet("פיתחתי אוטומציה שמאפשרת להעביר קבצים משרת לשרת", facts, "", [
        "פיתחתי אוטומציה שמאפשרת להעביר קבצים משרת לשרת",
      ]),
    ).toBeNull();
    // A number the user wrote in an answer is allowed.
    expect(
      acceptJournalBullet("בניתי אוטומציה להעברת קבצים שחוסכת 6 שעות בשבוע", `${facts}\nכמה זמן? 6 שעות`, "", []),
    ).toBeTruthy();
  });

  it("rules bullets add a placeholder clause or use the user's answer", () => {
    const b = ruleJournalBullets([entry()], "he", []);
    expect(b).toHaveLength(2);
    expect(b[0]).toBe("פיתחתי אוטומציה שמאפשרת להעביר קבצים משרת לשרת, מה ששיפר את [מדד] ב-[X%]");
    const withAnswer = ruleJournalBullets([entry({ answers: [{ q: "time?", a: "חוסך 6 שעות בשבוע" }] })], "he", []);
    expect(withAnswer[0]).toContain("(חוסך 6 שעות בשבוע)");
  });

  it("model bullets go through the check; all dropped → rules", async () => {
    const input = {
      role: "Developer · Acme",
      lang: "he" as const,
      entries: [entry()],
      existing: [],
      have: [],
      corpus: "",
    };
    const ok = await suggestJournalBullets(
      llm({
        bullets: [
          {
            text: "פיתחתי אוטומציה להעברת קבצים בין שרתים, שחסכה [N] שעות עבודה ידנית בשבוע",
            days: ["2026-11-15", "1999-01-01"],
          },
        ],
      }),
      input,
    );
    expect(ok.source).toBe("ai");
    expect(ok.bullets[0].days).toEqual(["2026-11-15"]);
    const bad = await suggestJournalBullets(
      llm({ bullets: [{ text: "פיתחתי אוטומציה שחסכה 90% מהזמן לצוות של 12", days: [] }] }),
      input,
    );
    expect(bad.source).toBe("rules");
    expect(bad.rejected).toBe(1);
    expect(bad.bullets.length).toBeGreaterThan(0);
    expect((await suggestJournalBullets(mock, input)).status).toBe("off");
    expect((await suggestJournalBullets(mock, { ...input, entries: [] })).bullets).toEqual([]);
  });
});

describe("work journal — roles, periods, reminders", () => {
  it("default role is the current one, else the latest", () => {
    expect(
      defaultRole([
        { start: "2020-01", end: "2022-01" },
        { start: "2022-02", end: "" },
      ])?.start,
    ).toBe("2022-02");
    expect(
      defaultRole([
        { start: "2019-01", end: "2020-01" },
        { start: "2021-01", end: "2022-01" },
      ])?.start,
    ).toBe("2021-01");
    expect(defaultRole([])).toBeNull();
    expect(roleKey(" Acme Ltd ", "Developer")).toBe(roleKey("acme ltd", "developer"));
  });

  it("period filter", () => {
    expect(inPeriod("2026-11-10", "2026-11-01", null)).toBe(true);
    expect(inPeriod("2026-10-10", "2026-11-01", null)).toBe(false);
    expect(inPeriod("2026-11-10", null, "2026-11-05")).toBe(false);
  });

  it("weekly reminder only on its day/hour, once, and not if already written", () => {
    const s = { reminderOn: true, frequency: "weekly", weekday: 4, hour: 17, lastRemindedAt: null };
    const now = new Date("2026-11-19T16:00:00Z"); // Thursday 18:00 Israel
    const clock = { day: 4, hour: 18, date: "2026-11-19" };
    expect(reminderDue(s, clock, null, now)).toBe(true);
    expect(reminderDue({ ...s, reminderOn: false }, clock, null, now)).toBe(false);
    expect(reminderDue(s, { ...clock, hour: 16 }, null, now)).toBe(false);
    expect(reminderDue(s, { ...clock, day: 3 }, null, now)).toBe(false);
    expect(reminderDue(s, clock, "2026-11-17", now)).toBe(false);
    expect(reminderDue(s, clock, "2026-11-01", now)).toBe(true);
    expect(reminderDue({ ...s, lastRemindedAt: new Date("2026-11-19T15:00:00Z") }, clock, null, now)).toBe(false);
    expect(reminderDue({ ...s, frequency: "daily" }, { ...clock, day: 1 }, "2026-11-18", now)).toBe(true);
  });
});
