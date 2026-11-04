import { describe, expect, it } from "vitest";
import { demoContent } from "@/lib/cv-templates/content";
import {
  ABOUT_MAX,
  EMPTY_LINKEDIN,
  HEADLINE_MAX,
  evaluateLinkedin,
  recommendationRequestDraft,
  suggestAbout,
  suggestHeadline,
  validateLinkedinAi,
  type LinkedinInput,
} from "@/lib/linkedin/profile";
import { ASK_MANAGER, MANAGER_SOURCES, QUESTIONS, checkSignals, starTemplate } from "@/lib/manager/bank";
import { WRITTEN_TERMS, cleanAsks, offerReplyDraft, offerTermLines } from "@/lib/closing/reply";
import { EMPTY_OFFER } from "@/lib/offers/calc";

const cv = demoContent("en");
const ctx = { cv, targetRoles: ["Senior Backend Engineer"] };
const status = (r: ReturnType<typeof evaluateLinkedin>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("linkedin profile rules", () => {
  it("empty input fails headline/about and skips the rest", () => {
    const r = evaluateLinkedin(EMPTY_LINKEDIN, ctx);
    expect(status(r, "headlineLength")).toBe("fail");
    expect(status(r, "aboutLength")).toBe("fail");
    expect(status(r, "expQuantified")).toBe("na");
    expect(status(r, "cvCompanies")).toBe("na");
    expect(r.total).toBeLessThan(r.checks.length);
  });

  it("flags an over-long headline and clichés", () => {
    const r = evaluateLinkedin(
      { ...EMPTY_LINKEDIN, headline: `Passionate team player ${"x".repeat(HEADLINE_MAX)}` },
      ctx,
    );
    expect(status(r, "headlineLength")).toBe("fail");
    expect(status(r, "headlineCliche")).toBe("warn");
  });

  it("a headline with the role and two skills passes", () => {
    const [a, b] = cv.skills;
    const r = evaluateLinkedin({ ...EMPTY_LINKEDIN, headline: `Senior Backend Engineer | ${a} · ${b}` }, ctx);
    expect(status(r, "headlineRole")).toBe("pass");
    expect(status(r, "headlineSkills")).toBe("pass");
  });

  it("experience quantification and CV consistency", () => {
    const input: LinkedinInput = {
      ...EMPTY_LINKEDIN,
      experience: "- Led the migration of billing to a new service, cutting latency by 40%\n- Wrote some internal tools for the team",
      skills: cv.skills.slice(0, 2).join(", "),
    };
    const r = evaluateLinkedin(input, ctx);
    expect(status(r, "expQuantified")).toBe("pass");
    expect(r.missing.companies.length).toBeGreaterThan(0);
    expect(status(r, "cvCompanies")).toBe("warn");
  });

  it("suggestions use only CV words and stay within limits", () => {
    const h = suggestHeadline(ctx, "en");
    expect(h.length).toBeLessThanOrEqual(HEADLINE_MAX);
    expect(h).toContain("Senior Backend Engineer");
    const about = suggestAbout(ctx, "en");
    expect(about.length).toBeLessThanOrEqual(ABOUT_MAX);
    for (const n of about.match(/\d+/g) ?? []) expect(JSON.stringify(cv)).toContain(n);
  });

  it("the AI guard rejects invented numbers and tools, accepts a rephrase", () => {
    const ok = JSON.stringify({ headline: `Senior Backend Engineer | ${cv.skills[0]}`, about: `${cv.summary} I enjoy building reliable systems.` });
    expect(validateLinkedinAi(ok, ctx, EMPTY_LINKEDIN)).not.toBeNull();
    const nums = JSON.stringify({ headline: "Senior Backend Engineer", about: `${cv.summary} Grew revenue by 987654%.` });
    expect(validateLinkedinAi(nums, ctx, EMPTY_LINKEDIN)).toBeNull();
    const tool = JSON.stringify({ headline: "Senior Backend Engineer", about: `${cv.summary} Expert in Kubernetes and Terraform.` });
    if (!JSON.stringify(cv).includes("Kubernetes")) expect(validateLinkedinAi(tool, ctx, EMPTY_LINKEDIN)).toBeNull();
    expect(validateLinkedinAi("not json", ctx, EMPTY_LINKEDIN)).toBeNull();
  });

  it("recommendation request is copy-only with placeholders", () => {
    const d = recommendationRequestDraft({}, "he");
    expect(d).toContain("[שם]");
    expect(recommendationRequestDraft({ name: "Dana", myName: "Guy" }, "en")).toMatch(/^Hi Dana,[\s\S]*Guy$/);
  });
});

describe("hiring-manager bank", () => {
  it("has ~14 unique questions, all sourced and bilingual", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(MANAGER_SOURCES[q.source]).toBeDefined();
      expect(q.q.he).toMatch(/[\u0590-\u05FF]/);
      expect(q.signals.length).toBeGreaterThan(0);
    }
    for (const s of Object.values(MANAGER_SOURCES)) expect(s.url.startsWith("https://")).toBe(true);
    expect(ASK_MANAGER.flatMap((g) => g.questions).length).toBeGreaterThanOrEqual(8);
  });

  it("signal checker finds ownership, metrics, trade-offs, first person", () => {
    const sig = checkSignals({
      situation: "Our checkout service in production timed out for users",
      task: "I owned the fix",
      action: "I led the redesign and chose a queue instead of synchronous calls; I convinced the payments team",
      result: "p95 latency dropped by 60%. I learned to load-test earlier",
    });
    const ok = Object.fromEntries(sig.map((s) => [s.id, s.ok]));
    expect(ok).toMatchObject({ ownership: true, scope: true, metric: true, tradeoff: true, influence: true, reflection: true, firstPerson: true });
    const weak = Object.fromEntries(checkSignals({ action: "we did it together", result: "it worked" }).map((s) => [s.id, s.ok]));
    expect(weak.firstPerson).toBe(false);
    expect(weak.metric).toBe(false);
  });

  it("Hebrew answers are detected too", () => {
    const ok = Object.fromEntries(checkSignals({ action: "הובלתי את המעבר ובחרתי בתור במקום קריאות סינכרוניות", result: "הזמן ירד ב-30%" }).map((s) => [s.id, s.ok]));
    expect(ok.ownership && ok.tradeoff && ok.metric).toBe(true);
  });

  it("template answer uses only the user's words", () => {
    expect(starTemplate({ situation: "a", task: "", action: "did x", result: "" }, "en")).toBe("The situation: a. What I did: did x.");
  });
});

