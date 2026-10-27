export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Minimal provider interface. Any LLM (OpenAI, Anthropic, Azure, local) can be plugged in
 * by implementing `complete`. Keep prompts/business logic out of providers.
 */
export interface LLMProvider {
  readonly name: string;
  complete(messages: LLMMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<string>;
}

export interface CvSuggestion {
  kind: "missing_skill" | "keyword" | "impact" | "format" | "summary";
  text: string;
}
