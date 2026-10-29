"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface PsNavItem {
  href: string;
  label: string;
}

/** Section tabs for /learn/problem-solving (horizontal scroll on mobile). */
export function PsNav({ items, label }: { items: PsNavItem[]; label: string }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/learn/problem-solving" ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <nav aria-label={label} data-print-hide className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1.5 pb-1">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active(it.href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
                active(it.href)
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card hover:bg-muted text-foreground/80",
              )}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
