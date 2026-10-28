"use client";

import { startTransition, useActionState } from "react";
import { setApplicationStage, type StageState } from "@/app/hiring-process/actions";
import { Button } from "@/components/ui/button";
import type { HiringStrings } from "@/lib/i18n/hiring-process";

export function ApplicationStageForm({
  applicationId,
  current,
  options,
  s,
}: {
  applicationId: string;
  current: string | null;
  options: [string, string][];
  s: HiringStrings["current"];
}) {
  const [state, action, pending] = useActionState<StageState, FormData>(setApplicationStage, undefined);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="bg-card flex flex-col gap-2 rounded-lg border p-4"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="label" htmlFor="hp-current-stage">
        {s.label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select id="hp-current-stage" name="stage" defaultValue={current ?? ""} className="select-native sm:max-w-xs">
          <option value="">{s.none}</option>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={pending} className="w-full sm:w-fit">
          {s.save}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {state?.ok ? s.saved : s.hint}
      </p>
    </form>
  );
}
