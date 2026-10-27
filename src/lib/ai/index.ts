import { aiConfig } from "./config";
import { GuardedProvider, type AiFeature } from "./guard";
import { MockProvider } from "./providers/mock";
import { GeminiProvider } from "./providers/gemini";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { LLMProvider } from "./types";

let cached: LLMProvider | undefined;

/**
 * Select provider from env:
 * - GEMINI_API_KEY → Google Gemini via the AI SDK (GEMINI_MODEL, default gemini-3.5-flash-lite)
 * - LLM_API_KEY (+ LLM_PROVIDER=openai) → any OpenAI-compatible endpoint
 * - otherwise (dev/CI) → offline mock; features use their heuristic path
 */
export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  const cfg = aiConfig();
  const kind = process.env.LLM_PROVIDER || (cfg.apiKey ? "gemini" : process.env.LLM_API_KEY ? "openai" : "mock");
  if (kind === "gemini" && cfg.apiKey) {
    cached = new GeminiProvider({ apiKey: cfg.apiKey, model: cfg.model });
  } else if (kind === "openai" && process.env.LLM_API_KEY) {
    cached = new OpenAICompatibleProvider(
      process.env.LLM_API_KEY,
      process.env.LLM_MODEL ?? "gpt-4o-mini",
      process.env.LLM_BASE_URL,
    );
  } else {
    cached = new MockProvider();
  }
  return cached;
}

export function aiEnabled(): boolean {
  return getLLMProvider().name !== "mock";
}

/**
 * Provider for one user-triggered feature call, wrapped with the DB cache and free-tier limits.
 * The mock provider is returned unwrapped (features short-circuit to heuristics on it).
 */
export async function guardedLLM(
  feature: AiFeature,
  userId: string | null,
): Promise<LLMProvider & { limited?: GuardedProvider["limited"]; cached?: boolean }> {
  const inner = getLLMProvider();
  if (inner.name === "mock") return inner;
  const { prismaAiStore } = await import("./store");
  return new GuardedProvider(inner, prismaAiStore, aiConfig(), { userId, feature });
}

export type { LLMProvider, LLMMessage, CvSuggestion } from "./types";
export { AiLimitError, type AiLimitReason } from "./errors";
