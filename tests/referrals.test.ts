import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const store = vi.hoisted(() => ({
  referrals: [] as Array<Record<string, unknown>>,
  notifications: [] as Array<Record<string, unknown>>,
  companies: [] as Array<{ id: string; name: string; slug: string; website: string | null }>,
  contacts: [] as Array<Record<string, unknown>>,
  llm: { name: "mock", complete: vi.fn() } as { name: string; complete: ReturnType<typeof vi.fn> },
}));

vi.mock("@/lib/db", () => ({
  db: {
    referral: { findMany: vi.fn(async () => store.referrals) },
    company: { findMany: vi.fn(async () => store.companies) },
    contact: { findMany: vi.fn(async () => store.contacts) },
    notificationPreference: { findUnique: vi.fn(async () => null) },
    notificationChannel: { findMany: vi.fn(async () => []) },
    notification: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (store.notifications.some((n) => n.userId === data.userId && n.dedupeKey === data.dedupeKey))
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
        store.notifications.push(data);
        return { id: `n${store.notifications.length}` };
      }),
    },
    notificationDelivery: { createMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
vi.mock("@/lib/ai", () => ({ guardedLLM: vi.fn(async () => store.llm) }));

import { AiLimitError } from "@/lib/ai/errors";
import { contactsFromCsv, parseCsv } from "@/lib/referrals/csv";
import { referralDedupeKey, referralFollowUpDue } from "@/lib/referrals/followup";
import { templateMessage, validateAiMessage, type ReferralFacts } from "@/lib/referrals/message";
import { generateReferralMessage, insidersByCompany, matchCompanies } from "@/lib/referrals/server";
import { runReferralFollowUps } from "@/lib/notifications/referrals";

const D = (s: string) => new Date(s);

describe("referral CSV import", () => {
  it("parses quotes, escaped quotes, CRLF and semicolons", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
    expect(parseCsv("שם;חברה\nדנה;Wix")).toEqual([
      ["שם", "חברה"],
      ["דנה", "Wix"],
    ]);
  });

  it("reads a LinkedIn Connections.csv export (notes lines before the header)", () => {
    const csv = [
      "Notes:",
      '"When exporting your connection data, you may notice that some of the email addresses are missing."',
      "",
      "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
      "Dana,Levi,https://www.linkedin.com/in/dana-levi,,Wix.com Ltd.,Engineering Manager,01 Jan 2024",
      "Avi,Cohen,https://example.com/x,avi@Example.com,Monday.com,Backend Developer,02 Feb 2024",
      "No,Company,https://www.linkedin.com/in/noco,,,Freelancer,03 Mar 2024",
      "Dana,Levi,https://www.linkedin.com/in/dana-levi,,Wix.com Ltd.,Engineering Manager,01 Jan 2024",
    ].join("\n");
    const r = contactsFromCsv(csv);
    expect(r.error).toBeUndefined();
    expect(r.contacts).toHaveLength(2);
    expect(r.contacts[0]).toMatchObject({
      name: "Dana Levi",
      company: "Wix.com Ltd.",
      title: "Engineering Manager",
      linkedinUrl: "https://www.linkedin.com/in/dana-levi",
    });
    // Non-LinkedIn URL dropped, email lower-cased.
    expect(r.contacts[1]).toMatchObject({ linkedinUrl: null, email: "avi@example.com" });
    expect(r.skipped.map((s) => s.reason)).toEqual(["no_company", "duplicate"]);
  });

  it("accepts Hebrew headers", () => {
    const r = contactsFromCsv("שם,חברה,תפקיד,היכרות\nרונית כהן,צ'ק פוינט,QA Lead,למדנו יחד בטכניון");
    expect(r.contacts[0]).toMatchObject({ name: "רונית כהן", company: "צ'ק פוינט", relationship: "למדנו יחד בטכניון" });
  });

  it("rejects files with no name/company header or too many rows", () => {
    expect(contactsFromCsv("foo,bar\n1,2").error).toBe("no_header");
    const big = ["name,company", ...Array.from({ length: 501 }, (_, i) => `p${i},c${i}`)].join("\n");
    expect(contactsFromCsv(big).error).toBe("too_many");
  });
});

describe("referral follow-up timing", () => {
  const r = { id: "r1", status: "ASKED" as const, statusAt: D("2026-11-01T09:00:00Z"), followedUpAt: null };
  it("ASKED waits 4 days, AGREED 3, SUBMITTED 10; ANSWERED never", () => {
    expect(referralFollowUpDue(r, D("2026-11-04T09:00:00Z"))).toBeNull();
    expect(referralFollowUpDue(r, D("2026-11-05T09:00:00Z"))).toEqual({ kind: "ask_again", days: 4 });
    expect(referralFollowUpDue({ ...r, status: "AGREED" }, D("2026-11-04T10:00:00Z"))?.kind).toBe("send_cv");
    expect(referralFollowUpDue({ ...r, status: "SUBMITTED" }, D("2026-11-08T10:00:00Z"))).toBeNull();
    expect(referralFollowUpDue({ ...r, status: "SUBMITTED" }, D("2026-11-11T10:00:00Z"))?.kind).toBe("ask_answer");
    expect(referralFollowUpDue({ ...r, status: "ANSWERED" }, D("2026-12-30T10:00:00Z"))).toBeNull();
  });
  it("a follow-up after the last status change silences it; a new status re-arms it", () => {
    const done = { ...r, followedUpAt: D("2026-11-05T10:00:00Z") };
    expect(referralFollowUpDue(done, D("2026-11-20T09:00:00Z"))).toBeNull();
    const moved = { ...done, status: "AGREED" as const, statusAt: D("2026-11-06T09:00:00Z") };
    expect(referralFollowUpDue(moved, D("2026-11-09T09:00:00Z"))?.kind).toBe("send_cv");
    expect(referralDedupeKey(moved)).not.toBe(referralDedupeKey(r));
  });
});

const facts: ReferralFacts = {
  contactName: "Dana Levi",
  relationship: "עבדנו יחד ב-Fiverr",
  company: "Wix",
  jobTitle: "Senior Frontend Engineer",
  jobUrl: "https://careers.wix.com/position/123",
  senderName: "Guy",
  highlight: "Frontend developer with 6 years of React",
  skills: ["React", "TypeScript"],
};

describe("referral request message", () => {
  it("Hebrew template uses first name, company, job and the posting URL", () => {
    const m = templateMessage(facts, "he");
    expect(m.startsWith("היי Dana,")).toBe(true);
    expect(m).toContain("Wix");
    expect(m).toContain("Senior Frontend Engineer");
    expect(m).toContain(facts.jobUrl!);
    expect(m).toContain("חבר מביא חבר");
    expect(m).not.toMatch(/[[{]/);
  });
  it("English template without a job or relationship still reads well", () => {
    const m = templateMessage({ ...facts, jobTitle: null, jobUrl: null, relationship: null, highlight: null, skills: [] }, "en");
    expect(m).toContain("Hi Dana,");
    expect(m).toContain("Wix is hiring and");
    expect(m).not.toContain("undefined");
  });
  it("AI output is rejected with placeholders, without the company, or dropping the URL", () => {
    const good = `Hi Dana! Wix is hiring a Senior Frontend Engineer and I'd love a referral if you're comfortable.\n${facts.jobUrl}`;
    expect(validateAiMessage({ body: good }, facts)).toBe(good);
    expect(validateAiMessage({ body: good.replace("Dana", "[name]") }, facts)).toBeNull();
    const noUrl = { ...facts, jobUrl: null };
    expect(validateAiMessage({ body: "Hi Dana! The company is hiring a Senior Frontend Engineer, could you refer me?" }, noUrl)).toBeNull();
    expect(validateAiMessage({ body: good.replace(facts.jobUrl!, "") }, facts)).toBeNull();
  });
});

describe("generateReferralMessage (guardedLLM)", () => {
  beforeEach(() => store.llm.complete.mockReset());
  it("mock provider → template, no AI call", async () => {
    store.llm.name = "mock";
    const r = await generateReferralMessage("u1", facts, "he");
    expect(r.source).toBe("template");
    expect(store.llm.complete).not.toHaveBeenCalled();
  });
  it("valid AI JSON → ai; invalid → template; limit → limited", async () => {
    store.llm.name = "gemini";
    const body = `Hi Dana, Wix is hiring and I'd love a referral for the Senior Frontend Engineer role.\n${facts.jobUrl}`;
    store.llm.complete.mockResolvedValueOnce(JSON.stringify({ body }));
    expect(await generateReferralMessage("u1", facts, "en")).toEqual({ body, source: "ai" });
    store.llm.complete.mockResolvedValueOnce(JSON.stringify({ body: "too short" }));
    expect((await generateReferralMessage("u1", facts, "en")).source).toBe("template");
    store.llm.complete.mockRejectedValueOnce(new AiLimitError("daily"));
    expect((await generateReferralMessage("u1", facts, "en")).source).toBe("limited");
    store.llm.name = "mock";
  });
});

describe("company matching and insiders", () => {
  beforeEach(() => {
    store.companies = [
      { id: "c-wix", name: "Wix", slug: "wix", website: "https://www.wix.com" },
      { id: "c-mon", name: "monday.com", slug: "monday", website: "https://monday.com" },
    ];
  });
  it("matches typed names conservatively", async () => {
    const m = await matchCompanies(["Wix.com Ltd.", "Monday.com", "Some Startup"]);
    expect(m.get("Wix.com Ltd.")).toBe("c-wix");
    expect(m.get("Monday.com")).toBe("c-mon");
    expect(m.has("Some Startup")).toBe(false);
  });
  it("groups insider contacts by company (by id or by name)", async () => {
    store.contacts = [
      { id: "k1", name: "Dana", companyId: "c-wix", companyName: "Wix" },
      { id: "k2", name: "Avi", companyId: null, companyName: "Wix Ltd." },
      { id: "k3", name: "Noa", companyId: null, companyName: "Unknown" },
    ];
    const m = await insidersByCompany("u1", [{ id: "c-wix", name: "Wix" }, { id: "c-mon", name: "monday.com" }]);
    expect(m.get("c-wix")?.map((c) => c.id)).toEqual(["k1", "k2"]);
    expect(m.has("c-mon")).toBe(false);
    expect((await insidersByCompany(null, [{ id: "c-wix", name: "Wix" }])).size).toBe(0);
  });
});

describe("runReferralFollowUps (cron)", () => {
  beforeEach(() => {
    store.notifications = [];
    store.referrals = [
      {
        id: "r1",
        userId: "u1",
        status: "ASKED",
        statusAt: D("2026-11-01T09:00:00Z"),
        followedUpAt: null,
        contact: { name: "Dana Levi", companyName: "Wix", company: { name: "Wix" } },
        application: null,
        user: { locale: "he" },
      },
      {
        id: "r2",
        userId: "u1",
        status: "AGREED",
        statusAt: D("2026-11-05T09:00:00Z"),
        followedUpAt: null,
        contact: { name: "Avi", companyName: "monday.com", company: null },
        application: { company: "monday.com" },
        user: { locale: "en" },
      },
    ];
  });
  it("one reminder per due referral, deduped, linking to /referrals", async () => {
    const now = D("2026-11-06T09:00:00Z");
    expect(await runReferralFollowUps(now)).toEqual({ reminded: 1 });
    expect(store.notifications[0]).toMatchObject({ kind: "FOLLOW_UP", url: "/referrals#referral-r1" });
    expect(String(store.notifications[0].title)).toContain("Wix");
    expect(await runReferralFollowUps(now)).toEqual({ reminded: 0 });
    expect(await runReferralFollowUps(D("2026-11-08T10:00:00Z"))).toEqual({ reminded: 1 });
    expect(String(store.notifications[1].body)).toContain("Avi");
  });
});
