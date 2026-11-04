import { describe, expect, it } from "vitest";
import { canUndo, newBatchId, parseAcceptance, pickArchivable } from "@/lib/closing/archive";
import {
  assignmentInputSchema,
  assignmentReminderStage,
  dueState,
  israelLocalToDate,
  sortByDue,
} from "@/lib/closing/assignments";
import { heuristicScan, validateAiScan } from "@/lib/closing/analysis";
import {
  CONTRACT_ITEMS,
  checklistProgress,
  parseChecklist,
  questionsText,
  questionsToAsk,
  setItem,
} from "@/lib/closing/checklist";
import { resignationLetterDraft, withdrawalDraft } from "@/lib/closing/drafts";
import { completedMonths, latestNoticeDate, legalNotice, noticePeriod, parseDay } from "@/lib/closing/notice";
import { needsBrief, needsThanks, rankForRole, refereeInputSchema } from "@/lib/closing/referees";
import { addItem, parseTransition, toggleItem } from "@/lib/closing/transition";

const d = (s: string) => parseDay(s)!;

describe("notice period (חוק הודעה מוקדמת)", () => {
  it("counts completed months", () => {
    expect(completedMonths(d("2026-01-15"), d("2026-04-14"))).toBe(2);
    expect(completedMonths(d("2026-01-15"), d("2026-04-15"))).toBe(3);
    expect(completedMonths(d("2026-01-31"), d("2026-02-28"))).toBe(1);
    expect(completedMonths(d("2026-05-01"), d("2026-04-01"))).toBe(0);
  });

  it("monthly pay: 1 day/month for 6 months, then 6 + 2.5/month, then a month", () => {
    expect(legalNotice(0, "monthly")).toEqual({ kind: "days", days: 0 });
    expect(legalNotice(3, "monthly")).toEqual({ kind: "days", days: 3 });
    expect(legalNotice(6, "monthly")).toEqual({ kind: "days", days: 6 });
    expect(legalNotice(8, "monthly")).toEqual({ kind: "days", days: 11 });
    expect(legalNotice(11, "monthly")).toEqual({ kind: "days", days: 18.5 });
    expect(legalNotice(12, "monthly")).toEqual({ kind: "month" });
  });

  it("hourly pay: year 1 day/month, year 2 14+, year 3 21+, then a month", () => {
    expect(legalNotice(5, "hourly")).toEqual({ kind: "days", days: 5 });
    expect(legalNotice(12, "hourly")).toEqual({ kind: "days", days: 14 });
    expect(legalNotice(18, "hourly")).toEqual({ kind: "days", days: 17 });
    expect(legalNotice(30, "hourly")).toEqual({ kind: "days", days: 24 });
    expect(legalNotice(36, "hourly")).toEqual({ kind: "month" });
  });

  it("computes the end date in calendar days, rounding half days up", () => {
    const r = noticePeriod({ startDate: d("2026-01-01"), noticeDate: d("2026-04-01"), basis: "monthly" });
    expect(r.months).toBe(3);
    expect(r.endDate).toBe("2026-04-04");
    const half = noticePeriod({ startDate: d("2025-01-01"), noticeDate: d("2025-12-01"), basis: "monthly" });
    expect(half.legal).toEqual({ kind: "days", days: 18.5 });
    expect(half.endDate).toBe("2025-12-20");
  });

  it("one month clamps to the end of a shorter month", () => {
    const r = noticePeriod({ startDate: d("2023-05-01"), noticeDate: d("2026-01-31"), basis: "monthly" });
    expect(r.legal).toEqual({ kind: "month" });
    expect(r.endDate).toBe("2026-02-28");
  });

  it("uses a longer contract period, never a shorter one", () => {
    const longer = noticePeriod({
      startDate: d("2026-01-01"),
      noticeDate: d("2026-04-01"),
      basis: "monthly",
      contractDays: 30,
    });
    expect(longer.basis).toBe("contract");
    expect(longer.endDate).toBe("2026-05-01");
    const shorter = noticePeriod({
      startDate: d("2023-01-01"),
      noticeDate: d("2026-04-01"),
      basis: "monthly",
      contractDays: 7,
    });
    expect(shorter.basis).toBe("legal");
    expect(shorter.endDate).toBe("2026-05-01");
  });

  it("finds the latest day to resign before a new start date", () => {
    const at = latestNoticeDate({ startDate: d("2024-01-01"), newStart: d("2026-12-01"), basis: "monthly" });
    expect(at).toBe("2026-10-31");
    const r = noticePeriod({ startDate: d("2024-01-01"), noticeDate: d(at!), basis: "monthly" });
    expect(r.endDate <= "2026-11-30").toBe(true);
    expect(latestNoticeDate({ startDate: d("2026-11-01"), newStart: d("2026-10-01"), basis: "monthly" })).toBeNull();
  });

  it("rejects invalid dates", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("nope")).toBeNull();
  });
});

