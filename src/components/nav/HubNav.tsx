"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { navLabel, navigationStrings } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/dictionaries";
import { hubStrip, type NavRole } from "@/lib/nav/config";
import { cn } from "@/lib/utils";

const tabClass =
  "inline-flex h-11 items-center border-b-2 px-2.5 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Sticky sibling tabs for the hub that owns the current path. Renders nothing on unrelated pages. */
export function HubNav({ locale, role }: { locale: Locale; role: NavRole }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const strings = navigationStrings(locale);
  const strip = hubStrip(pathname, search.toString(), role);
  const shown = Boolean(strip);
  const listRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-hub-nav", shown);
    return () => document.documentElement.removeAttribute("data-hub-nav");
  }, [shown]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = current.getBoundingClientRect();
    if (itemRect.left < listRect.left - 1 || itemRect.right > listRect.right + 1) {
      current.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [pathname, strip?.activeId]);

  if (!strip) return null;

  return (
    <nav
      aria-label={navLabel(strings, strip.labelId)}
      data-testid="hub-nav"
      data-hub={strip.hubId}
      data-print-hide
      className="bg-background/92 sticky top-(--app-header-h) z-30 border-b backdrop-blur-md"
    >
      <ul
        ref={listRef}
        className="no-scrollbar mx-auto flex h-11 max-w-6xl items-stretch gap-0.5 overflow-x-auto px-4 md:px-6"
      >
        {strip.tabs.map((tab) => {
          const active = tab.id === strip.activeId;
          return (
            <li key={tab.id} className="flex shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                data-testid={`hub-tab-${tab.id}`}
                className={cn(
                  tabClass,
                  active
                    ? "border-primary text-foreground"
                    : "text-foreground/65 hover:text-foreground border-transparent",
                )}
              >
                {navLabel(strings, tab.id)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
