"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { useFilterApply } from "./AutoFilterForm";

const fmt = (tpl: string, n: number) => tpl.replace("{n}", n.toLocaleString());

/** Desktop sidebar: live result count + clear, pinned above the filter list. No apply button needed. */
export function FilterStatus({
  total,
  labels,
  clearHref,
  canClear,
}: {
  total: number;
  labels: { results: string; updating: string; clearAll: string; autoApply: string };
  clearHref: string;
  canClear: boolean;
}) {
  const { pending } = useFilterApply();
  return (
    <div
      className="bg-background sticky top-0 z-10 -mx-1 mb-1 flex min-h-10 items-center justify-between gap-2 px-1 pb-2 text-sm"
      data-testid="filter-status"
    >
      <span className="inline-flex items-center gap-1.5" title={labels.autoApply}>
        {pending ? (
          <Loader2 aria-hidden className="text-primary size-3.5 animate-spin" />
        ) : (
          <span aria-hidden className="bg-primary/70 size-1.5 rounded-full" />
        )}
        <span aria-live="polite" aria-atomic="true" data-testid="filter-live-count" data-pending={pending || undefined}>
          {pending ? labels.updating : fmt(labels.results, total)}
        </span>
      </span>
      {canClear && (
        <Link href={clearHref} scroll={false} className="text-muted-foreground hover:text-foreground underline underline-offset-4">
          {labels.clearAll}
        </Link>
      )}
    </div>
  );
}

/** Mobile sheet: floating "Show N jobs" pill at the bottom centre, plus clear. Closes the sheet. */
export function SheetApplyBar({
  total,
  labels,
  clearHref,
  canClear,
}: {
  total: number;
  labels: { showJobs: string; updating: string; clearAll: string };
  clearHref: string;
  canClear: boolean;
}) {
  const { pending, flush } = useFilterApply();
  return (
    <div
      className="pointer-events-none sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-center gap-2 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] [background:linear-gradient(to_top,var(--popover)_60%,transparent)]"
      data-testid="sheet-apply-bar"
    >
      {canClear && (
        <Button asChild variant="outline" className="pointer-events-auto min-h-11 rounded-full shadow-sm">
          <Link href={clearHref} scroll={false} data-testid="sheet-clear">
            <X data-icon="inline-start" aria-hidden />
            {labels.clearAll}
          </Link>
        </Button>
      )}
      <SheetClose asChild>
        <Button
          type="button"
          onClick={flush}
          className="pointer-events-auto min-h-11 min-w-44 rounded-full shadow-lg"
          data-testid="sheet-show-results"
          aria-describedby="sheet-live-count"
        >
          {pending && <Loader2 data-icon="inline-start" aria-hidden className="animate-spin" />}
          <span id="sheet-live-count" aria-live="polite" aria-atomic="true">
            {pending ? labels.updating : fmt(labels.showJobs, total)}
          </span>
        </Button>
      </SheetClose>
    </div>
  );
}

/** Enter-to-apply / no-JS fallback. Hidden once the form auto-applies. */
export function NoJsSubmit({ label }: { label: string }) {
  const [js, setJs] = useState(false);
  useEffect(() => setJs(true), []);
  return (
    <Button type="submit" className={js ? "sr-only" : "mt-2 w-full"} tabIndex={js ? -1 : undefined}>
      {label}
    </Button>
  );
}