describe("contract checklist", () => {
  it("every item has an official https source, and the required clauses exist", () => {
    const hosts = ["fs.knesset.gov.il", "www.kolzchut.org.il", "www.gov.il", "www.btl.gov.il", "www.wipo.int"];
    for (const item of CONTRACT_ITEMS) {
      expect(item.sources.length).toBeGreaterThan(0);
      for (const s of item.sources) expect(hosts).toContain(new URL(s.url).host);
      expect(item.title.he).toMatch(/[\u0590-\u05FF]/);
      expect(item.ask.en.endsWith("?")).toBe(true);
    }
    const ids = CONTRACT_ITEMS.map((i) => i.id);
    for (const id of [
      "notice",
      "nonCompete",
      "ip",
      "options",
      "pension",
      "kh",
      "overtime",
      "vacation",
      "trial",
      "salary",
      "bonus",
      "carTravel",
      "section14",
      "confidentiality",
      "remote",
    ])
      expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("parses stored state with defaults and ignores unknown ids", () => {
    const s = parseChecklist({ pension: { status: "ok" }, bogus: { status: "ok" }, ip: { status: "weird", note: 5 } });
    expect(s.pension).toEqual({ status: "ok", note: "" });
    expect(s.ip).toEqual({ status: "todo", note: "" });
    expect("bogus" in s).toBe(false);
    expect(parseChecklist(null).notice.status).toBe("todo");
  });

  it("updates items immutably and counts progress", () => {
    const s0 = parseChecklist({});
    const s1 = setItem(s0, "nonCompete", { status: "concern", note: "12 חודשים" });
    const s2 = setItem(s1, "pension", { status: "ok" });
    expect(s0.nonCompete.status).toBe("todo");
    expect(setItem(s2, "nope", { status: "ok" })).toBe(s2);
    const p = checklistProgress(s2);
    expect(p).toMatchObject({ ok: 1, concern: 1, done: 2, total: CONTRACT_ITEMS.length });
  });

  it("lists concerns first, then unchecked items, skipping ok", () => {
    let s = parseChecklist({});
    for (const i of CONTRACT_ITEMS) s = setItem(s, i.id, { status: "ok" });
    s = setItem(s, "options", { status: "todo" });
    s = setItem(s, "nonCompete", { status: "concern", note: "12 months" });
    const q = questionsToAsk(s, "en");
    expect(q.map((x) => x.id)).toEqual(["nonCompete", "options"]);
    expect(questionsText(s, "en")).toMatch(/^1\. .+\(12 months\)\n2\. /);
  });
});

describe("accept + archive", () => {
  const apps = [
    { id: "a", status: "OFFER", archivedAt: null },
    { id: "b", status: "INTERVIEW", archivedAt: null },
    { id: "c", status: "REJECTED", archivedAt: null },
    { id: "d", status: "APPLIED", archivedAt: new Date() },
    { id: "e", status: "SAVED", archivedAt: null },
  ];
  it("archives only other open, unarchived applications", () => {
    expect(pickArchivable(apps, "a").map((x) => x.id)).toEqual(["b", "e"]);
    expect(pickArchivable(apps, null).map((x) => x.id)).toEqual(["a", "b", "e"]);
  });

  it("round-trips the undo record and limits undo to 30 days", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    const rec = parseAcceptance({
      acceptedAt: now.toISOString(),
      batch: newBatchId(now, () => 0.5),
      archivedIds: ["b"],
    });
    expect(rec?.paused).toEqual({ highMatchWas: null, savedSearchIds: [] });
    expect(rec?.batch).toMatch(/^acc_/);
    expect(canUndo(rec, new Date("2026-11-20T10:00:00Z"))).toBe(true);
    expect(canUndo(rec, new Date("2026-12-20T10:00:00Z"))).toBe(false);
    expect(canUndo({ ...rec!, undoneAt: now.toISOString() }, now)).toBe(false);
    expect(parseAcceptance({ nope: 1 })).toBeNull();
  });
});

describe("home assignments", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  it("classifies due dates", () => {
    expect(dueState({ dueAt: new Date("2026-11-04T09:00:00Z"), status: "TODO" }, now)).toBe("overdue");
    expect(dueState({ dueAt: new Date("2026-11-05T09:00:00Z"), status: "IN_PROGRESS" }, now)).toBe("today");
    expect(dueState({ dueAt: new Date("2026-11-06T09:00:00Z"), status: "TODO" }, now)).toBe("soon");
    expect(dueState({ dueAt: new Date("2026-11-20T09:00:00Z"), status: "TODO" }, now)).toBe("later");
    expect(dueState({ dueAt: new Date("2026-11-04T09:00:00Z"), status: "SUBMITTED" }, now)).toBe("done");
    expect(dueState({ dueAt: null, status: "TODO" }, now)).toBe("none");
  });

  it("fires a ~24h and a ~3h reminder window", () => {
    expect(assignmentReminderStage(new Date("2026-11-05T09:00:00Z"), now)).toBe("day");
    expect(assignmentReminderStage(new Date("2026-11-04T12:00:00Z"), now)).toBe("hours");
    expect(assignmentReminderStage(new Date("2026-11-04T20:00:00Z"), now)).toBeNull();
    expect(assignmentReminderStage(new Date("2026-11-04T09:00:00Z"), now)).toBeNull();
  });

  it("reads Israel wall time; a bare date means 23:59 Israel", () => {
    expect(israelLocalToDate("2026-11-10")?.toISOString()).toBe("2026-11-10T21:59:00.000Z");
    expect(israelLocalToDate("2026-07-10T09:00")?.toISOString()).toBe("2026-07-10T06:00:00.000Z");
    expect(israelLocalToDate("")).toBeNull();
  });

  it("validates input and sorts open assignments by due date", () => {
    const ok = assignmentInputSchema.safeParse({
      applicationId: "x",
      title: "Take-home",
      link: "",
      dueAt: "2026-11-10",
    });
    expect(ok.success && ok.data.link).toBeNull();
    expect(
      assignmentInputSchema.safeParse({ applicationId: "x", title: "t", link: "javascript:alert(1)" }).success,
    ).toBe(false);
    const rows = [
      { id: 1, dueAt: null, status: "TODO" },
      { id: 2, dueAt: new Date("2026-11-08"), status: "SUBMITTED" },
      { id: 3, dueAt: new Date("2026-11-09"), status: "TODO" },
      { id: 4, dueAt: new Date("2026-11-07"), status: "IN_PROGRESS" },
    ];
    expect(sortByDue(rows).map((r) => r.id)).toEqual([4, 3, 1, 2]);
  });
});

