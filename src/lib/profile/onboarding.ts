/**
 * Onboarding wizard rules (docs/onboarding.md). Pure, so they are unit-tested without a DB.
 *
 * Steps: 1 start (upload a CV or fill in manually) → 2 review & confirm details → 3 preferences →
 * 4 pick a CV template. Nothing extracted from a CV is saved before the user confirms step 2.
 */

export const ONBOARDING_STEPS = 4;
export type OnboardingStep = 1 | 2 | 3 | 4;

interface ProfileLike {
  headline?: string | null;
  summary?: string | null;
  skills?: string[];
  skillItems?: unknown;
  experience?: unknown;
  education?: unknown;
  targetRoles?: string[];
  desiredRole?: string | null;
  onboardedAt?: Date | null;
  onboardingStep?: number | null;
}

const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Which parts of the profile are still missing (used for the "incomplete" check and the start screen). */
export function missingParts(p: ProfileLike | null | undefined): ("about" | "skills" | "background" | "goals")[] {
  if (!p) return ["about", "skills", "background", "goals"];
  const out: ("about" | "skills" | "background" | "goals")[] = [];
  if (!p.headline?.trim() && !p.summary?.trim()) out.push("about");
  if (!(p.skills?.length ?? 0) && !len(p.skillItems)) out.push("skills");
  if (!len(p.experience) && !len(p.education)) out.push("background");
  if (!(p.targetRoles?.length ?? 0) && !p.desiredRole) out.push("goals");
  return out;
}

export const profileIncomplete = (p: ProfileLike | null | undefined) => missingParts(p).length > 0;

/** Send the user to /onboarding after sign-in: never finished or skipped it, and the profile is incomplete. */
export const shouldOnboard = (p: ProfileLike | null | undefined) => !p?.onboardedAt && profileIncomplete(p);

/** Auto-redirect only before the wizard was ever opened; later visits are opt-in via the profile banner. */
export const shouldAutoStartOnboarding = (p: ProfileLike | null | undefined) => shouldOnboard(p) && !p?.onboardingStep;

const clamp = (n: number) => Math.min(ONBOARDING_STEPS, Math.max(1, Math.trunc(n))) as OnboardingStep;

/** The step to show: an explicit ?step= wins, otherwise resume where the user left off. */
export function currentStep(requested: string | undefined, stored: number | null | undefined): OnboardingStep {
  const n = Number(requested);
  if (requested && Number.isFinite(n) && n >= 1) return clamp(n);
  return stored ? clamp(stored) : 1;
}

/** The stored "furthest step" only moves forward, so going back to fix something does not lose progress. */
export const advanceStored = (stored: number | null | undefined, step: OnboardingStep): number | null =>
  !stored || step > stored ? step : null;
