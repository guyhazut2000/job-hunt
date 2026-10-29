"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-fit rounded-full"
      onClick={() => window.print()}
      data-print-hide
    >
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