describe("referees", () => {
  it("parses roles, consent and contact info", () => {
    const r = refereeInputSchema.parse({
      name: " Dana ",
      fitsRoles: "Backend, backend,Team lead",
      email: "",
      consent: "AGREED",
    });
    expect(r).toMatchObject({
      name: "Dana",
      fitsRoles: ["Backend", "backend", "Team lead"],
      email: null,
      consent: "AGREED",
    });
    expect(refereeInputSchema.safeParse({ name: "x", email: "bad" }).success).toBe(false);
    expect(refereeInputSchema.safeParse({ name: "x", linkedinUrl: "https://evil.com/in/x" }).success).toBe(false);
  });

  it("knows when to brief and when to thank", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    expect(needsBrief({ expectedCallAt: new Date("2026-11-05T10:00:00Z"), briefedAt: null }, now)).toBe(true);
    expect(needsBrief({ expectedCallAt: new Date("2026-11-05T10:00:00Z"), briefedAt: now }, now)).toBe(false);
    expect(needsBrief({ expectedCallAt: new Date("2026-11-10T10:00:00Z"), briefedAt: null }, now)).toBe(false);
    expect(
      needsThanks({ expectedCallAt: new Date("2026-11-03T10:00:00Z"), calledAt: null, thankedAt: null }, now),
    ).toBe(true);
    expect(needsThanks({ expectedCallAt: null, calledAt: now, thankedAt: now }, now)).toBe(false);
  });

  it("ranks referees who fit the role first", () => {
    const rows = [
      { name: "A", fitsRoles: ["frontend"], consent: "AGREED" },
      { name: "B", fitsRoles: ["Backend"], consent: "NOT_ASKED" },
    ];
    expect(rankForRole(rows, "Senior Backend Engineer").map((r) => r.name)).toEqual(["B", "A"]);
  });
});

