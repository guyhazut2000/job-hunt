/** The chat uses the model only with a Gemini key and LLM_PROVIDER unset or "gemini"; otherwise offline router. */
export function chatIsLive(): boolean {
  const p = process.env.LLM_PROVIDER;
  return !!process.env.GEMINI_API_KEY?.trim() && (!p || p === "gemini");
}
