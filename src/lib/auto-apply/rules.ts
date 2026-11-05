/**
 * Submission rules for auto-apply (#30). Preparation is always allowed when the user asks.
 * Approval (the "אשר ושלח" click, and the opt-in fully-automatic path) has to pass these.
 * A per-application override can pass a low or missing match score. It cannot pass a blocked
 * company or the daily cap.
 */

export const APPLY_DEFAULTS = { minMatchScore: 70, dailyCap: 5, fullyAutomatic: false } as const;

export type RuleCode = "below_score" | "no_score" | "blocked_company" | "daily_cap";

export interface RuleInput {
  score: number | null;
  companyId: string;
  blockedCompanyIds: readonly string[];
  submittedToday: number;
  minMatchScore: number;
  dailyCap: number;
  override: boolean;
}

export function evaluateRules(input: RuleInput): { ok: boolean; blocks: RuleCode[] } {
  const blocks: RuleCode[] = [];
  if (input.blockedCompanyIds.includes(input.companyId)) blocks.push("blocked_company");
  if (input.submittedToday >= input.dailyCap) blocks.push("daily_cap");
  if (!input.override) {
    if (input.score == null) blocks.push("no_score");
    else if (input.score < input.minMatchScore) blocks.push("below_score");
  }
  return { ok: blocks.length === 0, blocks };
}

/** Fully automatic never uses the per-application override. */
export function automaticAllowed(input: Omit<RuleInput, "override">): boolean {
  return evaluateRules({ ...input, override: false }).ok;
}

export function parseSettingsInput(raw: { minMatchScore: unknown; dailyCap: unknown; fullyAutomatic: unknown }): {
  minMatchScore: number;
  dailyCap: number;
  fullyAutomatic: boolean;
} {
  const min = Number(raw.minMatchScore);
  const cap = Number(raw.dailyCap);
  return {
    minMatchScore: Number.isInteger(min) && min >= 0 && min <= 100 ? min : APPLY_DEFAULTS.minMatchScore,
    dailyCap: Number.isInteger(cap) && cap >= 0 && cap <= 25 ? cap : APPLY_DEFAULTS.dailyCap,
    fullyAutomatic: raw.fullyAutomatic === true || raw.fullyAutomatic === "on",
  };
}

export function toggleBlocked(ids: readonly string[], companyId: string, blocked: boolean): string[] {
  const next = new Set(ids.filter((id) => id && id !== companyId));
  if (blocked) next.add(companyId);
  return [...next].slice(0, 100);
}
