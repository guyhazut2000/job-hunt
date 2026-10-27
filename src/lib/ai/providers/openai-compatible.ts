import type { CompleteOptions, LLMMessage, LLMProvider } from "../types";

/** Works with OpenAI and any OpenAI-compatible endpoint (Azure OpenAI proxy, OpenRouter, vLLM, Ollama...). */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async complete(messages: LLMMessage[], opts?: CompleteOptions) {
    const json = opts?.json || !!opts?.schema;
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts?.maxTokens ?? 800,
        temperature: 0.2,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return body.choices[0]?.message?.content ?? "";
  }
}
