import { describe, expect, it, vi } from "vitest";
import { AiLimitError } from "@/lib/ai/errors";
import type { LLMMessage, LLMProvider } from "@/lib/ai/types";
import { GRAPH } from "@/lib/learning/graph";
import {
  buildStudySkills,
  generateStudyPlan,
  MAX_STUDY_SKILLS,
  rulesStudyPlan,
  studyHoursPerWeek,
  studyPlanMessages,
  validateAiStudyPlan,
  type PersonalStudyPlan,
  type StudyPlanInput,
} from "@/lib/learning/study-plan";

function inputFor(nodeId: string, locale: "he" | "en" = "he", done: string[] = []): StudyPlanInput {
  const skills = buildStudySkills([{ nodeId, score: 5 }], new Set(done), locale);
  return { skills, hoursPerWeek: 8, locale };
}

function asAi(plan: PersonalStudyPlan) {
  const questions = [...plan.questions];
  let n = 2;
  while (questions.length < 4 && plan.questions[0]) {
    const base = plan.questions[questions.length % plan.questions.length]!;
    questions.push({ ...base, question: `${base.question} (${n})` });
    n += 1;
  }
  return {
    weeks: plan.weeks.map((w) => ({ week: w.week, skillIds: w.skillIds, goals: w.goals, hours: w.hours })),
    questions: questions.slice(0, 8).map((q) => ({ skillId: q.skillId, question: q.question, hints: q.hints })),
    cvBullet: plan.cvBullet,
  };
}

describe("buildStudySkills", () => {
  it("pulls unfinished prerequisites in learning order and skips done or unknown gaps", () => {
    const skills = buildStudySkills([{ nodeId: "docker", score: 4 }], new Set());
    const ids = skills.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["linux", "networking", "docker"]));
    expect(ids.indexOf("linux")).toBeLessThan(ids.indexOf("docker"));
    expect(ids.indexOf("networking")).toBeLessThan(ids.indexOf("docker"));
    expect(skills.find((s) => s.id === "docker")?.focus).toBe(true);
    expect(skills.find((s) => s.id === "linux")?.focus).toBe(false);
    expect(skills.find((s) => s.id === "linux")?.urls).toContain("https://roadmap.sh/linux");
    expect(skills.find((s) => s.id === "docker")?.topics[0]).toBe("Images vs containers");

    const done = buildStudySkills([{ nodeId: "docker", score: 4 }], new Set(["linux"]));
    expect(done.map((s) => s.id)).not.toContain("linux");
    expect(done.map((s) => s.id)).toContain("docker");
    expect(
      buildStudySkills(
        [
          { nodeId: null, score: 9 },
          { nodeId: "not-a-skill", score: 3 },
        ],
        new Set(),
      ),
    ).toEqual([]);
  });

  it("caps the plan and keeps every included prerequisite", () => {
    const gaps = [{ nodeId: "linux", score: 100 }, ...GRAPH.nodes.map((n, i) => ({ nodeId: n.id, score: 50 - i }))];
    const skills = buildStudySkills(gaps, new Set());
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.length).toBeLessThanOrEqual(MAX_STUDY_SKILLS);
    const ids = skills.map((s) => s.id);
    for (const skill of skills) {
      for (const pre of GRAPH.byId.get(skill.id)!.prerequisites) {
        expect(ids.indexOf(pre)).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(pre)).toBeLessThan(ids.indexOf(skill.id));
      }
    }
  });
});

