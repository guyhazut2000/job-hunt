"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BellPlus, Check } from "lucide-react";
import { createSavedSearch, type SaveSearchState } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Labels {
  saveSearch: string;
  saveSearchHint: string;
  saveSearchName: string;
  saveSearchSubmit: string;
  saveSearchSaved: string;
  saveSearchLimit: string;
  saveSearchEmpty: string;
  manage: string;
}

/** "Save search" on /jobs: stores the current filters as a saved search that notifies on new jobs. */
export function SaveSearchButton({
  query,
  defaultName,
  labels,
  alreadySaved,
  side = "bottom",
}: {
  query: string;
  defaultName: string;
  labels: Labels;
  alreadySaved: boolean;
  side?: "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SaveSearchState, FormData>(createSavedSearch, undefined);
  const saved = alreadySaved || state?.ok;
  const error =
    state?.error === "limit"
      ? labels.saveSearchLimit.replace("{n}", "20")
      : state?.error === "empty"
        ? labels.saveSearchEmpty
        : null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={saved ? "ghost" : "outline"}
          size="sm"
          data-testid="save-search"
          aria-pressed={saved}
        >
          {saved ? <Check data-icon="inline-start" aria-hidden /> : <BellPlus data-icon="inline-start" aria-hidden />}
          {labels.saveSearch}
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="mx-auto w-full max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{labels.saveSearch}</SheetTitle>
          <SheetDescription>{labels.saveSearchHint}</SheetDescription>
        </SheetHeader>
        <form action={action} className="flex flex-col gap-3 px-4 pb-6">
          <input type="hidden" name="query" value={query} />
          <label htmlFor="saved-search-name" className="text-sm font-semibold">
            {labels.saveSearchName}
          </label>
          <Input id="saved-search-name" name="name" defaultValue={defaultName} maxLength={80} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending} data-testid="save-search-submit">
              <BellPlus data-icon="inline-start" aria-hidden />
              {labels.saveSearchSubmit}
            </Button>
            <Link
              href="/settings/notifications#saved-searches"
              className="text-primary text-sm font-semibold hover:underline"
            >
              {labels.manage}
            </Link>
          </div>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {state?.ok ? (
              <span className="text-fit">{labels.saveSearchSaved}</span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : null}
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
