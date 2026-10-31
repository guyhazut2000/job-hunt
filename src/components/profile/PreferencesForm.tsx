"use client";

import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { Lock } from "lucide-react";
import { useActionState, useId } from "react";
import { savePreferences, type ActionState } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { AVAILABILITIES, COMPANY_TYPES, type Preferences, REGIONS } from "@/lib/profile/schema";
import { ROLE_CATEGORIES, SENIORITIES, WORK_MODES } from "@/lib/taxonomy";

function ChipGroup({
  legend,
  name,
  options,
  selected,
  type = "checkbox",
}: {
  legend: string;
  name: string;
  options: readonly (readonly [string, string])[];
  selected: readonly (string | null)[];
  type?: "checkbox" | "radio";
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="label mb-2.5">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label key={value} className="toggle-chip">
            <input
              type={type}
              name={name}
              value={value}
              defaultChecked={selected.includes(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PreferencesForm({
  t,
  roles,
  seniority,
  workMode,
  initial,
  onboarding,
}: {
  t: Dictionary["pv2"];
  roles: Dictionary["roles"];
  seniority: Dictionary["seniority"];
  workMode: Dictionary["workMode"];
  initial: Preferences;
  onboarding?: { finish: string; back?: React.ReactNode };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePreferences, undefined);
  const id = useId();
  return (
    <form action={action} className="flex flex-col gap-8">
      {onboarding && <input type="hidden" name="onboarding" value="1" />}
      <p className="bg-paper-deep text-foreground/80 rounded-md p-3 text-sm leading-relaxed">{t.prefsHint}</p>

      <section className="form-section">
        <ChipGroup
          legend={t.targetRoles}
          name="targetRoles"
          options={ROLE_CATEGORIES.filter((r) => r !== "other").map((r) => [r, roles[r]] as const)}
          selected={initial.targetRoles}
        />
        <ChipGroup
          legend={t.targetSeniorities}
          name="targetSeniorities"
          options={SENIORITIES.map((s) => [s, seniority[s]] as const)}
          selected={initial.targetSeniorities}
        />
      </section>

      <section className="form-section">
        <ChipGroup
          legend={t.regions}
          name="regions"
          options={REGIONS.map((r) => [r, t.regionNames[r]] as const)}
          selected={initial.regions}
        />
        <ChipGroup
          legend={t.workModes}
          name="workModes"
          options={WORK_MODES.map((w) => [w, workMode[w]] as const)}
          selected={initial.workModes}
        />
        <ChipGroup
          legend={t.companyTypes}
          name="companyTypes"
          options={COMPANY_TYPES.map((c) => [c, t.companyTypeNames[c]] as const)}
          selected={initial.companyTypes}
        />
      </section>

      <section className="form-section">
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">{t.salary}</legend>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-smin`} className="text-muted-foreground mb-1 block text-xs font-semibold">
                {t.salaryMin}
              </label>
              <input
                id={`${id}-smin`}
                name="salaryMin"
                className="input font-mono"
                dir="ltr"
                inputMode="numeric"
                placeholder="25000"
                defaultValue={initial.salaryMin ?? ""}
              />
            </div>
            <div>
              <label htmlFor={`${id}-smax`} className="text-muted-foreground mb-1 block text-xs font-semibold">
                {t.salaryMax}
              </label>
              <input
                id={`${id}-smax`}
                name="salaryMax"
                className="input font-mono"
                dir="ltr"
                inputMode="numeric"
                placeholder="35000"
                defaultValue={initial.salaryMax ?? ""}
              />
            </div>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Lock className="size-3.5" aria-hidden />
            {t.salaryPrivate}
          </p>
        </fieldset>
      </section>

      <section className="form-section grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-end justify-between gap-2">
            <label htmlFor={`${id}-want`} className="label">
              {t.wantedTech}
            </label>
            <VoiceInputButton targetId={`${id}-want`} size="sm" testId="want-voice" />
          </div>
          <input
            id={`${id}-want`}
            name="wantedTech"
            className="input font-mono"
            dir="ltr"
            placeholder={t.techPh}
            defaultValue={initial.wantedTech.join(", ")}
          />
        </div>
        <div>
          <div className="flex items-end justify-between gap-2">
            <label htmlFor={`${id}-avoid`} className="label">
              {t.avoidTech}
            </label>
            <VoiceInputButton targetId={`${id}-avoid`} size="sm" testId="avoid-voice" />
          </div>
          <input
            id={`${id}-avoid`}
            name="avoidTech"
            className="input font-mono"
            dir="ltr"
            placeholder={t.techPh}
            defaultValue={initial.avoidTech.join(", ")}
          />
        </div>
      </section>

      <section className="form-section">
        <ChipGroup
          legend={t.availability}
          name="availability"
          type="radio"
          options={AVAILABILITIES.map((a) => [a, t.availabilityNames[a]] as const)}
          selected={[initial.availability]}
        />
      </section>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-wrap items-center gap-3 border-t px-4 py-3 backdrop-blur md:bottom-0">
        {onboarding?.back}
        <Button type="submit" size="lg" disabled={pending} className="flex-1 sm:flex-none">
          {pending ? t.saving : (onboarding?.finish ?? t.savePrefs)}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {state?.error && <span className="text-destructive">{state.error}</span>}
          {state?.ok && <span className="text-fit font-semibold">{state.ok}</span>}
        </p>
      </div>
    </form>
  );
}
