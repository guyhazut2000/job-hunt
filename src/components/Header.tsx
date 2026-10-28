import Link from "next/link";
import { Languages, LogOut } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { learningStrings } from "@/lib/i18n/learning";
import { learningHubStrings } from "@/lib/i18n/learning-hub";
import { Brand } from "./Brand";
import { NavLinks, type NavLink } from "./NavLinks";

export async function Header() {
  const [{ t, locale }, session] = await Promise.all([getDictionary(), auth()]);
  const user = session?.user;
  // Labels never wrap (a word split across lines reads as a typo); whatever doesn't fit at a
  // breakpoint collapses into the "More" menu instead. Signed-in users have more links, so the
  // secondary ones live in "More" at every width.
  const links: NavLink[] = [
    { href: "/jobs", label: t.nav.jobs },
    { href: "/companies", label: t.nav.companies },
    { href: "/learn", label: learningStrings(locale).nav },
    ...(user
      ? [
          { href: "/dashboard", label: t.nav.dashboard, priority: "lg" as const },
          { href: "/profile", label: t.nav.profile, priority: "lg" as const },
          { href: "/learn/me", label: learningHubStrings(locale).navMine, priority: "more" as const },
          { href: "/pricing", label: t.nav.pricing, priority: "more" as const },
        ]
      : [{ href: "/pricing", label: t.nav.pricing, priority: "lg" as const }]),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: t.nav.admin, priority: "more" as const }] : []),
  ];
  return (
    <header className="bg-background/92 rule-double sticky top-0 z-40 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:px-6 lg:gap-4">
        <Brand tagline={user ? undefined : t.ui.kicker} />
        <nav aria-label="main" className="hidden min-w-0 flex-1 md:ms-2 md:block lg:ms-4">
          <NavLinks links={links} moreLabel={t.ui.more} />
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <form action={setLocale}>
            <input type="hidden" name="locale" value={locale === "he" ? "en" : "he"} />
            <Button variant="ghost" size="sm" type="submit" lang={locale === "he" ? "en" : "he"}>
              <Languages data-icon="inline-start" aria-hidden />
              {t.nav.language}
            </Button>
          </form>
          {user ? (
            <form action={logout} className="hidden md:block">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut data-icon="inline-start" aria-hidden className="rtl:-scale-x-100" />
                {t.nav.logout}
              </Button>
            </form>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t.nav.login}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t.nav.register}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
