import { describe, expect, it } from "vitest";
import { digestIsEmpty, digestSections, digestSummary, emptyDigestData, parseDigestData } from "@/lib/digest/build";
import { notificationStrings } from "@/lib/i18n/notifications";
import { changedFields, contentHash, type HashableJob } from "@/lib/jobs/content-hash";
import { deliveryMode, INSTANT_ONLY, NOTIFICATION_KINDS, parseModes } from "@/lib/notifications/kinds";
import { toEffective } from "@/lib/notifications/prefs";
import { describeFields } from "@/lib/notifications/reminders";
import { nextStage, stageLabel } from "@/lib/notifications/stage-change";
import { entriesToAnnounce, WHATS_NEW, type WhatsNewEntry } from "@/lib/whats-new";

const job: HashableJob = {
  title: "Backend Engineer",
  location: "Tel Aviv",
  workMode: "HYBRID",
  description: "Build   services\nin Go.",
  payMin: null,
  payMax: null,
  payCurrency: null,
  payPeriod: null,
};

describe("content hash (saved-job updates)", () => {
  it("is stable across whitespace / case-only edits", () => {
    expect(contentHash({ ...job, description: "build services in go." })).toBe(contentHash(job));
    expect(contentHash({ ...job, title: "  backend engineer " })).toBe(contentHash(job));
  });
  it("names exactly the fields that changed", () => {
    const prev = contentHash(job);
    expect(changedFields(prev, contentHash({ ...job, title: "Senior Backend Engineer" }))).toEqual(["title"]);
    expect(
      changedFields(prev, contentHash({ ...job, payMin: 30000, location: "Haifa", description: "New text" })),
    ).toEqual(["location", "pay", "description"]);
    expect(changedFields(prev, contentHash(job))).toEqual([]);
  });
  it("treats the first hash as a baseline, not a change", () => {
    expect(changedFields(null, contentHash(job))).toEqual([]);
    expect(changedFields(undefined, contentHash(job))).toEqual([]);
  });
  it("describes fields in the user's language", () => {
    expect(describeFields(["title", "pay"], notificationStrings("he").fields)).toBe("כותרת, שכר");
    expect(describeFields(["bogus", "location"], notificationStrings("en").fields)).toBe("location");
  });
});

describe("instant vs digest per kind", () => {
  it("parses only known, overridable kinds", () => {
    expect(
      parseModes({ JOB_MATCH: "digest", INTERVIEW: "digest", DIGEST: "digest", NOPE: "digest", FOLLOW_UP: "x" }),
    ).toEqual({
      JOB_MATCH: "digest",
    });
    expect(parseModes(null)).toEqual({});
    expect(parseModes([])).toEqual({});
  });
  it("defaults to instant; interviews and the digest itself are always instant", () => {
    expect(deliveryMode({}, "SAVED_JOB_UPDATED")).toBe("instant");
    expect(deliveryMode({ STAGE_CHANGE: "digest" }, "STAGE_CHANGE")).toBe("digest");
    for (const k of INSTANT_ONLY) expect(deliveryMode({ [k]: "digest" }, k)).toBe("instant");
  });
  it("is part of the effective prefs", () => {
    expect(toEffective(null).modes).toEqual({});
    expect(toEffective({ modes: { WHATS_NEW: "digest" } } as never).modes).toEqual({ WHATS_NEW: "digest" });
  });
  it("has labels and hints for every kind in both languages", () => {
    for (const loc of ["he", "en"] as const) {
      const s = notificationStrings(loc);
      for (const k of NOTIFICATION_KINDS) {
        expect(s.kinds[k], `${loc} ${k}`).toBeTruthy();
        expect(s.kindHints[k], `${loc} ${k}`).toBeTruthy();
      }
    }
  });
});

describe("digest — held notifications", () => {
  const base = () => emptyDigestData("2026-10-30", new Date("2026-10-29T08:00:00Z"), new Date("2026-10-30T08:00:00Z"));
  it("an otherwise empty digest with held items is not empty, and lists them first", () => {
    const d = { ...base(), held: [{ id: "n1", kind: "STAGE_CHANGE", title: "Acme: Interview", url: "/jobs/j1" }] };
    expect(digestIsEmpty(base())).toBe(true);
    expect(digestIsEmpty(d)).toBe(false);
    const sections = digestSections(d, "he");
    expect(sections[0].key).toBe("held");
    expect(sections[0].items[0]).toMatchObject({ text: "Acme: Interview", url: "/jobs/j1" });
    expect(digestSummary(d, "en")).toMatch(/1/);
  });
  it("old stored digests without `held` still parse", () => {
    const old: Record<string, unknown> = { ...base() };
    delete old.held;
    expect(parseDigestData(old)?.held).toEqual([]);
  });
});

describe("hiring-stage change: next stage", () => {
  const stages = [
    { kind: "application", title: "" },
    { kind: "phone_screen", title: "Recruiter call" },
    { kind: "home_assignment", title: "" },
    { kind: "technical", title: "Tech interview" },
    { kind: "manager", title: "" },
    { kind: "offer", title: "" },
  ];
  it("follows the stage the user marked", () => {
    expect(nextStage(stages, { currentStage: "technical" })?.kind).toBe("manager");
    expect(nextStage(stages, { currentStage: "offer" })).toBeNull();
  });
  it("falls back to the status", () => {
    expect(nextStage(stages, { status: "SCREENING" })?.kind).toBe("home_assignment");
    expect(nextStage(stages, { status: "INTERVIEW" })?.kind).toBe("manager");
    expect(
      nextStage(
        [
          { kind: "application", title: "" },
          { kind: "hr", title: "" },
        ],
        { status: "SCREENING" },
      )?.kind,
    ).toBe("hr");
    expect(nextStage(stages, { status: "OFFER" })).toBeNull();
    expect(nextStage([], { status: "INTERVIEW" })).toBeNull();
  });
  it("labels with the source title, else the kind label", () => {
    expect(stageLabel("en", { kind: "technical", title: "Tech interview" })).toBe("Tech interview");
    expect(stageLabel("he", { kind: "home_assignment", title: "" })).toBe("מטלת בית");
  });
});

describe("what's new", () => {
  const e = (over: Partial<WhatsNewEntry>): WhatsNewEntry => ({
    id: "x",
    date: "2026-10-30",
    announce: true,
    he: { title: "t", body: "b" },
    en: { title: "t", body: "b" },
    ...over,
  });
  const now = new Date("2026-11-02T10:00:00Z");
  const joined = new Date("2026-01-01T00:00:00Z");
  it("announces flagged entries for a week, never future ones", () => {
    expect(entriesToAnnounce(now, joined, [e({})])).toHaveLength(1);
    expect(entriesToAnnounce(now, joined, [e({ announce: false })])).toHaveLength(0);
    expect(entriesToAnnounce(now, joined, [e({ date: "2026-10-20" })])).toHaveLength(0);
    expect(entriesToAnnounce(now, joined, [e({ date: "2026-11-05" })])).toHaveLength(0);
  });
  it("skips users who joined after the entry", () => {
    expect(entriesToAnnounce(now, new Date("2026-11-01T12:00:00Z"), [e({})])).toHaveLength(0);
  });
  it("entries have unique ids, valid dates, both languages, newest first", () => {
    const ids = WHATS_NEW.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of WHATS_NEW) {
      expect(x.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(x.he.title && x.en.title && x.he.body && x.en.body).toBeTruthy();
    }
    const dates = WHATS_NEW.map((x) => x.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
