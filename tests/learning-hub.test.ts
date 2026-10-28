import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiOutcome, AiStore } from "@/lib/ai/guard";
import { genericStageContent, normalizeStageContent, stageContentSchema } from "@/lib/learning/content";
import { STATIC_SKILLS, staticStageContent } from "@/lib/learning/content-static";
import { buildGraph, GRAPH } from "@/lib/learning/graph";
import {
  allStagesDone,
  dayKey,
  learningStats,
  nextReview,
  parsePractice,
  reviewQueue,
  skillRollup,
  streakDays,
  weekKeys,
  type StageRow,
} from "@/lib/learning/progress";
import { recommend } from "@/lib/learning/recommend";
import {
  handleTutorTurn,
  looksLikeSecret,
  offlineTutorReply,
  tutorLevel,
  tutorRequestSchema,
  tutorSystemPrompt,
  TUTOR_PER_MINUTE,
  type TutorDeps,
  type TutorRepo,
} from "@/lib/learning/tutor";
import { STAGES, type SkillNode } from "@/lib/learning/types";

const node = (id: string, prerequisites: string[] = [], topics = ["a", "b"]): SkillNode => ({
  id,
  label: id.toUpperCase(),
  aliases: [],
  category: "devops",
  prerequisites,
  hours: 10,
  summary: { he: "", en: "" },
  stages: { fundamentals: topics, intermediate: topics, applied: topics },
  docs: { title: "", url: "https://example.com", by: "" },
  course: { title: "", url: "https://example.com", by: "" },
  project: { he: "", en: "" },
});

const row = (
  stage: string,
  status: "LEARNING" | "DONE",
  topicsDone: string[] = [],
  practice: unknown = {},
): StageRow => ({
  skill: "x",
  stage,
  status,
  topicsDone,
  practice,
  updatedAt: new Date(),
});

const validContent = {
  exercises: [
    {
      title: "Run a container",
      goal: "Run nginx",
      steps: ["docker run nginx", "curl it"],
      expected: "Welcome page",
      hints: ["-p maps ports"],
      checklist: ["it runs"],
      level: "easy",
    },
  ],
  questions: [
    { q: "Image vs container?", a: "An image is a template.", kind: "compare" },
    { q: "Why layers matter?", a: "Caching and reuse.", kind: "why" },
    { q: "What does -d do?", a: "Runs detached.", kind: "concept" },
  ],
};

describe("recommend", () => {
  const g = buildGraph([node("base"), node("mid", ["base"]), node("top", ["mid"]), node("side"), node("other")]);
  const base = {
    known: new Set<string>(),
    inProgress: new Map<string, number>(),
    demand: new Map<string, number>(),
    targetRoles: [],
    graph: g,
    impact: new Map<string, { jobs: number; avgGain: number }>(),
  };

  it("only recommends learnable skills, in-progress first", () => {
    const out = recommend({
      ...base,
      inProgress: new Map([["side", 0.5]]),
      impact: new Map([["base", { jobs: 3, avgGain: 5 }]]),
      demand: new Map([["other", 4]]),
    });
    expect(out.map((r) => r.id)).toEqual(["side", "base", "other"]);
    expect(out[0].reasons[0]).toEqual({ kind: "continue", pct: 50 });
    expect(out.find((r) => r.id === "mid")).toBeUndefined();
  });

  it("passes impact of a locked skill to its ready prerequisite (foundation)", () => {
    const out = recommend({ ...base, impact: new Map([["top", { jobs: 10, avgGain: 8 }]]) });
    expect(out[0].id).toBe("base");
    expect(out[0].reasons).toContainEqual({ kind: "foundation", forId: "top" });
  });

  it("is deterministic, skips known skills and breaks ties by id", () => {
    const input = {
      ...base,
      known: new Set(["base"]),
      demand: new Map([
        ["side", 1],
        ["other", 1],
        ["mid", 1],
      ]),
    };
    const a = recommend(input);
    expect(a).toEqual(recommend(input));
    expect(a.map((r) => r.id)).toEqual(["mid", "other", "side"]);
    expect(a[0].reasons).toContainEqual({ kind: "prereqsMet", prereqs: ["base"] });
  });

  it("works on the real graph with a role track", () => {
    const out = recommend(
      { known: new Set(), inProgress: new Map(), impact: new Map(), demand: new Map(), targetRoles: ["devops"] },
      4,
    );
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(GRAPH.byId.get(r.id)!.prerequisites).toEqual([]);
    expect(out[0].reasons.some((x) => x.kind === "role")).toBe(true);
  });
});

