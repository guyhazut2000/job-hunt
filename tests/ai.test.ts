import { APICallError, RetryError } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiConfig, DEFAULT_GEMINI_MODEL } from "@/lib/ai/config";
import { generateCvSuggestions } from "@/lib/ai/cv-suggestions";
import { AiLimitError, isRateLimitError } from "@/lib/ai/errors";
import { cacheKey, checkAiLimits, GuardedProvider, type AiOutcome, type AiStore } from "@/lib/ai/guard";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import type { LLMProvider } from "@/lib/ai/types";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { normalizeLlmProfile } from "@/lib/profile/extract";

const COUNTED: AiOutcome[] = ["ok", "error", "rate_limited"];

function memoryStore() {
  const cache = new Map<string, { value: string; expiresAt: Date }>();
  const usage: { userId: string | null; outcome: AiOutcome; at: Date }[] = [];
  const store: AiStore = {
    async getCache(feature, key, now) {
      const e = cache.get(`${feature}:${key}`);
      return e && e.expiresAt > now ? e.value : null;
    },
    async putCache(feature, key, _model, value, expiresAt) {
      cache.set(`${feature}:${key}`, { value, expiresAt });
    },
    async countCalls(since, userId) {
      return usage.filter((u) => u.at >= since && COUNTED.includes(u.outcome) && (!userId || u.userId === userId))
        .length;
    },
    async record(e) {
      usage.push({ userId: e.userId, outcome: e.outcome, at: new Date() });
    },
  };
  return { store, cache, usage };
}

const cfg = { ...aiConfig({}), userDailyLimit: 2, globalDailyCap: 100, globalPerMinute: 50 };
const msgs = [{ role: "user" as const, content: "hello" }];

function rateLimit() {
  return new APICallError({
    message: "Resource has been exhausted (e.g. check quota).",
    url: "https://generativelanguage.googleapis.com",
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  });
}

