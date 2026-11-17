import { describe, expect, it } from "vitest";
import { AiLimitError, type LLMProvider } from "@/lib/ai";
import {
  cacheUsable,
  canonicalSkill,
  heuristicJobSkills,
  impactLevel,
  israelDay,
  jobsKey,
  suggestSkills,
  type JobSkills,
} from "@/lib/skill-suggest/core";
import { buildPrompt, extractJobSkills, mergeAi, type JobInput } from "@/lib/skill-suggest/extract";

const job = (id: string, required: string[], preferred: string[] = [], score = 80): JobSkills => ({
  id,
  title: `Job ${id}`,
  company: `Co ${id}`,
  score,
  required,
  preferred,
});

describe("canonicalSkill", () => {
  it("folds synonyms and case to one key", () => {
    const k = (s: string) => canonicalSkill(s)?.key;
    expect(k("k8s")).toBe(k("Kubernetes"));
    expect(k("JS")).toBe(k("javascript"));
    expect(k("TS")).toBe(k("TypeScript"));
    expect(k("node")).toBe(k("Node.js"));
    expect(k("NodeJS")).toBe(k("node.js"));
    expect(k("Postgres")).toBe(k("PostgreSQL"));
    expect(k("React.js")).toBe(k("react"));
    expect(k("micro-services")).toBe(k("Microservices"));
    expect(k("RESTful APIs")).toBe(k("REST"));
    expect(k("  Redis  ")).toBe(k("redis"));
  });
  it("returns a display label from the graph", () => {
    expect(canonicalSkill("k8s")?.label).toBe("Kubernetes");
    expect(canonicalSkill("rest api")?.label).toBe("REST APIs");
  });
  it("drops soft skills, empty strings and sentences", () => {
    expect(canonicalSkill("Communication skills")).toBeNull();
    expect(canonicalSkill("English")).toBeNull();
    expect(canonicalSkill("   ")).toBeNull();
    expect(canonicalSkill("x".repeat(41))).toBeNull();
  });
  it("keeps unknown skills, normalized", () => {
    expect(canonicalSkill("Temporal.io")?.key).toBe(canonicalSkill("temporal io")?.key);
  });
});

