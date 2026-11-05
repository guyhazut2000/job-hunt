"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { navLabel, navigationStrings } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/dictionaries";
import { hubStrip, type NavRole } from "@/lib/nav/config";
import { cn } from "@/lib/utils";

const tabClass =
  "inline-flex h-11 items-center border-b-2 px-2.5 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Scroll the active tab into the strip only. `scrollIntoView` also walks the window,
 * which would move the jobs list during hydration and filter soft-navs.
 */
function scrollTabIntoStrip(list: HTMLElement, current: HTMLElement) {
  const x = window.scrollX;
  const y = window.scrollY;
  current.scrollIntoView({ inline: "nearest", block: "nearest" });
  if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
}

function HubNavBar({
  locale,
  role,
  pathname,
  search,
}: {
  locale: Locale;
  role: NavRole;
  pathname: string;
  search: string;
}) {
  const strings = navigationStrings(locale);
  const strip = hubStrip(pathname, search, role);
  const listRef = useRef<HTMLUListElement>(null);
  const shown = Boolean(strip);

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
      scrollTabIntoStrip(list, current);
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

/** Reads the query (map vs list). Suspends on the server; the fallback is the same bar. */
function HubNavQuery({ locale, role, pathname }: { locale: Locale; role: NavRole; pathname: string }) {
  const params = useSearchParams();
  // First client render must match the server fallback (no query) or React hydrates the wrong tab.
  const [live, setLive] = useState(false);
  useLayoutEffect(() => setLive(true), []);
  return <HubNavBar locale={locale} role={role} pathname={pathname} search={live ? params.toString() : ""} />;
}

/**
 * Sticky sibling tabs for the hub that owns the current path.
 * The bar is in the server HTML (pathname only). `useSearchParams` suspends during SSR, which
 * used to omit the strip until hydration and shift scroll on `/jobs` under the filter soft-nav.
 */
export function HubNav({ locale, role }: { locale: Locale; role: NavRole }) {
  const pathname = usePathname() ?? "";
  const fallback = <HubNavBar locale={locale} role={role} pathname={pathname} search="" />;
  return (
    <Suspense fallback={fallback}>
      <HubNavQuery locale={locale} role={role} pathname={pathname} />
    </Suspense>
  );
}