describe("offer reply email", () => {
  const offer = { ...EMPTY_OFFER, baseMonthly: 32000, signingBonus: 0, equityUnits: 1000 };
  it("acceptance lists only entered terms and the written-terms items", () => {
    const t = offerReplyDraft({ mode: "accept", company: "Acme", role: "Backend Engineer", offer }, "en");
    expect(t).toContain("I accept");
    expect(t).toContain("32,000");
    expect(t).not.toContain("Signing bonus");
    for (const w of WRITTEN_TERMS) expect(t).toContain(w.label.en);
    expect(t).toContain("[your name]");
  });

  it("counter lists the user's asks with their justification; empty asks fall back to accept", () => {
    const asks = [
      { kind: "base" as const, target: "₪35,000 gross", why: "a competing offer at that level" },
      { kind: "remote" as const, target: "", why: "ignored" },
    ];
    const t = offerReplyDraft({ mode: "counter", company: "Acme", role: "Dev", offer, asks }, "he");
    expect(t).toContain("שכר בסיס: ₪35,000 gross – a competing offer at that level.");
    expect(t).not.toContain("ignored");
    expect(cleanAsks(asks)).toHaveLength(1);
    expect(offerReplyDraft({ mode: "counter", company: "A", role: "B", asks: [] }, "en")).toContain("I accept");
  });

  it("no offer data → no invented terms", () => {
    expect(offerTermLines(null, "en")).toEqual([]);
    expect(offerTermLines({ ...EMPTY_OFFER, pensionEmployerPct: 0, severancePct: 0, khEmployerPct: 0 }, "en")).toEqual([]);
  });
});
