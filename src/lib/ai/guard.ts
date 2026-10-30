import { createHash } from "node:crypto";
import type { AiConfig } from "./config";
import { AiLimitError, isRateLimitError, type AiLimitReason } from "./errors";
import type { CompleteOptions, LLMMessage, LLMProvider } from "./types";

export type AiFeature =
  | "cv_tips"
  | "cv_extract"
  | "outreach"
  | "study_plan"
  | "learn_content"
  | "learn_regen"
  | "learn_feedback"
  | "algo_feedback"
  | "algo_walkthrough"
  | "tutor_chat"
  | "hiring_process"
  | "digest"
  | "concept_overview"
  | "concept_chat"
  | "cv_tailor"
  | "interview_plan"
  | "interview_feedback"
  | "chat";
export type AiOutcome = "ok" | "cached" | "error" | "rate_limited" | "limited";

/** Persistence used by the guard; the Prisma implementation lives in ./store.ts, tests use an in-memory one. */
export interface AiStore {
  getCache(feature: AiFeature, key: string, now: Date): Promise<string | null>;
  putCache(feature: AiFeature, key: string, model: string, value: string, expiresAt: Date): Promise<void>;
  /** Uncached provider calls (ok/error/rate_limited) since `since`, optionally for one user. */
  countCalls(since: Date, userId?: string): Promise<number>;
  record(entry: { userId: string | null; feature: AiFeature; model: string; outcome: AiOutcome }): Promise<void>;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function cacheKey(model: string, messages: LLMMessage[], opts: CompleteOptions = {}): string {
  const shape = opts.schema ? "schema" : opts.json ? "json" : "text";
  return createHash("sha256")
    .update(JSON.stringify([model, shape, opts.maxTokens ?? null, messages]))
    .digest("hex")
    .slice(0, 40);
}

export async function checkAiLimits(
  store: AiStore,
  cfg: Pick<AiConfig, "userDailyLimit" | "globalDailyCap" | "globalPerMinute">,
  userId: string | null,
  now = new Date(),
): Promise<AiLimitReason | null> {
  const [minute, day, mine] = await Promise.all([
    store.countCalls(new Date(now.getTime() - MINUTE)),
    store.countCalls(new Date(now.getTime() - DAY)),
    userId ? store.countCalls(new Date(now.getTime() - DAY), userId) : Promise.resolve(0),
  ]);
  if (minute >= cfg.globalPerMinute) return "global_minute";
  if (day >= cfg.globalDailyCap) return "global_daily";
  if (userId && mine >= cfg.userDailyLimit) return "user_daily";
  return null;
}

/**
 * Wraps a provider with a DB cache (identical prompt → no API call), per-user and global
 * limits, and 429 detection. Limits throw `AiLimitError`; feature code already falls back
 * to the heuristic path on any error, and reads `limited` to show a friendly notice.
 */
export class GuardedProvider implements LLMProvider {
  readonly name: string;
  limited: AiLimitReason | null = null;
  cached = false;

  constructor(
    private readonly inner: LLMProvider,
    private readonly store: AiStore,
    private readonly cfg: AiConfig,
    private readonly ctx: { userId: string | null; feature: AiFeature },
    private readonly now: () => Date = () => new Date(),
  ) {
    this.name = inner.name;
  }

  async complete(messages: LLMMessage[], opts?: CompleteOptions): Promise<string> {
    const { userId, feature } = this.ctx;
    const model = this.inner.name;
    const key = cacheKey(model, messages, opts);
    const hit = await this.store.getCache(feature, key, this.now()).catch(() => null);
    if (hit !== null) {
      this.cached = true;
      await this.store.record({ userId, feature, model, outcome: "cached" }).catch(() => {});
      return hit;
    }
    const reason = await checkAiLimits(this.store, this.cfg, userId, this.now());
    if (reason) {
      this.limited = reason;
      await this.store.record({ userId, feature, model, outcome: "limited" }).catch(() => {});
      throw new AiLimitError(reason);
    }
    let out: string;
    try {
      out = await this.inner.complete(messages, opts);
    } catch (e) {
      const rl = isRateLimitError(e);
      if (rl) this.limited = "provider_quota";
      await this.store.record({ userId, feature, model, outcome: rl ? "rate_limited" : "error" }).catch(() => {});
      if (rl) throw new AiLimitError("provider_quota");
      console.warn(`[ai] ${feature} failed:`, e instanceof Error ? e.message.slice(0, 300) : "unknown error");
      throw e;
    }
    await this.store.record({ userId, feature, model, outcome: "ok" }).catch(() => {});
    const expires = new Date(this.now().getTime() + this.cfg.cacheTtlHours * 3_600_000);
    // Only cache output that parses when JSON was requested; feature code validates the shape.
    const cacheable = !(opts?.json || opts?.schema) || isJson(out);
    if (cacheable) await this.store.putCache(feature, key, model, out, expires).catch(() => {});
    return out;
  }
}

function isJson(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}
