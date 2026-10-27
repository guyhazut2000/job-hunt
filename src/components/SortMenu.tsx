"use client";

import Link from "next/link";
import { ArrowDownUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SortOption {
  key: string;
  label: string;
  href: string;
  disabled?: boolean;
}

/** Sort control. Each option is a plain link (server-computed href), so the choice lives in the URL. */
export function SortMenu({
  label,
  heading,
  current,
  options,
  hint,
}: {
  label: string;
  heading: string;
  current: string;
  options: SortOption[];
  hint?: string;
}) {
  const active = options.find((o) => o.key === current);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" data-testid="sort-trigger" aria-label={`${heading}: ${active?.label ?? ""}`}>
          <ArrowDownUp data-icon="inline-start" aria-hidden />
          <span className="text-muted-foreground hidden sm:inline">{label}:</span>
          <span className="font-semibold">{active?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs">{heading}</DropdownMenuLabel>
        {options.map((o) =>
          o.disabled ? (
            <DropdownMenuItem key={o.key} disabled className="min-h-11">
              <span className="flex-1">{o.label}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={o.key} asChild className="min-h-11">
              <Link href={o.href} aria-current={o.key === current ? "true" : undefined} scroll={false}>
                <span className="flex-1">{o.label}</span>
                {o.key === current && <Check aria-hidden className="text-primary" />}
              </Link>
            </DropdownMenuItem>
          ),
        )}
        {hint && (
          <>
            <DropdownMenuSeparator />
            <p className="text-muted-foreground max-w-64 px-1.5 py-1 text-xs">{hint}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
