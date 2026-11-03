"use client";

import { useActionState, useEffect, useRef } from "react";
import { addSalaryDataPoint, type FormState } from "@/app/salary/hub-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import type { SalaryHubStrings } from "@/lib/i18n/salary-hub";

/** Add one of "my numbers" for the selected function/level/region (#91). */
export function DataPointForm({
  family,
  level,
  city,
  s,
}: {
  family: string;
  level: string;
  city: string;
  s: SalaryHubStrings["mine"];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(addSalaryDataPoint, undefined);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2" data-testid="salary-point-form">
      <input type="hidden" name="family" value={family} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="city" value={city} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.amount}
        <Input name="amount" inputMode="numeric" required dir="ltr" placeholder="32000" className="text-start" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.company}
        <Input name="company" maxLength={120} dir="auto" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {s.source}
        <span className="flex items-center gap-2">
          <Input
            ref={sourceRef}
            name="source"
            required
            minLength={2}
            maxLength={300}
            dir="auto"
            placeholder={s.sourcePh}
          />
          <VoiceInputButton
            targetRef={sourceRef}
            maxLength={300}
            compact
            disabled={pending}
            testId="salary-source-voice"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.observedAt}
        <Input name="observedAt" type="month" dir="ltr" className="text-start" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.note}
        <span className="flex items-center gap-2">
          <Input ref={noteRef} name="note" maxLength={500} dir="auto" />
          <VoiceInputButton targetRef={noteRef} maxLength={500} compact disabled={pending} testId="salary-note-voice" />
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {s.save}
        </Button>
        {state?.ok && (
          <p role="status" className="text-fit text-sm">
            {s.saved}
          </p>
        )}
        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {s.invalid}
          </p>
        )}
      </div>
    </form>
  );
}