describe("rulesStudyPlan", () => {
  it("paces roadmap topics into weeks, questions and a labelled CV line", () => {
    expect(studyHoursPerWeek(undefined)).toBe(5);
    expect(studyHoursPerWeek(0)).toBe(1);
    expect(studyHoursPerWeek(80)).toBe(60);
    const he = inputFor("docker", "he");
    const plan = rulesStudyPlan(he);
    expect(plan.source).toBe("rules");
    expect(plan.limitReason).toBeNull();
    expect(plan.weeks.flatMap((w) => w.skillIds)).toEqual(he.skills.map((s) => s.id));
    expect(plan.totalHours).toBe(he.skills.reduce((sum, s) => sum + s.hours, 0));
    expect(plan.questions.length).toBeGreaterThanOrEqual(4);
    expect(plan.questions.every((q) => he.skills.some((s) => s.id === q.skillId))).toBe(true);
    expect(plan.cvBullet).toContain("Docker");
    expect(plan.cvBullet.length).toBeLessThanOrEqual(180);
    expect(plan.cvBullet).toMatch(/בניתי/);
    for (const week of plan.weeks) {
      for (const goal of week.goals) {
        const skill = he.skills.find((s) => week.skillIds.includes(s.id));
        expect(skill?.topics.includes(goal) || skill?.label === goal).toBe(true);
      }
    }
    const en = rulesStudyPlan(inputFor("docker", "en"));
    expect(en.cvBullet).toMatch(/^Built a practice project in Docker/);
    expect(en.questions[0]?.question).toMatch(/^Explain /);
  });
});

describe("generateStudyPlan", () => {
  it("asks for Hebrew structured output and accepts a plan that stays on the roadmap", async () => {
    const input = inputFor("docker");
    const good = asAi(rulesStudyPlan(input));
    let seen: LLMMessage[] | undefined;
    const llm: LLMProvider = {
      name: "gemini:test",
      complete: vi.fn(async (messages) => {
        seen = messages;
        return JSON.stringify(good);
      }),
    };
    const plan = await generateStudyPlan(input, llm);
    expect(plan.source).toBe("ai");
    expect(plan.weeks.flatMap((w) => w.skillIds)).toEqual(input.skills.map((s) => s.id));
    expect(plan.cvBullet).toContain("Docker");
    expect(seen?.[0]?.content).toMatch(/Hebrew/);
    expect(seen?.[1]?.content).toContain("docker");
    expect(seen?.[1]?.content).not.toMatch(/password|resume/i);
    expect(llm.complete).toHaveBeenCalledWith(studyPlanMessages({ ...input, hoursPerWeek: 8 }), {
      schema: expect.anything(),
      maxTokens: 1600,
    });
  });

  it("falls back to the rules plan for mock, limits, invented URLs, metrics and bad order", async () => {
    const input = inputFor("docker");
    const rules = rulesStudyPlan(input);
    const mock: LLMProvider = { name: "mock", complete: vi.fn(async () => "{}") };
    expect(await generateStudyPlan(input, mock)).toEqual(rules);
    expect(mock.complete).not.toHaveBeenCalled();

    const limited: LLMProvider = {
      name: "gemini:test",
      complete: async () => {
        throw new AiLimitError("user_daily");
      },
    };
    const hit = await generateStudyPlan(input, limited);
    expect(hit.source).toBe("limited");
    expect(hit.limitReason).toBe("user_daily");
    expect(hit.weeks).toEqual(rules.weeks);
    expect(hit.cvBullet).toBe(rules.cvBullet);

    const good = asAi(rules);
    const evil = structuredClone(good);
    evil.weeks[0]!.goals = ["Read https://evil.example/course"];
    const metric = structuredClone(good);
    metric.cvBullet = "Built a practice project in Docker that cut latency by 999%.";
    const reversed = structuredClone(good);
    const flat = [...reversed.weeks.flatMap((w) => w.skillIds)].reverse();
    let cursor = 0;
    for (const week of reversed.weeks) {
      week.skillIds = flat.slice(cursor, cursor + week.skillIds.length);
      cursor += week.skillIds.length;
    }
    expect(rules.weeks.findIndex((w) => w.skillIds.includes("linux"))).toBeLessThan(
      rules.weeks.findIndex((w) => w.skillIds.includes("docker")),
    );
    expect(validateAiStudyPlan(evil, input)).toBeNull();
    expect(validateAiStudyPlan(metric, input)).toBeNull();
    expect(validateAiStudyPlan(reversed, input)).toBeNull();
    expect(validateAiStudyPlan({ ...good, weeks: good.weeks.slice(1) }, input)).toBeNull();

    const bad: LLMProvider = { name: "gemini:test", complete: async () => JSON.stringify(evil) };
    const fell = await generateStudyPlan(input, bad);
    expect(fell.source).toBe("rules");
    expect(fell.cvBullet).not.toContain("evil.example");
    expect(fell.weeks).toEqual(rules.weeks);
  });
});
