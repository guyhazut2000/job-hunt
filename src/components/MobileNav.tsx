"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Briefcase, Building2, Ellipsis, FolderOpen, KanbanSquare, LogIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Locale } from "@/lib/i18n/dictionaries";
import { navLabel, navSectionLabel, navigationStrings } from "@/lib/i18n/navigation";
import { activeMobileId, activeTargetId, mobileBarLinks, moreSections, type NavRole } from "@/lib/nav/config";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  jobs: Briefcase,
  companies: Building2,
  tracker: KanbanSquare,
  documents: FolderOpen,
  prep: BookOpen,
};

export type MobileNavActions = {
  more: string;
  account: string;
  login: string;
  register: string;
  logout: string;
  language: string;
};

const tab =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Bottom bar: at most four destinations plus More.
 * The sheet is grouped (Prep, Progress, Tools, Admin). Language and logout stay actions.
 */
export function MobileNav({ role, locale, actions }: { role: NavRole; locale: Locale; actions: MobileNavActions }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const strings = navigationStrings(locale);
  const items = mobileBarLinks(role);
  const sections = moreSections(role, "mobile");
  const current = activeMobileId(role, pathname);
  const otherLocale = locale === "he" ? "en" : "he";

  return (
    <nav
      aria-label={strings.mobile}
      data-testid="mobile-nav"
      className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex h-(--bottom-nav-h) items-stretch px-1">
        {items.map((item) => {
          const Icon = ICONS[item.id] ?? Briefcase;
          const active = current === item.id;
          return (
            <li key={item.id} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-testid={`mobile-${item.id}`}
                className={cn(tab, active ? "text-primary" : "text-foreground/65")}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon className="size-5" aria-hidden strokeWidth={active ? 2.4 : 1.9} />
                </span>
                {navLabel(strings, item.id)}
              </Link>
            </li>
          );
        })}
        {role === "guest" && (
          <li className="flex flex-1">
            <Link
              href="/login"
              aria-current={pathname === "/login" ? "page" : undefined}
              data-testid="mobile-login"
              className={cn(tab, pathname === "/login" ? "text-primary" : "text-foreground/65")}
            >
              <span
                className={cn(
                  "grid h-7 w-12 place-items-center rounded-full transition-colors",
                  pathname === "/login" && "bg-primary/12",
                )}
              >
                <LogIn className="size-5" aria-hidden strokeWidth={pathname === "/login" ? 2.4 : 1.9} />
              </span>
              {actions.login}
            </Link>
          </li>
        )}
        <li className="flex flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(tab, current === "more" ? "text-primary" : "text-foreground/65")}
              data-testid="mobile-more"
              aria-current={current === "more" ? "true" : undefined}
            >
              <span
                className={cn("grid h-7 w-12 place-items-center rounded-full", current === "more" && "bg-primary/12")}
              >
                <Ellipsis className="size-5" aria-hidden />
              </span>
              {actions.more}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="scroll-thin max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <SheetHeader>
                <SheetTitle className="font-heading text-lg">{actions.more}</SheetTitle>
              </SheetHeader>
              <nav aria-label={strings.moreMenu} className="flex flex-col gap-4 px-4">
                {sections.map((section) => {
                  const activeId = activeTargetId(section.items, pathname);
                  return (
                    <section
                      key={section.id}
                      aria-labelledby={`more-${section.id}`}
                      data-testid={`more-section-${section.id}`}
                    >
                      <h3 id={`more-${section.id}`} className="text-muted-foreground px-2 pb-1 text-xs font-bold">
                        {navSectionLabel(strings, section.id)}
                      </h3>
                      <ul className="flex flex-col">
                        {section.items.map((item) => {
                          const active = item.id === activeId;
                          return (
                            <li key={item.id}>
                              <SheetClose asChild>
                                <Link
                                  href={item.href}
                                  aria-current={active ? "page" : undefined}
                                  data-testid={`more-${item.id}`}
                                  className={cn(
                                    "focus-visible:ring-ring/50 flex min-h-11 items-center rounded-md px-2 text-sm font-semibold outline-none focus-visible:ring-3",
                                    active ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted",
                                  )}
                                >
                                  {navLabel(strings, item.id)}
                                </Link>
                              </SheetClose>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </nav>
              <div className="mt-4 flex flex-col gap-2 border-t px-4 pt-4">
                <h3 className="text-muted-foreground px-2 pb-1 text-xs font-bold">{actions.account}</h3>
                <form action={setLocale} onSubmit={() => setOpen(false)}>
                  <input type="hidden" name="locale" value={otherLocale} />
                  <Button variant="outline" type="submit" className="w-full justify-start" lang={otherLocale}>
                    {actions.language}
                  </Button>
                </form>
                {role === "guest" ? (
                  <SheetClose asChild>
                    <Button asChild>
                      <Link href="/register">{actions.register}</Link>
                    </Button>
                  </SheetClose>
                ) : (
                  <form action={logout} onSubmit={() => setOpen(false)}>
                    <Button variant="destructive" type="submit" className="w-full justify-start">
                      {actions.logout}
                    </Button>
                  </form>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
