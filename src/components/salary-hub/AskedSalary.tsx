"use client";

import { useActionState, useState } from "react";
import { Banknote } from "lucide-react";
import { setAskedSalary, type FormState } from "@/app/salary/hub-actions";
import { Button } from "@/components/ui/button";

export interface AskedSalaryLabels {
  set: string;
  label: string;
  note: string;
  save: string;
  clear: string;
  saved: string;
  invalid: string;
  at: string;
}

/** Compact "salary I asked for" editor on a tracker card (#91). */
export function AskedSalary({
  applicationId,
  title,
  value,
  note,
  labels,
  locale,
}: {
  applicationId: string;
  title: string;
  value: number | null;
  note: string | null;
  labels: AskedSalaryLabels;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await setAskedSalary(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, undefined);
  const display = value ? `₪${value.toLocaleString(locale === "he" ? "he-IL" : "en-GB")}` : null;

  if (!open)
    return (
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${labels.set}: ${title}`}
          className="text-foreground/80 hover:text-primary -my-1 inline-flex min-h-9 items-center gap-1 self-start text-xs font-semibold underline-offset-4 hover:underline"
          data-testid="asked-salary-open"
        >
          <Banknote className="size-3.5 shrink-0" aria-hidden />
          {display ? <bdi>{labels.at.replace("{amount}", display)}</bdi> : labels.set}
        </button>
        {display && note && (
          <p className="text-muted-foreground text-xs" dir="auto">
            {note}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-fit text-xs">
            {labels.saved}
          </p>
        )}
      </div>
    );

  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-md border p-2" data-testid="asked-salary-form">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {labels.label}
        <input
          type="text"
          inputMode="numeric"
          name="amount"
          required
          dir="ltr"
          defaultValue={value ? String(value) : ""}
          placeholder="32000"
          className="bg-background min-h-11 rounded-md border px-2 text-start text-sm xl:min-h-9"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {labels.note}
        <input
          type="text"
          name="note"
          maxLength={300}
          defaultValue={note ?? ""}
          dir="auto"
          className="bg-background min-h-11 rounded-md border px-2 text-sm xl:min-h-9"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-destructive text-xs">
          {labels.invalid}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button type="submit" size="sm" disabled={pending}>
          {labels.save}
        </Button>
        {display && (
          <Button type="submit" name="clear" value="1" size="sm" variant="ghost" formNoValidate disabled={pending}>
            {labels.clear}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ✕
        </Button>
      </div>
    </form>
  );
}