describe("progress", () => {
  const n = node("x", [], ["t1", "t2", "t3"]);

  it("rolls stages up and finds the next stage", () => {
    const r = skillRollup(n, [
      row("fundamentals", "DONE"),
      row("intermediate", "LEARNING", ["t1", "nope"], { e1: { done: true } }),
    ]);
    expect(r.doneStages).toBe(1);
    expect(r.nextStage).toBe("intermediate");
    expect(r.stages[1]).toMatchObject({ state: "active", topicsDone: 1, practiceDone: 1 });
    expect(r.stages[2].state).toBe("todo");
    expect(r.pct).toBe(Math.round(((1 + 0.3) / 3) * 100));
    expect(skillRollup(n, [], "DONE")).toMatchObject({ pct: 100, nextStage: null });
  });

  it("detects when every stage is done", () => {
    expect(
      allStagesDone(
        "x",
        STAGES.map((s) => row(s, "DONE")),
      ),
    ).toBe(true);
    expect(allStagesDone("x", [row("fundamentals", "DONE"), row("intermediate", "DONE")])).toBe(false);
  });

  it("parses practice state defensively", () => {
    expect(parsePractice({ e1: { done: true, notes: "hi" } })).toEqual({ e1: { done: true, notes: "hi" } });
    expect(parsePractice("junk")).toEqual({});
  });

  it("computes days, weeks and streaks in Israel time", () => {
    // 23:30 UTC on Sat is already Sunday in Israel (UTC+2/3).
    expect(dayKey(new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
    const wed = new Date("2026-10-28T10:00:00Z");
    expect(weekKeys(wed)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]);
    const days = ["2026-10-25T08:00:00Z", "2026-10-26T08:00:00Z", "2026-10-27T08:00:00Z"].map((d) => new Date(d));
    expect(streakDays(days, wed)).toBe(3); // yesterday still counts
    expect(streakDays([...days, wed], wed)).toBe(4);
    expect(streakDays([new Date("2026-10-20T08:00:00Z")], wed)).toBe(0);
    const s = learningStats(
      [
        { minutes: 30, createdAt: new Date("2026-10-26T08:00:00Z") },
        { minutes: 60, createdAt: new Date("2026-10-20T08:00:00Z") },
      ],
      [new Date("2026-10-28T07:00:00Z")],
      wed,
    );
    expect(s).toEqual({ minutesThisWeek: 30, totalMinutes: 90, activeDaysThisWeek: 2, streak: 1 });
  });

  it("schedules reviews and queues weakest first", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    expect(nextReview("MISSED", 3, now)).toEqual({ reps: 0, dueAt: now });
    expect(nextReview("PARTLY", 2, now).dueAt.getTime() - now.getTime()).toBe(86_400_000);
    expect(nextReview("KNEW", 0, now)).toMatchObject({ reps: 1 });
    expect((nextReview("KNEW", 2, now).dueAt.getTime() - now.getTime()) / 86_400_000).toBe(7);
    expect((nextReview("KNEW", 9, now).dueAt.getTime() - now.getTime()) / 86_400_000).toBe(35);
    const past = new Date(now.getTime() - 1000);
    const q = reviewQueue(
      [
        { id: "k", rating: "KNEW" as const, dueAt: past },
        { id: "m", rating: "MISSED" as const, dueAt: past },
        { id: "f", rating: "MISSED" as const, dueAt: new Date(now.getTime() + 1000) },
        { id: "p", rating: "PARTLY" as const, dueAt: past },
      ],
      now,
    );
    expect(q.map((c) => c.id)).toEqual(["m", "p", "k"]);
  });
});

