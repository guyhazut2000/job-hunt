"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/i18n/dictionaries";
import { navLabel, navSectionLabel, navigationStrings } from "@/lib/i18n/navigation";
import { activeTargetId, isPrimaryActive, moreSections, primaryLinks, type NavRole } from "@/lib/nav/config";
import { cn } from "@/lib/utils";

const linkClass =
  "relative inline-flex h-11 shrink-0 items-center rounded-sm px-2.5 text-[0.95rem] font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 lg:px-3 " +
  "text-foreground/70 hover:text-foreground " +
  "after:bg-primary after:absolute after:inset-x-2.5 after:bottom-1.5 after:h-0.5 after:origin-center after:scale-x-0 after:transition-transform lg:after:inset-x-3";

/** Desktop primary destinations plus a sectioned More menu. Both come from the shared nav config. */
export function NavLinks({ locale, role, moreLabel }: { locale: Locale; role: NavRole; moreLabel: string }) {
  const pathname = usePathname();
  const strings = navigationStrings(locale);
  const links = primaryLinks(role);
  const sections = moreSections(role, "desktop");
  const moreActive = sections.some((section) => activeTargetId(section.items, pathname) !== null);

  return (
    <ul className="flex min-w-0 items-center gap-0.5" data-testid="primary-nav">
      {links.map((link) => {
        const active = isPrimaryActive(link, pathname);
        return (
          <li key={link.id} className="shrink-0">
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              data-testid={`primary-${link.id}`}
              className={cn(linkClass, active && "text-foreground after:scale-x-100")}
            >
              {navLabel(strings, link.id)}
            </Link>
          </li>
        );
      })}
      {sections.length > 0 && (
        <li className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(linkClass, "gap-1", moreActive && "text-foreground after:scale-x-100")}
              data-testid="nav-more"
              aria-current={moreActive ? "true" : undefined}
            >
              {moreLabel}
              <ChevronDown aria-hidden className="size-4 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label={strings.moreMenu} className="w-72" style={{ width: "18rem" }}>
              {sections.map((section, index) => {
                const current = activeTargetId(section.items, pathname);
                return (
                  <DropdownMenuGroup key={section.id}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel data-testid={`more-section-${section.id}`}>
                      {navSectionLabel(strings, section.id)}
                    </DropdownMenuLabel>
                    {section.items.map((item) => {
                      const active = item.id === current;
                      return (
                        <DropdownMenuItem key={item.id} asChild className="min-h-11 font-semibold whitespace-nowrap">
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            data-testid={`more-${item.id}`}
                          >
                            {navLabel(strings, item.id)}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      )}
    </ul>
  );
}
