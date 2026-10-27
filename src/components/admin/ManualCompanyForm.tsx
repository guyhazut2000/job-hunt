"use client";

import { useActionState, useId } from "react";
import { adminAddManualCompany, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";

interface Labels {
  title: string;
  hint: string;
  name: string;
  website: string;
  careersUrl: string;
  notesHe: string;
  notesEn: string;
  submit: string;
}

/** Admin: add a company the user checks by hand (careers link + notes), never hidden for lacking a feed. */
export function ManualCompanyForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<FormState, FormData>(adminAddManualCompany, undefined);
  const id = useId();
  return (
    <form action={action} className="card flex flex-col gap-3" aria-busy={pending} data-manual-form>
      <div>
        <h2 className="font-semibold">{labels.title}</h2>
        <p className="text-muted-foreground text-sm">{labels.hint}</p>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-name`}>
          {labels.name}
        </label>
        <input id={`${id}-name`} name="name" required maxLength={100} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-website`}>
            {labels.website}
          </label>
          <input
            id={`${id}-website`}
            name="website"
            type="url"
            inputMode="url"
            placeholder="https://"
            className="input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-careers`}>
            {labels.careersUrl}
          </label>
          <input
            id={`${id}-careers`}
            name="careersUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            className="input"
            dir="ltr"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-he`}>
            {labels.notesHe}
          </label>
          <textarea id={`${id}-he`} name="notesHe" rows={2} maxLength={1000} className="input" dir="rtl" />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-en`}>
            {labels.notesEn}
          </label>
          <textarea id={`${id}-en`} name="notesEn" rows={2} maxLength={1000} className="input" dir="ltr" />
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="border-destructive text-destructive border-s-4 ps-3 text-sm">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" aria-live="polite" className="text-sm">
          {state.ok}
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {labels.submit}
      </Button>
    </form>
  );
}