describe("stage content", () => {
  it("validates and attaches stable unique ids", () => {
    const a = normalizeStageContent(validContent)!;
    const b = normalizeStageContent(structuredClone(validContent))!;
    expect(a.exercises[0].id).toBe(b.exercises[0].id);
    expect(new Set(a.questions.map((q) => q.id)).size).toBe(3);
    const dup = normalizeStageContent({
      ...validContent,
      questions: [...validContent.questions, validContent.questions[0]],
    })!;
    expect(new Set(dup.questions.map((q) => q.id)).size).toBe(4);
  });

  it("rejects malformed content", () => {
    expect(normalizeStageContent({ exercises: [], questions: validContent.questions })).toBeNull();
    expect(normalizeStageContent({ ...validContent, questions: validContent.questions.slice(0, 2) })).toBeNull();
    expect(
      normalizeStageContent({
        exercises: [{ ...validContent.exercises[0], level: "insane" }],
        questions: validContent.questions,
      }),
    ).toBeNull();
    expect(normalizeStageContent(null)).toBeNull();
  });

  it("generic fallback content is always valid", () => {
    for (const id of ["docker", "react", "python"]) {
      const n = GRAPH.byId.get(id)!;
      for (const st of STAGES)
        for (const loc of ["he", "en"] as const)
          expect(stageContentSchema.safeParse(genericStageContent(n, st, loc)).success).toBe(true);
    }
  });

  it("curated static content covers ~15 graph skills, every stage, both languages", () => {
    expect(STATIC_SKILLS.length).toBeGreaterThanOrEqual(15);
    for (const id of STATIC_SKILLS) {
      expect(GRAPH.byId.has(id)).toBe(true);
      for (const st of STAGES)
        for (const loc of ["he", "en"] as const)
          expect(staticStageContent(id, st, loc), `${id}/${st}/${loc}`).not.toBeNull();
    }
    expect(staticStageContent("not-a-skill", "fundamentals", "he")).toBeNull();
  });
});

// ── Tutor ──

const COUNTED: AiOutcome[] = ["ok", "error", "rate_limited"];
function memoryStore() {
  const usage: { userId: string | null; feature: string; outcome: AiOutcome; at: Date }[] = [];
  const store: AiStore = {
    getCache: async () => null,
    putCache: async () => {},
    countCalls: async (since, userId) =>
      usage.filter((u) => u.at >= since && COUNTED.includes(u.outcome) && (!userId || u.userId === userId)).length,
    record: async (e) => void usage.push({ userId: e.userId, feature: e.feature, outcome: e.outcome, at: new Date() }),
  };
  return { store, usage };
}

function memoryRepo() {
  const threads: { id: string; userId: string; messages: { role: string; content: string }[] }[] = [];
  const repo: TutorRepo = {
    async thread(userId, _skill, _stage, threadId) {
      const t = threads.find((x) => x.id === threadId && x.userId === userId);
      if (t) return t;
      const created = { id: `t${threads.length + 1}`, userId, messages: [] };
      threads.push(created);
      return created;
    },
    history: async (id, limit) => threads.find((t) => t.id === id)!.messages.slice(-limit),
    add: async (id, role, content) => void threads.find((t) => t.id === id)!.messages.push({ role, content }),
  };
  return { repo, threads };
}

function streamingModel(text: string) {
  const calls: unknown[] = [];
  const model = new MockLanguageModelV3({
    doStream: async (opts) => {
      calls.push(opts);
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "1" },
            ...text.split(" ").map((w, i) => ({ type: "text-delta" as const, id: "1", delta: (i ? " " : "") + w })),
            { type: "text-end", id: "1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
              },
            },
          ] as never,
        }),
      };
    },
  });
  return { model, calls };
}

const docker = GRAPH.byId.get("docker")!;
const content = normalizeStageContent(validContent)!;
const cfg = { userDailyLimit: 3, globalDailyCap: 100, globalPerMinute: 50 };

function deps(over: Partial<TutorDeps> = {}) {
  const { store, usage } = memoryStore();
  const { repo, threads } = memoryRepo();
  const d: TutorDeps = {
    userId: "u1",
    node: docker,
    locale: "he",
    system: tutorSystemPrompt({ node: docker, stage: "fundamentals", locale: "he", level: "beginner", content }),
    model: null,
    modelName: "gemini:test",
    store,
    cfg,
    repo,
    recentTutorCalls: async () => usage.filter((u) => u.feature === "tutor_chat" && COUNTED.includes(u.outcome)).length,
    offlineReply: offlineTutorReply("he", content, 0),
    ...over,
  };
  return { d, usage, threads };
}

async function readStream(res: Response) {
  const raw = await res.text();
  const events = raw
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
  const text = events
    .filter((e) => e.type === "text-delta")
    .map((e) => e.delta)
    .join("");
  const start = events.find((e) => e.type === "start");
  return { text, metadata: start?.messageMetadata, events };
}

