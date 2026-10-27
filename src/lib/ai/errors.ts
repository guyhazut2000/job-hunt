export type AiLimitReason = "user_daily" | "global_daily" | "global_minute" | "provider_quota";

/** Thrown when an AI call is skipped because of our own limits or the provider's 429. */
export class AiLimitError extends Error {
  constructor(readonly reason: AiLimitReason) {
    super(`AI limit: ${reason}`);
    this.name = "AiLimitError";
  }
}

function statusOf(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as { statusCode?: unknown; status?: unknown };
  if (typeof o.statusCode === "number") return o.statusCode;
  if (typeof o.status === "number") return o.status;
  return undefined;
}

/** True for a provider rate-limit / quota error (HTTP 429, RESOURCE_EXHAUSTED), including AI SDK RetryError wrappers. */
export function isRateLimitError(e: unknown, depth = 0): boolean {
  if (!e || typeof e !== "object" || depth > 5) return false;
  if (statusOf(e) === 429) return true;
  const o = e as { message?: unknown; lastError?: unknown; cause?: unknown; errors?: unknown };
  if (typeof o.message === "string" && /RESOURCE_EXHAUSTED|quota exceeded|rate limit/i.test(o.message)) return true;
  if (isRateLimitError(o.lastError, depth + 1) || isRateLimitError(o.cause, depth + 1)) return true;
  if (Array.isArray(o.errors)) return o.errors.some((x) => isRateLimitError(x, depth + 1));
  return false;
}
