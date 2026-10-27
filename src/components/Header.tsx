import Link from "next/link";
import { logout, setLocale } from "@/app/actions";
import { auth } from "@/auth";
import { getDictionary } from "@/lib/i18n";

export async function Header() {
  const [{ t, locale }, session] = await Promise.all([getDictionary(), auth()]);
  const user = session?.user;
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-brand-600 text-lg font-bold">
          {t.brand}
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-4 text-sm text-slate-700">
          <Link href="/jobs" className="hover:text-brand-600">
            {t.nav.jobs}
          </Link>
          <Link href="/companies" className="hover:text-brand-600">
            {t.nav.companies}
          </Link>
          {user && (
            <Link href="/dashboard" className="hover:text-brand-600">
              {t.nav.dashboard}
            </Link>
          )}
          {user && (
            <Link href="/profile" className="hover:text-brand-600">
              {t.nav.profile}
            </Link>
          )}
          <Link href="/pricing" className="hover:text-brand-600">
            {t.nav.pricing}
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-brand-600">
              {t.nav.admin}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <form action={setLocale}>
            <input type="hidden" name="locale" value={locale === "he" ? "en" : "he"} />
            <button className="btn-ghost px-3 py-1.5" type="submit">
              {t.nav.language}
            </button>
          </form>
          {user ? (
            <form action={logout}>
              <button className="btn-ghost px-3 py-1.5" type="submit">
                {t.nav.logout}
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-3 py-1.5">
                {t.nav.login}
              </Link>
              <Link href="/register" className="btn-primary px-3 py-1.5">
                {t.nav.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
