"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { saveEmailSettings, type EmailFormState } from "@/app/email-actions";
import { Button } from "@/components/ui/button";
import type { EmailSyncStrings } from "@/lib/i18n/email-sync";

type Values = {
  lookbackDays: number;
  frequency: "MANUAL" | "DAILY" | "EVERY_6H";
  autoApplyEnabled: boolean;
  autoApplyThreshold: number;
  detectStatusUpdates: boolean;
};

const PRESETS = [7, 14, 30, 90];

export function EmailSettingsForm({ initial, s }: { initial: Values; s: EmailSyncStrings }) {
  const preset = PRESETS.includes(initial.lookbackDays);
  const [lookback, setLookback] = useState(preset ? String(initial.lookbackDays) : "custom");
  const [customDays, setCustomDays] = useState(preset ? "" : String(initial.lookbackDays));
  const [frequency, setFrequency] = useState(initial.frequency);
  const [autoOn, setAutoOn] = useState(initial.autoApplyEnabled);
  const [threshold, setThreshold] = useState(initial.autoApplyThreshold);
  const [statusUpdates, setStatusUpdates] = useState(initial.detectStatusUpdates);
  const [state, setState] = useState<EmailFormState>();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setState(await saveEmailSettings(undefined, fd)));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="label">{s.lookback}</legend>
        <div className="flex flex-wrap gap-2">
          {[...PRESETS.map(String), "custom"].map((v) => (
            <label key={v} className="toggle-chip">
              <input
                type="radio"
                name="lookback"
                value={v}
                className="sr-only"
                checked={lookback === v}
                onChange={() => setLookback(v)}
              />
              {v === "custom" ? s.custom : s.days.replace("{n}", v)}
            </label>
          ))}
        </div>
        {lookback === "custom" && (
          <div className="max-w-48">
            <label className="label sr-only" htmlFor="customDays">
              {s.customDays}
            </label>
            <input
              id="customDays"
              name="customDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              placeholder={s.customDays}
              className="input"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label">{s.frequency}</legend>
        <div className="flex flex-wrap gap-2">
          {(["MANUAL", "DAILY", "EVERY_6H"] as const).map((v) => (
            <label key={v} className="toggle-chip">
              <input
                type="radio"
                name="frequency"
                value={v}
                className="sr-only"
                checked={frequency === v}
                onChange={() => setFrequency(v)}
              />
              {s.freq[v]}
            </label>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{s.freqHint}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-3" data-auto-apply>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="autoApplyEnabled"
            className="accent-foreground mt-1 size-4 shrink-0"
            checked={autoOn}
            onChange={(e) => setAutoOn(e.target.checked)}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{s.autoApply}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">{s.autoApplyHint}</span>
          </span>
        </label>
        <div className={autoOn ? "flex flex-col gap-1.5 ps-7" : "flex flex-col gap-1.5 ps-7 opacity-50"}>
          <label htmlFor="autoApplyThreshold" className="label flex items-center justify-between gap-3">
            <span>{s.threshold}</span>
            <output
              htmlFor="autoApplyThreshold"
              className="font-heading text-foreground text-base font-bold tabular-nums"
            >
              {s.thresholdValue.replace("{n}", String(threshold))}
            </output>
          </label>
          <input
            id="autoApplyThreshold"
            name="autoApplyThreshold"
            type="range"
            min={40}
            max={100}
            step={5}
            value={threshold}
            disabled={!autoOn}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="accent-foreground w-full max-w-md"
          />
          {/* Disabled inputs aren't submitted; keep the saved value when automation is off. */}
          {!autoOn && <input type="hidden" name="autoApplyThreshold" value={threshold} />}
          <p className="text-muted-foreground text-xs leading-relaxed">{s.thresholdHint}</p>
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="detectStatusUpdates"
          className="accent-foreground mt-1 size-4 shrink-0"
          checked={statusUpdates}
          onChange={(e) => setStatusUpdates(e.target.checked)}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{s.statusUpdates}</span>
          <span className="text-muted-foreground text-xs leading-relaxed">{s.statusUpdatesHint}</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {s.save}
        </Button>
        {state?.ok && !pending && (
          <span role="status" className="text-fit inline-flex items-center gap-1 text-sm font-semibold">
            <Check className="size-4" aria-hidden /> {s.saved}
            {state.applied ? ` · ${s.appliedN.replace("{n}", String(state.applied))}` : ""}
          </span>
        )}
        {state?.error && (
          <span role="alert" className="text-destructive text-sm">
            {s.customDays}
          </span>
        )}
      </div>
    </form>
  );
}
