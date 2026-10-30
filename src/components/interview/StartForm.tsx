"use client";

import { Loader2, Play } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { startInterviewAction } from "@/app/interview/actions";
import { Button } from "@/components/ui/button";
import type { InterviewStrings } from "@/lib/i18n/interview";
import { MODES, type InterviewMode } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

function Submit({ t }: { t: InterviewStrings }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11 w-fit rounded-full" data-testid="interview-start">
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Play className="size-4 rtl:rotate-180" aria-hidden />
      )}
      {pending ? t.starting : t.start}
    </Button>
  );
}

export function StartForm({
  preset,
  targets,
  defaultMode = "HR",
  defaultLang,
  compact = false,
  t,
}: {
  /** Fixed target (from ?job / ?app). */
  preset?: { job?: string | null; app?: string | null };
  /** Otherwise: options for the picker ("app:<id>"). */
  targets?: { value: string; label: string }[];
  defaultMode?: InterviewMode;
  defaultLang: "he" | "en";
  /** Narrow sidebar: one mode card per row. */
  compact?: boolean;
  t: InterviewStrings;
}) {
  const [state, action] = useActionState(startInterviewAction, undefined);
  const [mode, setMode] = useState<InterviewMode>(defaultMode);
  return (
    <form action={action} className="flex flex-col gap-4" data-testid="interview-form">
      {preset?.app && <input type="hidden" name="app" value={preset.app} />}
      {preset?.job && !preset.app && <input type="hidden" name="job" value={preset.job} />}
      {!preset && targets && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="interview-target" className="text-sm font-semibold">
            {t.target}
          </label>
          <select
            id="interview-target"
            name="target"
            required
            defaultValue=""
            className="border-input bg-background min-h-11 rounded-md border px-3 text-sm"
            data-testid="interview-target"
          >
            <option value="" disabled>
              {t.pickTarget}
            </option>
            {targets.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold">{t.mode}</legend>
        <div className={cn("grid gap-2", !compact && "sm:grid-cols-3")}>
          {MODES.map((m) => (
            <label
              key={m}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors",
                mode === m ? "border-primary bg-primary/5" : "border-rule hover:bg-muted/50",
              )}
              data-testid={`interview-mode-${m}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="accent-primary size-4"
                />
                {t.modes[m].name}
              </span>
              <span className="text-muted-foreground text-xs leading-relaxed">{t.modes[m].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="mb-1.5 text-sm font-semibold">{t.language}</legend>
        {(["he", "en"] as const).map((l) => (
          <label key={l} className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="language"
              value={l}
              defaultChecked={l === defaultLang}
              className="accent-primary size-4"
            />
            {l === "he" ? t.langHe : t.langEn}
          </label>
        ))}
      </fieldset>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Submit t={t} />
    </form>
  );
}
