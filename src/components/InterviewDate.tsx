"use client";

import { useActionState, useState } from "react";
import { CalendarClock } from "lucide-react";
import { setInterview, type InterviewState } from "@/app/interview-actions";
import { Button } from "@/components/ui/button";

export interface InterviewDateLabels {
  set: string;
  date: string;
  note: string;
  save: string;
  clear: string;
  saved: string;
  invalid: string;
  at: string;
}

/** Compact interview date editor on a tracker card (feeds the ~24h / ~2h reminders). */
export function InterviewDate({
  applicationId,
  title,
  value,
  note,
  display,
  labels,
}: {
  applicationId: string;
  title: string;
  /** Israel wall time "YYYY-MM-DDTHH:mm" or "". */
  value: string;
  note: string | null;
  /** Formatted date, when set. */
  display: string | null;
  labels: InterviewDateLabels;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<InterviewState, FormData>(async (prev, fd) => {
    const r = await setInterview(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, undefined);

  if (!open)
    return (
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${display ? labels.date : labels.set}: ${title}`}
          className="text-foreground/80 hover:text-primary -my-1 inline-flex min-h-9 items-center gap-1 self-start text-xs font-semibold underline-offset-4 hover:underline"
        >
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          {display ? labels.at.replace("{when}", display) : labels.set}
        </button>
        {state?.ok && (
          <p role="status" className="text-fit text-xs">
            {labels.saved}
          </p>
        )}
      </div>
    );

  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-md border p-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {labels.date}
        <input
          type="datetime-local"
          name="at"
          required
          defaultValue={value}
          className="bg-background min-h-11 rounded-md border px-2 text-sm xl:min-h-9"
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
