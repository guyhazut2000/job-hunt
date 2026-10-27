/** Default model: the most generous free-tier Gemini text model for this key (see docs/ai.md). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export interface AiConfig {
  apiKey: string | undefined;
  model: string;
  /** Uncached AI calls one user may trigger per rolling 24h. */
  userDailyLimit: number;
  /** Uncached AI calls for the whole app per rolling 24h (keeps us under the free-tier RPD). */
  globalDailyCap: number;
  /** Uncached AI calls for the whole app per minute (keeps us under the free-tier RPM). */
  globalPerMinute: number;
  /** How long an identical prompt is served from the DB cache. */
  cacheTtlHours: number;
}

function int(v: string | undefined, def: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    userDailyLimit: int(env.AI_USER_DAILY_LIMIT, 15),
    globalDailyCap: int(env.AI_GLOBAL_DAILY_CAP, 400),
    globalPerMinute: int(env.AI_GLOBAL_PER_MINUTE, 8),
    cacheTtlHours: int(env.AI_CACHE_TTL_HOURS, 24 * 30),
  };
}