describe("aiConfig", () => {
  it("defaults to the free-tier flash-lite model and conservative limits", () => {
    const c = aiConfig({});
    expect(c.apiKey).toBeUndefined();
    expect(c.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(c.globalDailyCap).toBeLessThan(500);
    expect(aiConfig({ GEMINI_API_KEY: " k ", GEMINI_MODEL: "m", AI_USER_DAILY_LIMIT: "3" })).toMatchObject({
      apiKey: "k",
      model: "m",
      userDailyLimit: 3,
    });
  });
});

describe("isRateLimitError", () => {
  it("detects 429s directly and inside RetryError", () => {
    expect(isRateLimitError(rateLimit())).toBe(true);
    const wrapped = new RetryError({ message: "failed", reason: "maxRetriesExceeded", errors: [rateLimit()] });
    expect(isRateLimitError(wrapped)).toBe(true);
    expect(isRateLimitError(new Error("boom"))).toBe(false);
    expect(isRateLimitError({ message: "RESOURCE_EXHAUSTED" })).toBe(true);
  });
});

describe("GuardedProvider", () => {
  it("serves identical prompts from the cache without calling the provider again", async () => {
    const { store } = memoryStore();
    const inner = { name: "gemini:test", complete: vi.fn(async () => '{"a":1}') };
    const first = new GuardedProvider(inner, store, cfg, { userId: "u1", feature: "cv_tips" });
    expect(await first.complete(msgs, { json: true })).toBe('{"a":1}');
    const second = new GuardedProvider(inner, store, cfg, { userId: "u2", feature: "cv_tips" });
    expect(await second.complete(msgs, { json: true })).toBe('{"a":1}');
    expect(second.cached).toBe(true);
    expect(inner.complete).toHaveBeenCalledTimes(1);
  });

  it("does not cache unparseable JSON", async () => {
    const { store, cache } = memoryStore();
    const inner = { name: "gemini:test", complete: async () => "oops" };
    await new GuardedProvider(inner, store, cfg, { userId: "u1", feature: "cv_tips" }).complete(msgs, { json: true });
    expect(cache.size).toBe(0);
  });

  it("enforces the per-user daily limit (cache hits are free)", async () => {
    const { store } = memoryStore();
    let n = 0;
    const inner = { name: "gemini:test", complete: async () => `"r${n++}"` };
    const call = (content: string) =>
      new GuardedProvider(inner, store, cfg, { userId: "u1", feature: "outreach" }).complete([
        { role: "user", content },
      ]);
    await call("a");
    await call("b");
    await call("a"); // cached
    const p = new GuardedProvider(inner, store, cfg, { userId: "u1", feature: "outreach" });
    await expect(p.complete([{ role: "user", content: "c" }])).rejects.toBeInstanceOf(AiLimitError);
    expect(p.limited).toBe("user_daily");
    // another user is unaffected
    await expect(
      new GuardedProvider(inner, store, cfg, { userId: "u2", feature: "outreach" }).complete([
        { role: "user", content: "c" },
      ]),
    ).resolves.toBe('"r2"');
  });

  it("enforces global per-minute and daily caps", async () => {
    const { store } = memoryStore();
    await store.record({ userId: "x", feature: "cv_tips", model: "m", outcome: "ok" });
    expect(await checkAiLimits(store, { ...cfg, globalPerMinute: 1 }, "u")).toBe("global_minute");
    expect(await checkAiLimits(store, { ...cfg, globalDailyCap: 1 }, "u")).toBe("global_daily");
    expect(await checkAiLimits(store, cfg, "u")).toBeNull();
  });

  it("turns a provider 429 into AiLimitError and the feature falls back to heuristics", async () => {
    const { store, usage } = memoryStore();
    const inner: LLMProvider = {
      name: "gemini:test",
      complete: async () => {
        throw rateLimit();
      },
    };
    const p = new GuardedProvider(inner, store, cfg, { userId: "u1", feature: "cv_tips" });
    const res = await generateCvSuggestions(
      {
        resumeText: "React developer",
        job: { title: "Backend Engineer", description: "Go, Kubernetes", techStack: ["Go", "Kubernetes"] },
        locale: "he",
      },
      p,
    );
    expect(res.provider).toBe("heuristic-fallback");
    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(p.limited).toBe("provider_quota");
    expect(usage.at(-1)?.outcome).toBe("rate_limited");
    expect(aiLimitMessage("provider_quota", "he")).toMatch(/AI/);
  });

  it("cache keys depend on model and prompt", () => {
    expect(cacheKey("a", msgs)).not.toBe(cacheKey("b", msgs));
    expect(cacheKey("a", msgs)).not.toBe(cacheKey("a", [{ role: "user", content: "other" }]));
    expect(cacheKey("a", msgs, { json: true })).toBe(cacheKey("a", msgs, { json: true }));
  });
});

describe("GeminiProvider (mocked model, no network)", () => {
  const usage = {
    inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 10, text: 10, reasoning: undefined },
  };
  it("returns validated structured output as JSON", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: "text", text: '{"suggestions":[{"kind":"keyword","text":"הוסף AWS"}]}' }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    });
    const p = new GeminiProvider({ model: "gemini-test", languageModel: model });
    const schema = z.object({ suggestions: z.array(z.object({ kind: z.string(), text: z.string() })) });
    const out = JSON.parse(await p.complete([{ role: "system", content: "s" }, ...msgs], { schema }));
    expect(out.suggestions[0].text).toBe("הוסף AWS");
    expect(p.name).toBe("gemini:gemini-test");
    expect(model.doGenerateCalls[0]?.prompt[0]).toMatchObject({ role: "system", content: "s" });
  });
});

describe("normalizeLlmProfile", () => {
  it("blanks dates and URLs the strict schema would reject", () => {
    const out = normalizeLlmProfile({
      experience: [{ company: "Wix", title: "Dev", start: "2021-03", end: "Present" }],
      education: [],
      linkedinUrl: "linkedin.com/in/x",
      githubUrl: "https://github.com/x",
    }) as Record<string, unknown>;
    expect((out.experience as { end: string }[])[0]?.end).toBe("");
    expect((out.experience as { start: string }[])[0]?.start).toBe("2021-03");
    expect(out.linkedinUrl).toBe("");
    expect(out.githubUrl).toBe("https://github.com/x");
  });
});