const req = (text: string, threadId?: string) =>
  tutorRequestSchema.parse({ skill: "docker", stage: "fundamentals", text, threadId });

describe("tutor", () => {
  it("validates requests (length, stage)", () => {
    expect(
      tutorRequestSchema.safeParse({ skill: "docker", stage: "fundamentals", text: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(tutorRequestSchema.safeParse({ skill: "docker", stage: "expert", text: "hi" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ skill: "docker", stage: "fundamentals", text: "   " }).success).toBe(false);
  });

  it("flags credentials and never sends them to the model", async () => {
    expect(looksLikeSecret("my key is AKIAABCDEFGHIJKLMNOP")).toBe(true);
    expect(looksLikeSecret("password = hunter2hunter2")).toBe(true);
    expect(looksLikeSecret("postgres://user:s3cretpw@db.example.com/x")).toBe(true);
    expect(looksLikeSecret("how do I pass a password to docker login safely?")).toBe(false);
    const { model, calls } = streamingModel("x");
    const { d, threads } = deps({ model });
    const res = await handleTutorTurn(req("token: ghp_abcdefghijklmnopqrstuvwxyz0123456789"), d);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "secret" });
    expect(calls).toHaveLength(0);
    expect(threads).toHaveLength(0);
  });

  it("streams a reply, persists both turns and records usage", async () => {
    const { model, calls } = streamingModel("שאלה טובה! מה לדעתך ההבדל?");
    const { d, usage, threads } = deps({ model });
    const res = await handleTutorTurn(req("מה זה image?"), d);
    expect(res.status).toBe(200);
    const out = await readStream(res);
    expect(out.text).toBe("שאלה טובה! מה לדעתך ההבדל?");
    expect(out.metadata).toEqual({ threadId: "t1", remaining: 2 });
    await new Promise((r) => setTimeout(r, 10));
    expect(threads[0].messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(usage).toMatchObject([{ userId: "u1", feature: "tutor_chat", outcome: "ok" }]);
    const prompt = JSON.stringify(calls[0]);
    expect(prompt).toContain("Socratic");
    expect(prompt).toContain("Hebrew");
  });

  it("continues an existing thread with history and ignores foreign thread ids", async () => {
    const { model, calls } = streamingModel("ok");
    const { d, threads } = deps({ model });
    await readStream(await handleTutorTurn(req("first"), d));
    await new Promise((r) => setTimeout(r, 10));
    await readStream(await handleTutorTurn(req("second", "t1"), d));
    expect(threads).toHaveLength(1);
    expect(JSON.stringify(calls[1])).toContain("first");
    const other = await handleTutorTurn(req("hi", "t1"), { ...d, userId: "u2" });
    expect((await readStream(other)).metadata.threadId).toBe("t2");
  });

  it("returns 429 when the daily per-user limit is used up", async () => {
    const { model, calls } = streamingModel("ok");
    const { d, usage } = deps({ model, recentTutorCalls: async () => 0 });
    for (let i = 0; i < cfg.userDailyLimit; i++)
      usage.push({ userId: "u1", feature: "cv", outcome: "ok", at: new Date() });
    const res = await handleTutorTurn(req("hi"), d);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "limit", reason: "user_daily" });
    expect(calls).toHaveLength(0);
  });

  it("enforces the per-minute burst limit", async () => {
    const { model } = streamingModel("ok");
    const { d } = deps({ model, recentTutorCalls: async () => TUTOR_PER_MINUTE });
    const res = await handleTutorTurn(req("hi"), d);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "limit", reason: "burst" });
  });

  it("offline mode streams a labelled practice question without counting quota", async () => {
    const { d, usage } = deps();
    const out = await readStream(await handleTutorTurn(req("hi"), d));
    expect(out.text).toContain(content.questions[0].q);
    expect(out.metadata).toEqual({ threadId: "t1", remaining: null });
    expect(usage).toHaveLength(0);
  });

  it("picks a level from the stage and known prerequisites", () => {
    expect(tutorLevel("fundamentals", 0, 2)).toBe("beginner");
    expect(tutorLevel("fundamentals", 2, 2)).toBe("intermediate");
    expect(tutorLevel("applied", 0, 0)).toBe("advanced");
  });
});