describe("suggestSkills", () => {
  const jobs = [
    job("a", ["TypeScript", "Kubernetes", "Kafka"], ["Terraform"], 90),
    job("b", ["Node.js", "k8s"], ["Kafka"], 85),
    job("c", ["JavaScript", "Docker"], ["Kubernetes"], 70),
    job("d", ["Go"], [], 60),
  ];

  it("diffs against the profile with synonyms (JS = JavaScript, k8s = Kubernetes)", () => {
    const r = suggestSkills({ skills: ["javascript", "TS", "nodejs"], jobs });
    const labels = r.suggestions.map((s) => s.label);
    expect(labels).not.toContain("JavaScript");
    expect(labels).not.toContain("TypeScript");
    expect(labels).not.toContain("Node.js");
    expect(labels.filter((l) => l === "Kubernetes")).toHaveLength(1);
  });

  it("ranks by how many jobs ask, then by required count", () => {
    const r = suggestSkills({ skills: ["JavaScript"], jobs });
    expect(r.analyzed).toBe(4);
    const [first, second] = r.suggestions;
    expect(first.label).toBe("Kubernetes");
    expect(first.jobs).toBe(3);
    expect(first.required).toBe(2);
    expect(first.preferred).toBe(1);
    expect(first.share).toBe(75);
    expect(second.label).toBe("Kafka");
    expect(second.jobs).toBe(2);
  });

  it("gives examples from the best-matching jobs first (max 2)", () => {
    const r = suggestSkills({ skills: [], jobs });
    const k8s = r.suggestions.find((s) => s.label === "Kubernetes")!;
    expect(k8s.examples.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("estimates keyword-coverage gain (required 1, preferred 0.5)", () => {
    const r = suggestSkills({ skills: [], jobs: [job("x", ["React", "Redux"], ["Jest"])] });
    const react = r.suggestions.find((s) => s.label === "React")!;
    const jest = r.suggestions.find((s) => s.label === "Jest")!;
    expect(react.coverageGain).toBe(40); // 1 / 2.5
    expect(jest.coverageGain).toBe(20); // 0.5 / 2.5
    expect(r.coverage).toBe(0);
    const after = suggestSkills({ skills: ["React"], jobs: [job("x", ["React", "Redux"], ["Jest"])] });
    expect(after.coverage).toBe(40);
  });

  it("hides dismissed skills by any spelling and counts them", () => {
    const r = suggestSkills({ skills: [], jobs, dismissed: ["kubernetes"] });
    expect(r.suggestions.some((s) => s.label === "Kubernetes")).toBe(false);
    expect(r.dismissed).toBe(1);
  });

  it("flags skills already written in experience", () => {
    const r = suggestSkills({ skills: [], cvTech: ["Docker"], jobs });
    expect(r.suggestions.find((s) => s.label === "Docker")?.inCv).toBe(true);
    expect(r.suggestions.find((s) => s.label === "Go")?.inCv).toBe(false);
  });

  it("returns nothing when the profile covers every skill", () => {
    const r = suggestSkills({ skills: ["Go"], jobs: [job("d", ["golang"])] });
    expect(r.suggestions).toEqual([]);
    expect(r.coverage).toBe(100);
  });

  it("required wins when a job lists a skill in both lists", () => {
    const r = suggestSkills({ skills: [], jobs: [job("x", ["Kafka"], ["kafka"])] });
    expect(r.suggestions[0]).toMatchObject({ label: "Kafka", required: 1, preferred: 0 });
  });
});

describe("impactLevel", () => {
  it("is high for skills most jobs require", () => {
    expect(impactLevel(60, 1, 10)).toBe("high");
    expect(impactLevel(30, 0, 20)).toBe("high");
    expect(impactLevel(25, 0.2, 5)).toBe("medium");
    expect(impactLevel(5, 0, 5)).toBe("low");
  });
});

describe("heuristicJobSkills", () => {
  it("splits required from nice-to-have blocks and advantage lines", () => {
    const r = heuristicJobSkills({
      techStack: ["Node.js"],
      description:
        "Requirements:\n3+ years with TypeScript and PostgreSQL\nNice to have:\nKubernetes, Terraform\nRequirements again\nDocker\nExperience with Kafka - an advantage",
    });
    expect(r.required).toEqual(expect.arrayContaining(["Node.js", "TypeScript", "PostgreSQL", "Docker"]));
    expect(r.preferred).toEqual(expect.arrayContaining(["Kubernetes", "Terraform", "Kafka"]));
    expect(r.preferred).not.toContain("Docker");
  });
  it("reads Hebrew advantage lines", () => {
    const r = heuristicJobSkills({ techStack: [], description: "ניסיון ב-React\nניסיון עם AWS - יתרון" });
    expect(r.required).toContain("React");
    expect(r.preferred).toContain("AWS");
  });
});

describe("cache helpers", () => {
  it("jobsKey ignores order but changes with the set", () => {
    expect(jobsKey(["a", "b"])).toBe(jobsKey(["b", "a"]));
    expect(jobsKey(["a", "b"])).not.toBe(jobsKey(["a", "c"]));
  });
  it("cache is used only on the same day and job set", () => {
    const c = { day: "2026-11-17", jobsKey: "k", source: "ai" as const, limited: null, jobs: [] };
    expect(cacheUsable(c, "2026-11-17", "k")).toBe(true);
    expect(cacheUsable(c, "2026-11-18", "k")).toBe(false);
    expect(cacheUsable(c, "2026-11-17", "other")).toBe(false);
    expect(cacheUsable(null, "2026-11-17", "k")).toBe(false);
  });
  it("israelDay uses the Israel calendar day", () => {
    expect(israelDay(new Date("2026-11-17T22:30:00Z"))).toBe("2026-11-18");
    expect(israelDay(new Date("2026-11-17T21:30:00Z"))).toBe("2026-11-17");
  });
});

describe("extractJobSkills", () => {
  const inputs: JobInput[] = [
    {
      id: "a",
      title: "Backend",
      company: "A",
      score: 90,
      techStack: ["Node.js"],
      description: "We use Kafka. Redis is a plus",
    },
    { id: "b", title: "Platform", company: "B", score: 80, techStack: [], description: "k8s and Terraform" },
  ];
  const fake = (out: string | Error): LLMProvider => ({
    name: "gemini-test",
    complete: async () => {
      if (out instanceof Error) throw out;
      return out;
    },
  });

  it("uses the rules path on the mock provider", async () => {
    const r = await extractJobSkills(inputs, { name: "mock", complete: async () => "{}" });
    expect(r.source).toBe("rules");
    expect(r.jobs[0].required).toContain("Kafka");
  });

  it("merges AI lists with the job's own stack", async () => {
    const r = await extractJobSkills(
      inputs,
      fake(
        JSON.stringify({
          jobs: [
            { ref: "j1", required: ["Kafka"], preferred: ["Redis", "node.js"] },
            { ref: "j2", required: ["Kubernetes", "Terraform"], preferred: [] },
          ],
        }),
      ),
    );
    expect(r.source).toBe("ai");
    expect(r.jobs[0].required).toEqual(["Node.js", "Kafka"]);
    expect(r.jobs[0].preferred).toEqual(["Redis"]);
    expect(r.jobs[1].required).toEqual(["Kubernetes", "Terraform"]);
  });

  it("falls back to rules and reports the limit on AiLimitError", async () => {
    const r = await extractJobSkills(inputs, fake(new AiLimitError("user_daily")));
    expect(r).toMatchObject({ source: "rules", limited: "user_daily" });
    expect(r.jobs).toHaveLength(2);
  });

  it("falls back to rules on a bad response", async () => {
    const r = await extractJobSkills(inputs, fake("not json"));
    expect(r.source).toBe("rules");
    expect(r.limited).toBeNull();
  });

  it("mergeAi returns null when no ref matches", () => {
    expect(mergeAi(inputs, { jobs: [{ ref: "zz", required: [], preferred: [] }] })).toBeNull();
  });

  it("prompt refs every job and truncates descriptions", () => {
    const p = buildPrompt([{ ...inputs[0], description: "x".repeat(5000) }, inputs[1]]);
    expect(p).toContain("ref: j1");
    expect(p).toContain("ref: j2");
    expect(p.length).toBeLessThan(2000);
  });
});
