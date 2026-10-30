"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Building2, Ellipsis, KanbanSquare, LogIn, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Labels = Record<
  | "jobs"
  | "companies"
  | "tracker"
  | "profile"
  | "more"
  | "login"
  | "register"
  | "logout"
  | "learn"
  | "documents"
  | "learnMine"
  | "digest"
  | "admin"
  | "features"
  | "language"
  | "account",
  string
>;

export function MobileNav({ user, labels, locale }: { user: { role: string } | null; labels: Labels; locale: string }) {
  const pathname = usePathname();
  // The sheet lives in the persistent layout: close it on any navigation, otherwise its overlay and
  // scroll lock survive into the next page and the page can't scroll.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const items: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/jobs", label: labels.jobs, icon: Briefcase },
    { href: "/companies", label: labels.companies, icon: Building2 },
    ...(user
      ? [
          { href: "/dashboard", label: labels.tracker, icon: KanbanSquare },
          { href: "/profile", label: labels.profile, icon: UserRound },
        ]
      : [{ href: "/login", label: labels.login, icon: LogIn }]),
  ];
  const tab =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold transition-colors";
  return (
    <nav
      aria-label="mobile"
      className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex h-(--bottom-nav-h) items-stretch px-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
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
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={cn(tab, "text-foreground/65")}>
              <span className="grid h-7 w-12 place-items-center">
                <Ellipsis className="size-5" aria-hidden />
              </span>
              {labels.more}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="scroll-thin max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <SheetHeader>
                <SheetTitle className="font-heading text-lg">{labels.account}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4">
                <SheetClose asChild>
                  <Button asChild variant="outline" className="justify-start">
                    <Link href="/learn">{labels.learn}</Link>
                  </Button>
                </SheetClose>
                {user && (
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="justify-start">
                      <Link href="/profile?tab=documents">{labels.documents}</Link>
                    </Button>
                  </SheetClose>
                )}
                {user && (
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="justify-start">
                      <Link href="/learn/me">{labels.learnMine}</Link>
                    </Button>
                  </SheetClose>
                )}
                {user && (
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="justify-start">
                      <Link href="/digest">{labels.digest}</Link>
                    </Button>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Button asChild variant="outline" className="justify-start">
                    <Link href="/features">{labels.features}</Link>
                  </Button>
                </SheetClose>
                {user?.role === "ADMIN" && (
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="justify-start">
                      <Link href="/admin">{labels.admin}</Link>
                    </Button>
                  </SheetClose>
                )}
                <form action={setLocale} onSubmit={() => setOpen(false)}>
                  <input type="hidden" name="locale" value={locale === "he" ? "en" : "he"} />
                  <Button variant="outline" type="submit" className="w-full justify-start">
                    {labels.language}
                  </Button>
                </form>
                {user ? (
                  <form action={logout} onSubmit={() => setOpen(false)}>
                    <Button variant="destructive" type="submit" className="w-full justify-start">
                      {labels.logout}
                    </Button>
                  </form>
                ) : (
                  <SheetClose asChild>
                    <Button asChild>
                      <Link href="/register">{labels.register}</Link>
                    </Button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
