import Link from "next/link";
import { Languages, LogOut } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { navigationStrings } from "@/lib/i18n/navigation";
import { db } from "@/lib/db";
import { notificationStrings } from "@/lib/i18n/notifications";
import { navRole } from "@/lib/nav/config";
import { NotificationBell } from "./notifications/NotificationBell";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";

export async function Header() {
  const [{ t, locale }, session] = await Promise.all([getDictionary(), auth()]);
  const user = session?.user;
  const ns = notificationStrings(locale);
  const nav = navigationStrings(locale);
  const unread = user?.id
    ? await db.notification.count({ where: { userId: user.id, readAt: null } }).catch(() => 0)
    : 0;
  const role = navRole(user ? { role: user.role } : null);
  return (
    <header className="bg-background/92 rule-double sticky top-0 z-40 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:px-6 lg:gap-4">
        <Brand tagline={user ? undefined : t.ui.kicker} />
        <nav aria-label={nav.main} className="hidden min-w-0 flex-1 md:ms-2 md:block lg:ms-4">
          <NavLinks locale={locale} role={role} moreLabel={t.ui.more} />
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          {user && (
            <NotificationBell
              initialUnread={unread}
              locale={locale}
              labels={{
                bell: ns.bell,
                bellUnread: ns.bellUnread,
                viewAll: ns.viewAll,
                markAllRead: ns.markAllRead,
                emptyShort: ns.emptyShort,
                settings: ns.settings,
                unread: ns.unread,
              }}
            />
          )}
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