describe("contract scan", () => {
  const text =
    "1. Salary: 30,000 NIS gross per month.\n2. The employee shall not compete with the company for 12 months.\n3. Section 14 applies.";
  const now = new Date("2026-11-04T10:00:00Z");
  it("heuristic quotes verbatim snippets only", () => {
    const r = heuristicScan(text, now);
    const nc = r.items.find((i) => i.id === "nonCompete")!;
    expect(nc.found).toBe(true);
    expect(text).toContain(nc.quote!);
    expect(r.items.find((i) => i.id === "options")?.found).toBe(false);
  });

  it("drops AI quotes that are not in the text and notes with invented numbers", () => {
    const r = validateAiScan(
      {
        items: [
          {
            id: "nonCompete",
            found: true,
            quote: "shall not compete with the company for 12 months",
            note: "Ask about 12 months",
          },
          { id: "salary", found: true, quote: "Salary: 35,000 NIS", note: "Fine" },
          { id: "pension", found: true, quote: null, note: "Legal minimum is 18.5%" },
          { id: "made-up", found: true, quote: "x", note: null },
        ],
      },
      text,
      now,
    )!;
    expect(r.source).toBe("ai");
    const get = (id: string) => r.items.find((i) => i.id === id)!;
    expect(get("nonCompete")).toMatchObject({ found: true, note: "Ask about 12 months" });
    expect(get("salary")).toMatchObject({ found: false, quote: null });
    expect(get("pension").note).toBeNull();
    expect(r.items.some((i) => i.id === "made-up")).toBe(false);
    expect(validateAiScan({ items: "no" }, text, now)).toBeNull();
  });
});

describe("transition + drafts", () => {
  it("fills defaults in the user's language and edits checklists", () => {
    const t = parseTransition({}, "he");
    expect(t.handover.length).toBeGreaterThan(5);
    expect(t.plan.d30).toMatch(/[\u0590-\u05FF]/);
    const added = addItem(t.handover, "  משהו חדש ", "h");
    expect(added.at(-1)).toMatchObject({ text: "משהו חדש", done: false });
    expect(new Set(added.map((i) => i.id)).size).toBe(added.length);
    expect(toggleItem(added, "h1", true)[0].done).toBe(true);
    expect(parseTransition({ payBasis: "weird", contractNoticeDays: "30" }, "en")).toMatchObject({
      payBasis: "monthly",
      contractNoticeDays: 30,
    });
  });

  it("drafts carry the dates and names, with placeholders for the rest", () => {
    const letter = resignationLetterDraft({ noticeDate: "01/12/2026", lastDay: "31/12/2026" }, "he");
    expect(letter).toContain("01/12/2026");
    expect(letter).toContain("[שם המנהל/ת]");
    expect(withdrawalDraft({ company: "Acme", role: "Dev" }, "en")).toContain("Acme");
  });
});
