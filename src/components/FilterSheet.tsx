"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollFade } from "@/components/ScrollFade";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function FilterSheet({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal data-icon="inline-start" aria-hidden />
          {label}
          {count > 0 && (
            <span className="bg-primary text-primary-foreground grid size-5 place-items-center rounded-full font-mono text-[0.7rem]">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      {/* Header stays put; only the filter list scrolls, with the "show results / clear" bar pinned below it. */}
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl">
        <div aria-hidden className="bg-border mx-auto mt-2 h-1 w-10 shrink-0 rounded-full" />
        <SheetHeader className="border-b pt-2 pb-3">
          <SheetTitle className="font-heading flex items-center gap-2 text-xl">
            {label}
            {count > 0 && (
              <span className="bg-primary text-primary-foreground grid size-5 place-items-center rounded-full font-mono text-[0.7rem]">
                {count}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        <ScrollFade className="px-4" fadeColor="var(--popover)" bottomFade={false}>
          {children}
        </ScrollFade>
      </SheetContent>
    </Sheet>
  );
}
