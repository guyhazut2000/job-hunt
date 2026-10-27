import type { z } from "zod";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** Ask for a JSON response (provider JSON mode). */
  json?: boolean;
  /** Zod schema for structured output. Providers that support it constrain generation to it. Implies `json`. */
  schema?: z.ZodType;
  maxTokens?: number;
}

/**
 * Minimal provider interface. Any LLM (Gemini, OpenAI, Anthropic, local) can be plugged in
 * by implementing `complete`. Keep prompts/business logic out of providers.
 * With `json`/`schema` the returned string is a JSON document; callers still validate it.
 */
export interface LLMProvider {
  readonly name: string;
  complete(messages: LLMMessage[], opts?: CompleteOptions): Promise<string>;
}

export interface CvSuggestion {
  kind: "missing_skill" | "keyword" | "impact" | "format" | "summary";
  text: string;
}
