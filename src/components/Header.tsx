import Link from "next/link";
import { Languages, LogOut } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";

export async function Header() {
  const [{ t, locale }, session] = await Promise.all([getDictionary(), auth()]);
  const user = session?.user;
  const links = [
    { href: "/jobs", label: t.nav.jobs },
    { href: "/companies", label: t.nav.companies },
    ...(user
      ? [
          { href: "/dashboard", label: t.nav.dashboard },
          { href: "/profile", label: t.nav.profile },
        ]
      : []),
    { href: "/pricing", label: t.nav.pricing },
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];
  return (
    <header className="bg-background/92 rule-double sticky top-0 z-40 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Brand tagline={t.ui.kicker} />
        <nav aria-label="main" className="ms-4 hidden flex-1 md:block">
          <NavLinks links={links} />
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
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
