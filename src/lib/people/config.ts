/** Env-driven settings for people search. Server-only; never expose the key to the client. */
const int = (v: string | undefined, d: number, min = 0) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : d;
};

export interface PeopleSearchConfig {
  apiKey: string | null;
  /** Fixture provider for local demos/screenshots. Refused on Vercel production. */
  mock: boolean;
  enabled: boolean;
  cacheTtlHours: number;
  perMinute: number;
  dailyCap: number;
  monthlyCap: number;
  minIntervalMs: number;
}

export function peopleSearchConfig(env: Record<string, string | undefined> = process.env): PeopleSearchConfig {
  const apiKey = env.BRAVE_SEARCH_API_KEY?.trim() || null;
  const mock = env.PEOPLE_SEARCH_MOCK === "1" && env.VERCEL_ENV !== "production";
  return {
    apiKey,
    mock,
    enabled: !!apiKey || mock,
    cacheTtlHours: int(env.PEOPLE_SEARCH_CACHE_TTL_HOURS, 168, 1),
    perMinute: int(env.PEOPLE_SEARCH_PER_MINUTE, 20, 1),
    dailyCap: int(env.PEOPLE_SEARCH_DAILY_CAP, 40, 0),
    monthlyCap: int(env.BRAVE_MONTHLY_CAP, 900, 0),
    minIntervalMs: int(env.BRAVE_MIN_INTERVAL_MS, 1100, 0),
  };
}
