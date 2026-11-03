import { describe, expect, it, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => ({
  apps: [] as Array<Record<string, unknown>>,
  stories: [] as Array<{ id: string; userId: string }>,
  preps: [] as Array<Record<string, unknown>>,
  debriefs: [] as Array<Record<string, unknown>>,
  llm: { name: "mock", complete: vi.fn() } as { name: string; complete: ReturnType<typeof vi.fn> },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/db", () => ({
  db: {
    application: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const a = store.apps.find((x) => x.id === where.id && x.userId === where.userId);
        return a ? { job: null, interviewPrep: null, ...a } : null;
      }),
    },
    workStory: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; id?: { in: string[] } } }) =>
        store.stories.filter((s) => s.userId === where.userId && (!where.id || where.id.in.includes(s.id))),
      ),
    },
    interviewPrep: {
      upsert: vi.fn(async (args: Record<string, unknown>) => {
        store.preps.push(args);
        return { id: "p1" };
      }),
    },
    interviewDebrief: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        store.debriefs.push(data);
        return { id: `d${store.debriefs.length}` };
      }),
      findFirst: vi.fn(async () => null),
      delete: vi.fn(),
      findMany: vi.fn(async () => []),
    },
  },
}));
vi.mock("@/lib/ai", () => ({ guardedLLM: vi.fn(async () => store.llm) }));

import { AiLimitError } from "@/lib/ai/errors";
import {
  debriefStats,
  defaultQuestions,
  defaultStages,
  suggestStories,
  suggestTopics,
  templateSummary,
  validateAiSummary,
  type PrepFacts,
} from "@/lib/prep/plan";
import { generatePrepSummary } from "@/lib/prep/server";
import { deleteDebrief, saveDebrief, savePrep } from "@/app/prep/actions";

const facts: PrepFacts = {
  title: "Backend Engineer",
  company: "ShieldGrid",
  techStack: ["Go", "Kafka", "Redis"],
  stages: ["שיחת סינון", "ראיון קוד"],
  description: "Build real-time streaming pipelines with Kafka and a Redis cache.",
  topics: [],
};

beforeEach(() => {
  store.apps = [{ id: "a1", userId: "u1", title: "Backend Engineer", company: "ShieldGrid" }];
  store.stories = [
    { id: "s1", userId: "u1" },
    { id: "s9", userId: "other" },
  ];
  store.preps = [];
  store.debriefs = [];
  store.llm = { name: "mock", complete: vi.fn() };
});

describe("default stages", () => {
  const label = (k: string) => `L:${k}`;
  it("uses the given process (mine/official) and dates the first stage from interviewAt", () => {
    const st = defaultStages(
      [
        { kind: "phone_screen", title: "שיחה עם HR" },
        { kind: "coding", title: "" },
      ],
      label,
      new Date("2026-11-10T09:00:00Z"),
    );
    expect(st.map((s) => [s.kind, s.title])).toEqual([
      ["phone_screen", "שיחה עם HR"],
      ["coding", "L:coding"],
    ]);
    expect(st[0].date).toBe("2026-11-10");
    expect(st[1].date).toBeNull();
    expect(new Set(st.map((s) => s.id)).size).toBe(2);
  });
  it("falls back to a typical process", () => {
    const st = defaultStages(null, label);
    expect(st.length).toBe(5);
    expect(st[0].kind).toBe("phone_screen");
    expect(st.every((s) => !s.done)).toBe(true);
  });
});

describe("topic and story suggestions", () => {
  it("maps job keywords to DS&A topics and adds core topics for coding stages", () => {
    const t = suggestTopics({ title: "Backend", description: "real-time Kafka streams, Redis cache", techStack: [] }, [
      "coding",
    ]);
    expect(t).toEqual(expect.arrayContaining(["ds:heap", "ds:hash-map", "pattern:sliding-window", "ds:array"]));
    expect(new Set(t).size).toBe(t.length);
    expect(t.length).toBeLessThanOrEqual(8);
  });
  it("gives core topics when nothing matches, none for core when no coding and a keyword hits", () => {
    expect(suggestTopics({ title: "x", description: "", techStack: [] }, ["hr"])).toContain("ds:array");
    const t = suggestTopics({ title: "Calendar booking", description: "", techStack: [] }, ["hr"]);
    expect(t).toContain("pattern:intervals");
    expect(t).not.toContain("ds:array");
  });
  it("ranks stories by exact topic match then tech overlap", () => {
    const stories = [
      { id: "a", kind: "ds", itemId: "heap", situation: "priority queue for jobs", built: "" },
      { id: "b", kind: "pattern", itemId: "greedy", situation: "Kafka consumer lag", built: "" },
      { id: "c", kind: "ds", itemId: "trie", situation: "", built: "" },
    ];
    expect(suggestStories(stories, ["ds:heap"], ["Kafka"])).toEqual(["a", "b"]);
  });
});

