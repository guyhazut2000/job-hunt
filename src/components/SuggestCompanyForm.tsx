"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { suggestCompany, type SuggestState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SuggestCompanyStrings } from "@/lib/i18n/suggest-company";

export function SuggestCompanyForm({ s }: { s: SuggestCompanyStrings }) {
  const [state, action, pending] = useActionState<SuggestState, FormData>(suggestCompany, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const error = state?.error ? s[state.error] : null;
  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border p-4" data-testid="suggest-company">
      <div>
        <h2 className="font-heading text-lg font-bold">{s.title}</h2>
        <p className="text-muted-foreground text-sm">{s.hint}</p>
      </div>
      <form ref={ref} action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="suggest-name">{s.name}</Label>
            <Input
              id="suggest-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder={s.namePlaceholder}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="suggest-url">{s.url}</Label>
            <Input
              id="suggest-url"
              name="url"
              required
              maxLength={500}
              inputMode="url"
              dir="ltr"
              placeholder={s.urlPlaceholder}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
            ) : (
              <Send data-icon="inline-start" aria-hidden />
            )}
            {s.submit}
          </Button>
          <p aria-live="polite" className={error ? "text-destructive text-sm" : "text-fit text-sm font-semibold"}>
            {error ?? (state?.ok ? s.thanks : "")}
          </p>
        </div>
      </form>
    </section>
  );
}
