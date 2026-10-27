import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type LanguageModel } from "ai";
import type { CompleteOptions, LLMMessage, LLMProvider } from "../types";

/**
 * Google Gemini through the Vercel AI SDK. Structured output (zod) when a schema is given,
 * JSON mode when only `json` is set. `model` can be injected (tests use MockLanguageModelV3).
 */
export class GeminiProvider implements LLMProvider {
  readonly name: string;
  private readonly model: LanguageModel;

  constructor(opts: { apiKey?: string; model: string; languageModel?: LanguageModel }) {
    this.name = `gemini:${opts.model}`;
    this.model = opts.languageModel ?? createGoogleGenerativeAI({ apiKey: opts.apiKey })(opts.model);
  }

  async complete(messages: LLMMessage[], opts: CompleteOptions = {}): Promise<string> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const rest = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const common = {
      model: this.model,
      system: system || undefined,
      messages: rest,
      maxOutputTokens: opts.maxTokens ?? 1200,
      temperature: 0.2,
      // One retry only: on the free tier a 429 should fall back quickly instead of stalling the request.
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(45_000),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    } as const;
    if (opts.schema) {
      const { output } = await generateText({ ...common, output: Output.object({ schema: opts.schema }) });
      return JSON.stringify(output);
    }
    if (opts.json) {
      const { output } = await generateText({ ...common, output: Output.json() });
      return JSON.stringify(output);
    }
    const { text } = await generateText(common);
    return text;
  }
}
