import { describe, expect, it } from "vitest";
import { analyzeMessage, type AnalyzeContext } from "@/lib/email/analyze";
import { decryptSecret, encryptSecret, loadKey } from "@/lib/email/crypto";
import { isGmailConfigured } from "@/lib/email/config";
import { FIXTURE_COMPANIES, FIXTURE_EMAILS as E, FIXTURE_JOBS } from "@/lib/email/fixtures";
import { bestCompany, companySimilarity, titleSimilarity } from "@/lib/email/match";
import { classify, companyFromSenderName, extract, parseFrom } from "@/lib/email/parse";
import { buildGmailQuery } from "@/lib/email/patterns";
import { nextStatus, scoreCandidate, shouldAutoApply } from "@/lib/email/score";
import { isDue } from "@/lib/email/schedule";

const ctx = (over: Partial<AnalyzeContext> = {}): AnalyzeContext => ({
  confidence: "BALANCED",
  detectStatusUpdates: true,
  companies: FIXTURE_COMPANIES,
  jobs: FIXTURE_JOBS,
  applications: [],
  ...over,
});

describe("parseFrom", () => {
  it("parses display name and address", () => {
    expect(parseFrom('"Orion Recruiting" <No-Reply@greenhouse.io>')).toEqual({
      name: "Orion Recruiting",
      address: "no-reply@greenhouse.io",
      domain: "greenhouse.io",
    });
    expect(parseFrom("jobs@acme.example").domain).toBe("acme.example");
  });
  it("cleans company from sender display names", () => {
    expect(companyFromSenderName("Orion Payments Recruiting")).toBe("Orion Payments");
    expect(companyFromSenderName("Careers at Nimbus")).toBe("Nimbus");
    expect(companyFromSenderName("Kestrel AI Talent Acquisition Team")).toBe("Kestrel AI");
    expect(companyFromSenderName("LinkedIn")).toBeNull();
    expect(companyFromSenderName("no-reply")).toBeNull();
  });
});

describe("classify", () => {
  it("detects application confirmations in English and Hebrew", () => {
    expect(classify(E.greenhouse)).toMatchObject({ kind: "APPLICATION", strong: true });
    expect(classify(E.comeetHebrew)).toMatchObject({ kind: "APPLICATION", strong: true });
    expect(classify(E.lever).kind).toBe("APPLICATION");
  });
  it("detects status updates even when the subject looks like a confirmation", () => {
    expect(classify(E.rejection).kind).toBe("REJECTED");
    expect(classify(E.interviewHebrew).kind).toBe("INTERVIEW");
    expect(classify(E.offer).kind).toBe("OFFER");
  });
  it("ignores unrelated mail", () => {
    expect(classify(E.marketing).kind).toBeNull();
    expect(classify({ subject: "Lunch?", snippet: "see you at 1", body: null }).kind).toBeNull();
  });
  it("does not treat 'we'll contact you for an interview' as an interview", () => {
    const c = classify({
      subject: "Thank you for applying to Orion",
      snippet: "If your profile fits we will contact you to schedule an interview.",
      body: null,
    });
    expect(c.kind).toBe("APPLICATION");
  });
});

describe("extract", () => {
  it("pulls company and title from ATS confirmations", () => {
    expect(extract(E.greenhouse)).toMatchObject({ company: "Orion Payments", title: "Senior Frontend Engineer" });
    expect(extract(E.linkedin)).toMatchObject({ company: "Kestrel AI", title: "Machine Learning Engineer" });
    expect(extract(E.lever)).toMatchObject({ company: "Nimbus Data", title: "Data Scientist" });
    expect(extract(E.unknownCompany)).toMatchObject({ company: "Brightfield", title: "Product Designer" });
  });
  it("handles Hebrew patterns", () => {
    const ex = extract(E.comeetHebrew);
    expect(ex.title).toBe("מפתח/ת Full Stack");
    expect(ex.company).toBe("תבור מערכות");
  });
  it("falls back to the sender domain for direct company mail", () => {
    const ex = extract({ from: "hr@tavor.example", subject: "Application received", snippet: "", body: null });
    expect(ex).toMatchObject({ company: "tavor", companySource: "domain" });
  });
});

describe("matching", () => {
  it("fuzzy-matches company names ignoring legal suffixes", () => {
    expect(companySimilarity("Nimbus Data", "Nimbus Data Ltd.")).toBe(1);
    expect(companySimilarity("orion", "Orion Payments")).toBeGreaterThanOrEqual(0.85);
    expect(companySimilarity("Orion Payments", "Kestrel AI")).toBeLessThan(0.5);
  });
  it("matches companies via website domain", () => {
    expect(bestCompany("tavor", FIXTURE_COMPANIES, "tavor")?.company.id).toBe("c_tavor");
  });
  it("scores title similarity with abbreviations", () => {
    expect(titleSimilarity("Sr. Front-End Engineer", "Senior Frontend Engineer")).toBeGreaterThan(0.9);
    expect(titleSimilarity("Data Scientist", "Senior Frontend Engineer")).toBeLessThan(0.4);
  });
});

describe("scoring & thresholds", () => {
  it("reaches strict threshold only with strong signals", () => {
    const strong = scoreCandidate({
      strongPhrase: true,
      atsSender: true,
      companySource: "text",
      companyMatch: 1,
      hasTitle: true,
      jobMatch: 1,
    });
    expect(strong.score).toBe(100);
    const weak = scoreCandidate({
      strongPhrase: false,
      atsSender: false,
      companySource: "domain",
      companyMatch: 0,
      hasTitle: false,
      jobMatch: 0,
    });
    expect(weak.score).toBe(25);
    expect(shouldAutoApply(70, "STRICT")).toBe(false);
    expect(shouldAutoApply(70, "BALANCED")).toBe(true);
    expect(shouldAutoApply(50, "AGGRESSIVE")).toBe(true);
  });
  it("never downgrades or leaves rejected", () => {
    expect(nextStatus("INTERVIEW", "APPLIED")).toBeNull();
    expect(nextStatus("SAVED", "APPLIED")).toBe("APPLIED");
    expect(nextStatus("APPLIED", "REJECTED")).toBe("REJECTED");
    expect(nextStatus("REJECTED", "INTERVIEW")).toBeNull();
    expect(nextStatus("OFFER", "REJECTED")).toBeNull();
  });
});

