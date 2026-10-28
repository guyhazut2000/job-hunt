"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * How eagerly a link collapses into the "More" menu as the header narrows:
 * - "always": inline from `md` (where the desktop header nav starts).
 * - "lg": inline from `lg`; in "More" between `md` and `lg`.
 * - "more": always in "More" (keeps the bar from overflowing when signed in).
 */
export type NavPriority = "always" | "lg" | "more";
export interface NavLink {
  href: string;
  label: string;
  priority?: NavPriority;
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const linkClass =
  "relative inline-flex min-h-11 shrink-0 items-center px-2.5 text-[0.95rem] font-semibold whitespace-nowrap transition-colors lg:px-3 " +
  "text-foreground/70 hover:text-foreground " +
  "after:bg-primary after:absolute after:inset-x-2.5 after:bottom-1.5 after:h-0.5 after:origin-center after:scale-x-0 after:transition-transform lg:after:inset-x-3";

export function NavLinks({ links, moreLabel }: { links: NavLink[]; moreLabel: string }) {
  const pathname = usePathname();
  const overflow = links.filter((l) => (l.priority ?? "always") !== "always");
  const alwaysInMore = overflow.some((l) => l.priority === "more");
  const moreActive = overflow.some((l) => isActive(pathname, l.href));
  return (
    <ul className="flex min-w-0 items-center gap-0.5">
      {links.map((l) => {
        const priority = l.priority ?? "always";
        if (priority === "more") return null;
        const active = isActive(pathname, l.href);
        return (
          <li key={l.href} className={cn("shrink-0", priority === "lg" && "hidden lg:block")}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(linkClass, active && "text-foreground after:scale-x-100")}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
      {overflow.length > 0 && (
        <li className={cn("shrink-0", !alwaysInMore && "lg:hidden")}>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(linkClass, "gap-1", moreActive && "text-foreground after:scale-x-100")}
              data-testid="nav-more"
            >
              {moreLabel}
              <ChevronDown aria-hidden className="size-4 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {overflow.map((l) => {
                const active = isActive(pathname, l.href);
                return (
                  <DropdownMenuItem
                    key={l.href}
                    asChild
                    className={cn("min-h-11 font-semibold whitespace-nowrap", l.priority === "lg" && "lg:hidden")}
                  >
                    <Link href={l.href} aria-current={active ? "page" : undefined}>
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      )}
    </ul>
  );
}
