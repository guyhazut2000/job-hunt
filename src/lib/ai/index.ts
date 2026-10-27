import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { LLMProvider } from "./types";

let cached: LLMProvider | undefined;

/** Select provider from env. LLM_PROVIDER=mock|openai (default: mock when no key). */
export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  const kind = process.env.LLM_PROVIDER ?? (process.env.LLM_API_KEY ? "openai" : "mock");
  if (kind === "openai" && process.env.LLM_API_KEY) {
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

export type { LLMProvider, LLMMessage, CvSuggestion } from "./types";
