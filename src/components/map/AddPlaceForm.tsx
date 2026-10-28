"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Plus } from "lucide-react";
import { addPlace, type PlaceFormState } from "@/app/places-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JobsMapStrings } from "@/lib/i18n/jobs-map";

export function AddPlaceForm({ s }: { s: JobsMapStrings }) {
  const [state, action, pending] = useActionState<PlaceFormState, FormData>(addPlace, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const error =
    state?.error === "not_found"
      ? s.notFound
      : state?.error === "limit"
        ? s.placesLimit
        : state?.error
          ? s.notFound
          : null;
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3" data-testid="add-place">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="place-label">{s.label}</Label>
          <Input id="place-label" name="label" required maxLength={40} placeholder={s.labelPlaceholder} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="place-address">{s.address}</Label>
          <Input
            id="place-address"
            name="address"
            required
            maxLength={200}
            placeholder={s.addressPlaceholder}
            autoComplete="street-address"
            dir="auto"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
          ) : (
            <Plus data-icon="inline-start" aria-hidden />
          )}
          {s.add}
        </Button>
        <p aria-live="polite" className={error ? "text-destructive text-sm" : "text-fit text-sm font-semibold"}>
          {error ?? (state?.ok ? s.saved : "")}
        </p>
      </div>
    </form>
  );
}
