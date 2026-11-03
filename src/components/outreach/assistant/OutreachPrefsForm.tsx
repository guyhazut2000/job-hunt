"use client";

import { startTransition, useActionState } from "react";
import { saveOutreachPrefs, type PrefsState } from "@/app/outreach/actions";
import { Button } from "@/components/ui/button";
import type { OutreachAssistantStrings } from "@/lib/i18n/outreach-assistant";
import type { OutreachPrefsInput } from "@/lib/outreach/assistant";

export function OutreachPrefsForm({ prefs, s }: { prefs: OutreachPrefsInput; s: OutreachAssistantStrings }) {
  const [state, action, pending] = useActionState<PrefsState, FormData>(saveOutreachPrefs, undefined);
  const field = (name: keyof OutreachPrefsInput, label: string, min: number, max: number) => (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={`op-${name}`} className="text-sm">
        {label}
      </label>
      <input
        id={`op-${name}`}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        defaultValue={prefs[name]}
        className="input w-20 text-center"
        dir="ltr"
      />
    </div>
  );
  return (
    <form
      className="flex flex-col gap-3 pt-3"
      data-testid="outreach-prefs"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {field("dailyGoal", s.dailyGoal, 1, 20)}
      {field("followUpDays", s.followUpDays, 2, 14)}
      {field("queueSize", s.queueSize, 3, 10)}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : s.save}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state?.ok && <span className="text-fit font-semibold">{s.saved}</span>}
          {state?.error && <span className="text-destructive">{s.invalid}</span>}
        </p>
      </div>
    </form>
  );
}
