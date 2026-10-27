import type { LLMMessage, LLMProvider } from "../types";

/**
 * Deterministic offline provider used in dev/tests/CI when no API key is configured.
 * Business logic (see ../cv-suggestions.ts) detects it and uses heuristics instead.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  async complete(messages: LLMMessage[]): Promise<string> {
    const last = messages.at(-1)?.content ?? "";
    return JSON.stringify({ echo: last.slice(0, 200), suggestions: [] });
  }
}
