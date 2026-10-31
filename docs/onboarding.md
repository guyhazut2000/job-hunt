# Onboarding wizard (`/onboarding`)

A four-step wizard for users whose profile is empty or incomplete. Refs #79.

| Step | What                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | **Start**: upload a CV (PDF / DOCX / TXT) to prefill, or fill it in by hand                               |
| 2    | **Confirm details**: every extracted field is shown for review and edit; nothing is saved until "confirm" |
| 3    | **Preferences**: roles, locations, wanted/avoided tech (voice mic on the text fields)                     |
| 4    | **CV template**: the template recommended for the target role comes first, with a live preview            |

## Rules

- **The profile is the single source of truth.** The wizard writes only through the same server actions as
  `/profile` (`saveProfessional`, `savePreferences`), plus `finishOnboarding` for the template pick
  (`Profile.cvTemplate`). Everything stays editable in `/profile`.
- **Never save extracted data without review.** The parsed CV is a proposal held in the form; the user
  confirms it in step 2. Nothing is invented: empty fields stay empty.
- **Skippable and resumable.** "Skip for now" is on every step. `Profile.onboardingStep` (additive
  migration `20261031200000_onboarding_step`) stores the furthest step reached, so `/onboarding` without
  `?step=` resumes there (with a "continuing where you left off" banner).
- **Redirected once.** `/jobs` redirects to `/onboarding` only when the profile is incomplete, the wizard
  was never finished (`onboardedAt` null) and never opened (`onboardingStep` null). After that, the
  profile banner links back to the wizard; it is never forced again.

## Code

- `src/lib/profile/onboarding.ts`: `missingParts`, `shouldOnboard`, `shouldAutoStartOnboarding`,
  `currentStep`, `advanceStored`
- `src/app/onboarding/page.tsx`, `src/app/onboarding/actions.ts` (`finishOnboarding`)
- `src/components/onboarding/TemplatePicker.tsx`
- Tests: `tests/onboarding-wizard.test.ts`