describe("questions to ask", () => {
  it("combines general + per-stage questions without duplicates", () => {
    const q = defaultQuestions(["phone_screen", "coding", "coding"], "he");
    expect(q.length).toBeGreaterThanOrEqual(4);
    expect(new Set(q.map((x) => x.text)).size).toBe(q.length);
    expect(defaultQuestions(["unknown_kind"], "en")[0].text).toMatch(/typical day/);
  });
});

describe("summary", () => {
  it("template names role and company, lists stages", () => {
    const s = templateSummary(facts, "he");
    expect(s.source).toBe("template");
    expect(s.text).toContain("ShieldGrid");
    expect(s.text).toContain("שיחת סינון → ראיון קוד");
  });
  it("validates AI output", () => {
    const ok = {
      overview: "The ShieldGrid backend role focuses on streaming with Kafka and caching.",
      focus: ["Kafka"],
    };
    expect(validateAiSummary(ok, facts)?.source).toBe("ai");
    expect(
      validateAiSummary({ ...ok, overview: "A generic role about many different things and teams." }, facts),
    ).toBeNull();
    expect(validateAiSummary({ ...ok, focus: ["Talk about [YOUR PROJECT]"] }, facts)).toBeNull();
    expect(validateAiSummary({ overview: "short" }, facts)).toBeNull();
  });
  it("generatePrepSummary: mock → template, ai → ai, invalid → template, limited → limited", async () => {
    expect((await generatePrepSummary("u1", facts, "en")).source).toBe("template");
    store.llm = {
      name: "gemini",
      complete: vi.fn(async () =>
        JSON.stringify({
          overview: "ShieldGrid wants a backend engineer for Kafka streaming work.",
          focus: ["Kafka", "Go"],
        }),
      ),
    };
    expect((await generatePrepSummary("u1", facts, "en")).source).toBe("ai");
    store.llm.complete = vi.fn(async () => "{}");
    expect((await generatePrepSummary("u1", facts, "en")).source).toBe("template");
    store.llm.complete = vi.fn(async () => {
      throw new AiLimitError("user_daily");
    });
    expect((await generatePrepSummary("u1", facts, "en")).source).toBe("limited");
  });
});

describe("debrief stats", () => {
  it("aggregates rating, outcomes, by stage and improve notes", () => {
    const st = debriefStats([
      { stageKind: "coding", rating: 4, outcome: "passed", improve: "explain complexity" },
      { stageKind: "coding", rating: 2, outcome: "failed", improve: "" },
      { stageKind: "hr", rating: 5, outcome: "pending", improve: "salary answer" },
    ]);
    expect(st).toMatchObject({ total: 3, avgRating: 3.7, passed: 1, failed: 1, pending: 1 });
    expect(st.byStage[0]).toEqual({ kind: "coding", count: 2, avgRating: 3, passed: 1, decided: 2 });
    expect(st.improveNotes).toEqual(["explain complexity", "salary answer"]);
    expect(debriefStats([]).avgRating).toBeNull();
  });
});

describe("server actions", () => {
  const stage = { id: "s1", kind: "coding", title: "ראיון קוד", date: null, done: false, note: "" };
  it("savePrep keeps only the user's own story ids and rejects others' applications", async () => {
    const r = await savePrep({
      applicationId: "a1",
      stages: [stage],
      storyIds: ["s1", "s9"],
      topics: ["ds:heap"],
      questions: [],
    });
    expect(r).toEqual({ ok: true });
    const up = store.preps[0] as { create: { storyIds: string[]; userId: string } };
    expect(up.create.storyIds).toEqual(["s1"]);
    expect(up.create.userId).toBe("u1");
    store.apps[0].userId = "other";
    expect(await savePrep({ applicationId: "a1", stages: [], storyIds: [], topics: [], questions: [] })).toEqual({
      error: "not_found",
    });
  });
  it("savePrep rejects bad topic keys", async () => {
    expect(
      await savePrep({ applicationId: "a1", stages: [], storyIds: [], topics: ["javascript:alert(1)"], questions: [] }),
    ).toEqual({ error: "invalid" });
  });
  it("saveDebrief validates rating and saves for the owner", async () => {
    const base = {
      applicationId: "a1",
      stageKind: "coding",
      happenedAt: new Date("2026-11-03"),
      asked: "two sum",
      wentWell: "",
      improve: "",
      outcome: "pending" as const,
    };
    expect(await saveDebrief({ ...base, rating: 9 })).toEqual({ error: "invalid" });
    expect(await saveDebrief({ ...base, rating: 4 })).toEqual({ ok: true, id: "d1" });
    expect(store.debriefs[0]).toMatchObject({ userId: "u1", rating: 4, stageKind: "coding" });
    expect(await deleteDebrief("nope")).toEqual({ error: "not_found" });
  });
});
