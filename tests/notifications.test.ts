import { afterEach, describe, expect, it } from "vitest";
import { backoffMs } from "@/lib/notifications/deliver";
import { channelEnabled, channelOfType, isKind, parseOverrides } from "@/lib/notifications/kinds";
import { clampHour, DEFAULT_QUIET, isQuiet, israelClock, nextAllowedAt } from "@/lib/notifications/quiet";
import { daysBetween, followUpDue } from "@/lib/notifications/reminders";
import {
  buildSearchAlert,
  defaultSearchName,
  normalizeSearchQuery,
  parseStoredQuery,
} from "@/lib/notifications/saved-search";
import { openPath, telegramText } from "@/lib/notifications/senders";
import { hashLinkCode, parseStartCode, validWebhookSecret } from "@/lib/notifications/telegram";
import { toEffective } from "@/lib/notifications/prefs";

// November 2026: Israel is on standard time (UTC+2).
const wed2300 = new Date("2026-11-04T21:00:00Z");
const wedNoon = new Date("2026-11-04T10:00:00Z");

describe("quiet hours", () => {
  it("reads the Israel clock regardless of server zone", () => {
    expect(israelClock(wed2300)).toEqual({ day: 3, hour: 23, minute: 0 });
    // Summer (UTC+3)
    expect(israelClock(new Date("2026-07-01T09:30:00Z")).hour).toBe(12);
  });

  it("wraps midnight", () => {
    expect(isQuiet(DEFAULT_QUIET, wed2300)).toBe(true);
    expect(isQuiet(DEFAULT_QUIET, new Date("2026-11-05T04:59:00Z"))).toBe(true); // 06:59
    expect(isQuiet(DEFAULT_QUIET, new Date("2026-11-05T05:00:00Z"))).toBe(false); // 07:00
    expect(isQuiet(DEFAULT_QUIET, wedNoon)).toBe(false);
  });

  it("handles non-wrapping windows, disabled and empty windows", () => {
    const p = { ...DEFAULT_QUIET, quietStart: 9, quietEnd: 17 };
    expect(isQuiet(p, wedNoon)).toBe(true);
    expect(isQuiet(p, wed2300)).toBe(false);
    expect(isQuiet({ ...DEFAULT_QUIET, quietEnabled: false }, wed2300)).toBe(false);
    expect(isQuiet({ ...DEFAULT_QUIET, quietStart: 5, quietEnd: 5 }, wed2300)).toBe(false);
  });

  it("covers Shabbat Friday 16:00 → Saturday 20:00", () => {
    const p = { ...DEFAULT_QUIET, quietEnabled: false, quietShabbat: true };
    expect(isQuiet(p, new Date("2026-11-06T13:30:00Z"))).toBe(false); // Fri 15:30
    expect(isQuiet(p, new Date("2026-11-06T15:00:00Z"))).toBe(true); // Fri 17:00
    expect(isQuiet(p, new Date("2026-11-07T17:00:00Z"))).toBe(true); // Sat 19:00
    expect(isQuiet(p, new Date("2026-11-07T18:30:00Z"))).toBe(false); // Sat 20:30
  });

  it("finds the next allowed moment", () => {
    expect(nextAllowedAt(DEFAULT_QUIET, wedNoon)).toBe(wedNoon);
    expect(nextAllowedAt(DEFAULT_QUIET, wed2300).toISOString()).toBe("2026-11-05T05:00:00.000Z");
    const shabbat = { ...DEFAULT_QUIET, quietShabbat: true };
    expect(nextAllowedAt(shabbat, new Date("2026-11-06T15:07:00Z")).toISOString()).toBe("2026-11-07T18:00:00.000Z");
  });

  it("clamps hours", () => {
    expect(clampHour("7", 1)).toBe(7);
    expect(clampHour(24, 1)).toBe(1);
    expect(clampHour("x", 22)).toBe(22);
  });
});

describe("kinds and channel overrides", () => {
  it("defaults everything on except SYSTEM", () => {
    expect(channelEnabled({}, "JOB_MATCH", "push")).toBe(true);
    expect(channelEnabled({}, "FOLLOW_UP", "telegram")).toBe(true);
    expect(channelEnabled({}, "SYSTEM", "push")).toBe(false);
  });

  it("parses overrides defensively", () => {
    const o = parseOverrides({ JOB_MATCH: { push: false, telegram: "yes" }, BOGUS: { push: true }, SYSTEM: null });
    expect(o).toEqual({ JOB_MATCH: { push: false } });
    expect(channelEnabled(o, "JOB_MATCH", "push")).toBe(false);
    expect(channelEnabled(o, "JOB_MATCH", "telegram")).toBe(true);
    expect(parseOverrides("nope")).toEqual({});
    expect(parseOverrides([1])).toEqual({});
  });

  it("maps channel types and validates kinds", () => {
    expect(channelOfType("WEB_PUSH")).toBe("push");
    expect(channelOfType("TELEGRAM")).toBe("telegram");
    expect(channelOfType("SMS")).toBeNull();
    expect(isKind("FOLLOW_UP")).toBe(true);
    expect(isKind("follow_up")).toBe(false);
  });

  it("falls back to default prefs", () => {
    const p = toEffective(null);
    expect(p).toMatchObject({ quietEnabled: true, quietStart: 22, quietEnd: 7, followUpDays: 10, maxPerHour: 6 });
  });
});

