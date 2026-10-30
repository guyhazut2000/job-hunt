import { beforeEach, describe, expect, it, vi } from "vitest";
import { coverage, mentionsComplexity, starParts } from "@/lib/interview/analyze";
import { SHORT_FOLLOWUP, STAR_FOLLOWUPS, t } from "@/lib/interview/bank";
import { MAX_FOLLOWUPS, nextStep } from "@/lib/interview/flow";
import { heuristicFeedback, normalizeFeedback, overallScore, RUBRIC } from "@/lib/interview/grade";
import { normalizePlan, offlinePlan, pickProblems, PLAN_SIZE, techTopics } from "@/lib/interview/plan";
import type { InterviewContext, PlannedQuestion, Turn } from "@/lib/interview/types";
import { PROBLEMS } from "@/lib/algo/problems";
import { AiLimitError } from "@/lib/ai/errors";
import { buildInterviewReminder, interviewReminderUrl } from "@/lib/notifications/interviews";

const llm = vi.hoisted(() => ({
  provider: null as null | { name: string; complete: (...a: unknown[]) => Promise<string> },
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ai", () => ({ guardedLLM: async () => llm.provider }));

const ctx: InterviewContext = {
  title: "Senior Backend Engineer",
  company: "Acme",
  description: "Build APIs in Node.js and Postgres. Kafka is a plus.",
  techStack: ["Node.js", "PostgreSQL", "Kafka"],
  stages: [
    { kind: "HR", title: "HR call" },
    { kind: "SYSTEM_DESIGN", title: "System design" },
  ],
  concepts: ["Idempotency"],
  background: "Backend developer, 5 years",
};

const LONG = "I worked on this for a few weeks with my team and we shipped it to production in the end";

describe("offline plans", () => {
  it("HR: intro + why-company + stories, filled with the company and role", () => {
    const p = offlinePlan("HR", ctx, "en", 1);
    expect(p).toHaveLength(PLAN_SIZE.HR);
    expect(p[1].q).toContain("Acme");
    expect(p.every((q) => q.q && q.focus && q.followUps.length > 0)).toBe(true);
    expect(new Set(p.map((q) => q.q)).size).toBe(p.length);
    expect(offlinePlan("HR", ctx, "he", 1)[0].q).toMatch(/[\u0590-\u05FF]/);
  });

  it("HR rotates stories between sessions", () => {
    const a = offlinePlan("HR", ctx, "en", 1).map((q) => q.q);
    const b = offlinePlan("HR", ctx, "en", 2).map((q) => q.q);
    expect(a).not.toEqual(b);
  });

  it("TECH: concepts first, then the tech stack, plus system design when the process has it", () => {
    expect(techTopics(ctx)[0]).toBe("Idempotency");
    const p = offlinePlan("TECH", ctx, "en", 3);
    expect(p).toHaveLength(PLAN_SIZE.TECH);
    expect(p[0].q).toContain("Idempotency");
    expect(p.some((q) => /design/i.test(q.q))).toBe(true);
    const bare = { ...ctx, techStack: [], concepts: [], stages: [] };
    expect(techTopics(bare).length).toBeGreaterThan(0);
  });

  it("PROBLEM: our own problems, increasing difficulty, distinct patterns", () => {
    const ps = pickProblems(7);
    expect(ps).toHaveLength(3);
    expect(ps[0].difficulty).toBe("easy");
    expect(new Set(ps.map((p) => p.patterns[0])).size).toBe(3);
    const plan = offlinePlan("PROBLEM", ctx, "en", 7);
    expect(plan.every((q) => q.problemId && PROBLEMS.some((p) => p.id === q.problemId))).toBe(true);
    expect(plan[0].followUps).toHaveLength(2);
  });
});

describe("answer analysis", () => {
  it("detects STAR parts in English and Hebrew", () => {
    const en = starParts("At my last job we had an outage. My task was to fix it. I added retries, and as a result errors fell by 30%.");
    expect(en).toEqual({ s: true, t: true, a: true, r: true });
    const he = starParts("בעבודה הקודמת שלי היה צריך לשפר ביצועים. אני כתבתי מטמון, והתוצאה הייתה שיפור של 40%.");
    expect(he.a && he.r).toBe(true);
    expect(starParts("hello").r).toBe(false);
  });

  it("complexity and keyword coverage", () => {
    expect(mentionsComplexity("it runs in O(n log n)")).toBe(true);
    expect(coverage("use a hash map and two pointers", ["hash map", "sorting"])).toBeCloseTo(0.5);
  });
});

describe("follow-up flow", () => {
  const plan: PlannedQuestion[] = offlinePlan("HR", ctx, "en", 1);

  it("asks to expand a very short first answer", () => {
    expect(nextStep(plan, "HR", "en", 0, [], "I am a dev")).toEqual({ kind: "followup", text: t(SHORT_FOLLOWUP, "en") });
  });

  it("HR asks for the missing STAR part (result first)", () => {
    const step = nextStep(plan, "HR", "en", 2, [], "When we had a flaky deploy process my task was to own it, so I built the new pipeline myself with two scripts.");
    expect(step).toEqual({ kind: "followup", text: t(STAR_FOLLOWUPS.r, "en") });
  });

  it("never repeats a follow-up and stops at the cap", () => {
    const first = nextStep(plan, "HR", "en", 2, [], LONG);
    expect(first.kind).toBe("followup");
    const asked = [(first as { text: string }).text];
    const second = nextStep(plan, "HR", "en", 2, asked, LONG);
    if (second.kind === "followup") expect(asked).not.toContain(second.text);
    const capped = nextStep(plan, "HR", "en", 2, Array(MAX_FOLLOWUPS.HR).fill("x"), LONG);
    expect(capped).toEqual({ kind: "next", index: 3 });
    expect(nextStep(plan, "HR", "en", plan.length - 1, Array(MAX_FOLLOWUPS.HR).fill("x"), LONG)).toEqual({ kind: "done" });
  });

  it("PROBLEM skips follow-ups the answer already covers", () => {
    const pp = offlinePlan("PROBLEM", ctx, "en", 7);
    const ans = `${LONG}. I would use a hash map, it is O(n) time, and for an empty array or duplicates I return early.`;
    expect(nextStep(pp, "PROBLEM", "en", 0, [], ans)).toEqual({ kind: "next", index: 1 });
    const noComplexity = `${LONG}. I would use a hash map and check every element once against it.`;
    expect(nextStep(pp, "PROBLEM", "en", 0, [], noComplexity)).toEqual({ kind: "followup", text: pp[0].followUps[0] });
  });
});

function turnsFor(plan: PlannedQuestion[], answers: (string | null)[]): Turn[] {
  return answers.flatMap((a, i): Turn[] => [
    { role: "interviewer", kind: "question", content: plan[i].q, questionIndex: i },
    a === null
      ? { role: "candidate", kind: "skip", content: "", questionIndex: i }
      : { role: "candidate", kind: "answer", content: a, questionIndex: i },
  ]);
}

describe("feedback", () => {
  const plan = offlinePlan("HR", ctx, "en", 1);
  const strong =
    "At my previous company we had a slow checkout. My goal was to fix it before Black Friday. I profiled the service, I added caching and led two engineers. As a result latency dropped by 45% and conversion rose 3%.";

  it("offline grader scores every rubric dimension and rewards STAR answers", () => {
    const good = heuristicFeedback("HR", plan, turnsFor(plan, plan.map(() => strong)), "en");
    const weak = heuristicFeedback("HR", plan, turnsFor(plan, plan.map((_, i) => (i ? null : "ok"))), "en");
    expect(good.dimensions.map((d) => d.key)).toEqual(RUBRIC.HR.map((r) => r.key));
    expect(good.dimensions.every((d) => d.score >= 1 && d.score <= 5)).toBe(true);
    expect(overallScore(good)).toBeGreaterThan(overallScore(weak));
    expect(weak.improvements.length).toBeGreaterThan(0);
    expect(good.perQuestion).toHaveLength(plan.length);
  });

  it("normalizes AI feedback: clamps scores, keeps rubric keys, fills gaps from the fallback", () => {
    const fb = heuristicFeedback("TECH", plan, [], "en");
    const out = normalizeFeedback(
      {
        summary: "Solid",
        dimensions: [
          { key: "depth", score: 9, note: "deep" },
          { key: "bogus", score: 3, note: "x" },
        ],
        perQuestion: [{ index: 0, strength: "clear", improve: "numbers" }],
        improvements: [],
      },
      "TECH",
      fb,
      "en",
    )!;
    expect(out.dimensions.map((d) => d.key)).toEqual(RUBRIC.TECH.map((r) => r.key));
    expect(out.dimensions[0].score).toBe(5);
    expect(out.dimensions[1]).toEqual(fb.dimensions[1]);
    expect(out.perQuestion[0].strength).toBe("clear");
    expect(out.improvements).toEqual(fb.improvements);
    expect(normalizeFeedback({ nope: 1 }, "TECH", fb, "en")).toBeNull();
  });
});

describe("AI plan", () => {
  const fallback = offlinePlan("TECH", ctx, "en", 1);
  const ai = (n: number) => ({
    questions: Array.from({ length: n }, (_, i) => ({
      q: `How would you design idempotent Kafka consumers, case ${i}?`,
      followUps: ["What about retries?"],
      focus: "Exactly-once trade-offs",
      expected: ["idempotency key", "retries"],
    })),
  });

  it("normalizePlan pads short plans from the offline plan and rejects tiny ones", () => {
    const p = normalizePlan(ai(3), fallback, 5)!;
    expect(p).toHaveLength(5);
    expect(p[3]).toEqual(fallback[0]);
    expect(normalizePlan(ai(2), fallback, 5)).toBeNull();
    expect(normalizePlan(ai(8), fallback, 5)).toHaveLength(5);
  });

  beforeEach(() => {
    llm.provider = null;
  });

  it("planInterview: AI when available, offline for mock / PROBLEM, 'limited' on the daily cap", async () => {
    const { planInterview } = await import("@/lib/interview/server");
    const complete = vi.fn(async () => JSON.stringify(ai(5)));
    llm.provider = { name: "gemini", complete };
    const r = await planInterview("u1", "TECH", ctx, "en", 1);
    expect(r.source).toBe("ai");
    expect(r.plan[0].q).toContain("Kafka");
    expect(complete).toHaveBeenCalledTimes(1);

    const p = await planInterview("u1", "PROBLEM", ctx, "en", 1);
    expect(p.source).toBe("offline");
    expect(complete).toHaveBeenCalledTimes(1);

    llm.provider = { name: "mock", complete };
    expect((await planInterview("u1", "HR", ctx, "en", 1)).source).toBe("offline");

    llm.provider = {
      name: "gemini",
      complete: async () => {
        throw new AiLimitError("user_daily");
      },
    };
    const lim = await planInterview("u1", "HR", ctx, "en", 1);
    expect(lim).toMatchObject({ source: "limited", reason: "user_daily" });
    expect(lim.plan).toHaveLength(PLAN_SIZE.HR);
  });
});

describe("interview reminders link to practice", () => {
  const app = { id: "a1", jobId: "j1" };
  it("a day before → practice interview; close to it → job page", () => {
    expect(interviewReminderUrl(app, "24h")).toBe("/interview?app=a1");
    expect(interviewReminderUrl(app, "2h")).toBe("/jobs/j1");
    expect(interviewReminderUrl({ id: "a1", jobId: null }, "2h")).toBe("/dashboard");
    const now = new Date("2026-10-30T10:00:00Z");
    const m = buildInterviewReminder(
      "en",
      { id: "a1", title: "Dev", company: "Acme", interviewAt: new Date("2026-10-31T08:00:00Z"), interviewNote: null },
      "24h",
      now,
    );
    expect(m.body).toMatch(/practice interview/i);
  });
});