describe("analyzeMessage", () => {
  it("auto-creates a high-confidence application matched to a job", () => {
    const a = analyzeMessage(E.greenhouse, ctx({ confidence: "STRICT" }))!;
    expect(a).toMatchObject({ action: "create", matchedJobId: "j_orion_fe", company: "Orion Payments" });
    expect(a.confidence).toBeGreaterThanOrEqual(85);
  });
  it("matches Hebrew confirmations to Hebrew jobs", () => {
    const a = analyzeMessage(E.comeetHebrew, ctx())!;
    expect(a).toMatchObject({ action: "create", matchedJobId: "j_tavor_fs" });
  });
  it("sends unknown companies to review under strict, auto-adds under aggressive", () => {
    expect(analyzeMessage(E.unknownCompany, ctx({ confidence: "STRICT" }))!.action).toBe("review");
    expect(analyzeMessage(E.unknownCompany, ctx({ confidence: "AGGRESSIVE" }))!.action).toBe("create");
  });
  it("skips weak newsletter matches", () => {
    const a = analyzeMessage(E.weak, ctx({ confidence: "AGGRESSIVE" }));
    expect(a === null || a.action === "skip").toBe(true);
  });
  it("dedupes against an existing application", () => {
    const apps = [
      {
        id: "a1",
        jobId: "j_orion_fe",
        company: "Orion Payments",
        title: "Senior Frontend Engineer",
        status: "APPLIED" as const,
      },
    ];
    expect(analyzeMessage(E.greenhouse, ctx({ applications: apps }))!).toMatchObject({
      action: "duplicate",
      applicationId: "a1",
    });
  });
  it("promotes a SAVED application to APPLIED", () => {
    const apps = [
      {
        id: "a1",
        jobId: "j_orion_fe",
        company: "Orion Payments",
        title: "Senior Frontend Engineer",
        status: "SAVED" as const,
      },
    ];
    expect(analyzeMessage(E.greenhouse, ctx({ applications: apps }))!).toMatchObject({
      action: "update",
      newStatus: "APPLIED",
    });
  });
  it("applies a rejection to the matching application", () => {
    const apps = [
      {
        id: "a2",
        jobId: "j_nimbus_ds",
        company: "Nimbus Data Ltd.",
        title: "Data Scientist",
        status: "APPLIED" as const,
      },
    ];
    expect(analyzeMessage(E.rejection, ctx({ applications: apps }))!).toMatchObject({
      kind: "STATUS_UPDATE",
      action: "update",
      newStatus: "REJECTED",
      applicationId: "a2",
    });
  });
  it("puts status updates without a matching application into review", () => {
    expect(analyzeMessage(E.offer, ctx())!).toMatchObject({
      kind: "STATUS_UPDATE",
      action: "review",
      detectedStatus: "OFFER",
    });
  });
  it("ignores status updates when the toggle is off", () => {
    expect(analyzeMessage(E.rejection, ctx({ detectStatusUpdates: false }))).toBeNull();
  });
});

describe("gmail query", () => {
  it("covers EN/HE phrases and ATS senders within the lookback", () => {
    const q = buildGmailQuery(14, { statusUpdates: true });
    expect(q).toContain("newer_than:14d");
    expect(q).toContain('"thank you for applying"');
    expect(q).toContain('"קיבלנו את קורות החיים"');
    expect(q).toContain("greenhouse.io");
    expect(q).toContain("comeet.co");
    expect(buildGmailQuery(7, { statusUpdates: false })).not.toContain("לצערנו");
  });
});

describe("token crypto & feature flag", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  it("round-trips and does not leak plaintext", () => {
    const k = loadKey(key);
    const enc = encryptSecret("synthetic-refresh-token", k);
    expect(enc).not.toContain("synthetic");
    expect(decryptSecret(enc, k)).toBe("synthetic-refresh-token");
    expect(() =>
      decryptSecret(
        enc.replace(/.$/, (c) => (c === "A" ? "B" : "A")),
        k,
      ),
    ).toThrow();
  });
  it("rejects bad keys and gates the feature", () => {
    expect(loadKey("short")).toBeNull();
    expect(isGmailConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isGmailConfigured({
        GOOGLE_CLIENT_ID: "x",
        GOOGLE_CLIENT_SECRET: "y",
        EMAIL_TOKEN_ENC_KEY: key,
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});

describe("schedule", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("respects per-user frequency", () => {
    expect(isDue("MANUAL", null, now)).toBe(false);
    expect(isDue("DAILY", null, now)).toBe(true);
    expect(isDue("DAILY", new Date("2026-10-27T00:00:00Z"), now)).toBe(false);
    expect(isDue("DAILY", new Date("2026-10-26T10:00:00Z"), now)).toBe(true);
    expect(isDue("EVERY_6H", new Date("2026-10-27T06:30:00Z"), now)).toBe(true);
    expect(isDue("EVERY_6H", new Date("2026-10-27T09:00:00Z"), now)).toBe(false);
  });
});

describe("title cleanup", () => {
  it("drops a trailing 'at Company' from the extracted title", () => {
    const r = extract(E.offer);
    expect(r.title).toBe("Machine Learning Engineer");
  });
});
