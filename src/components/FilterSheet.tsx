"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{label}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
