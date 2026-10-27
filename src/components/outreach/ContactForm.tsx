"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ContactCategory } from "@prisma/client";
import { addContact, type ContactFormState } from "@/app/outreach/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CONTACT_CATEGORIES } from "@/lib/outreach/links";

export function ContactForm({
  companyId,
  jobId,
  category,
  t,
  onSaved,
}: {
  companyId: string;
  jobId?: string | null;
  category: ContactCategory;
  t: Dictionary["people"];
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(addContact, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      onSaved?.();
    }
  }, [state, onSaved]);
  return (
    <form
      ref={form}
      // Dispatch manually: a plain `action` prop makes React reset the form even when validation fails.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="companyId" value={companyId} />
      {jobId && <input type="hidden" name="jobId" value={jobId} />}
      <div>
        <label className="label" htmlFor="contact-name">
          {t.name}
        </label>
        <input id="contact-name" name="name" required maxLength={120} className="input" dir="auto" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="contact-title">
          {t.titleField}
        </label>
        <input id="contact-title" name="title" maxLength={160} className="input" dir="auto" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="contact-url">
          {t.linkedinUrl}
        </label>
        <input
          id="contact-url"
          name="linkedinUrl"
          type="url"
          inputMode="url"
          maxLength={400}
          placeholder="https://www.linkedin.com/in/…"
          className="input"
          dir="ltr"
          aria-invalid={state?.error === "linkedin" || undefined}
          aria-describedby={state?.error === "linkedin" ? "contact-url-err" : undefined}
        />
        {state?.error === "linkedin" && (
          <p id="contact-url-err" className="text-destructive mt-1 text-sm">
            {t.invalidLinkedin}
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="contact-category">
          {t.category}
        </label>
        <select
          id="contact-category"
          name="category"
          defaultValue={category}
          key={category}
          className="select-native min-h-11 w-full"
        >
          {CONTACT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="contact-notes">
          {t.notes}
        </label>
        <textarea id="contact-notes" name="notes" rows={3} maxLength={2000} className="input" dir="auto" />
      </div>
      <p aria-live="polite" className="text-sm">
        {state?.error === "invalid" && <span className="text-destructive">{t.invalid}</span>}
        {state?.ok && <span className="text-fit font-semibold">{t.saved}</span>}
      </p>
      <Button type="submit" disabled={pending} size="lg">
        {pending ? "…" : t.add}
      </Button>
      <p className="text-muted-foreground text-xs">{t.private}</p>
    </form>
  );
}