describe("saved searches", () => {
  it("normalises queries and drops view/sort/page", () => {
    const q = normalizeSearchQuery("?q=react&sort=newest&page=3&view=map&city=Tel+Aviv");
    expect(q).toContain("q=react");
    expect(q).not.toMatch(/sort=|page=|view=/);
    expect(normalizeSearchQuery(q)).toBe(q);
    expect(normalizeSearchQuery("sort=newest")).toBe("");
  });

  it("round-trips a stored query into filters", () => {
    const f = parseStoredQuery("q=react");
    expect(f.q).toBe("react");
    expect(f.page).toBe(1);
  });

  it("builds a readable default name", () => {
    const f = parseStoredQuery("q=react");
    expect(defaultSearchName(f, "All jobs")).toBe("react");
    expect(defaultSearchName(parseStoredQuery(""), "All jobs")).toBe("All jobs");
  });

  const job = (n: number) => ({
    id: `j${n}`,
    title: `Engineer ${n}`,
    location: "Tel Aviv",
    company: { name: `Co${n}` },
  });
  const search = { id: "s1", name: "react", query: "q=react" };

  it("links straight to a single new job", () => {
    const a = buildSearchAlert("en", search, [job(1)]);
    expect(a.url).toBe("/jobs/j1");
    expect(a.title).toContain("Engineer 1");
    expect(a.body).toContain("Co1");
  });

  it("groups many jobs and links to the newest-first search", () => {
    const a = buildSearchAlert("he", search, [1, 2, 3, 4, 5].map(job));
    expect(a.title).toContain("5");
    expect(a.body.split("\n")).toHaveLength(4); // 3 listed + "and 2 more"
    expect(a.url).toBe("/jobs?q=react&sort=newest");
  });
});

describe("follow-up reminders", () => {
  const now = new Date("2026-11-10T08:00:00Z");
  const appliedAt = new Date("2026-11-02T08:00:00Z");
  const app = { id: "a", status: "APPLIED", appliedAt, createdAt: appliedAt };
  it("is due after N days without a response", () => {
    expect(daysBetween(appliedAt, now)).toBe(8);
    expect(followUpDue(app, 7, now)).toBe(true);
    expect(followUpDue(app, 9, now)).toBe(false);
  });
  it("waits when the status changed recently or moved on", () => {
    const moved = new Date("2026-11-08T08:00:00Z");
    expect(followUpDue({ ...app, statusChangedAt: moved }, 7, now)).toBe(false);
    expect(followUpDue({ ...app, status: "INTERVIEW" }, 7, now)).toBe(false);
    expect(followUpDue({ ...app, appliedAt: null }, 7, now)).toBe(true);
  });
});

describe("delivery", () => {
  it("backs off exponentially", () => {
    expect(backoffMs(1)).toBe(5 * 60_000);
    expect(backoffMs(2)).toBe(10 * 60_000);
    expect(backoffMs(4)).toBe(40 * 60_000);
  });
  it("escapes Telegram HTML and links through the open route", () => {
    const t = telegramText({ id: "n1", title: "<b>R&D</b>", body: "a < b", url: "/jobs/1" }, "https://x.test");
    expect(t).toBe("<b>&lt;b&gt;R&amp;D&lt;/b&gt;</b>\na &lt; b\nhttps://x.test" + openPath("n1"));
    expect(telegramText({ id: "n2", title: "Hi" }, "https://x.test")).toBe("<b>Hi</b>");
  });
});

describe("telegram", () => {
  const prev = process.env.TELEGRAM_WEBHOOK_SECRET;
  afterEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = prev;
  });
  it("parses /start codes", () => {
    expect(parseStartCode("/start abcd1234")).toBe("ABCD1234");
    expect(parseStartCode("/start@JobHuntBot ABCD1234 ")).toBe("ABCD1234");
    expect(parseStartCode("/start")).toBeNull();
    expect(parseStartCode("/start ab")).toBeNull();
    expect(parseStartCode("hello")).toBeNull();
    expect(parseStartCode(undefined)).toBeNull();
  });
  it("hashes codes case-insensitively", () => {
    expect(hashLinkCode(" abcd1234")).toBe(hashLinkCode("ABCD1234"));
    expect(hashLinkCode("ABCD1234")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("checks the webhook secret", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret-value";
    expect(validWebhookSecret("s3cret-value")).toBe(true);
    expect(validWebhookSecret("s3cret-valuX")).toBe(false);
    expect(validWebhookSecret("short")).toBe(false);
    expect(validWebhookSecret(null)).toBe(false);
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(validWebhookSecret("anything")).toBe(false);
  });
});
