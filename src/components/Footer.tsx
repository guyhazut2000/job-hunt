import Link from "next/link";
import { getDictionary } from "@/lib/i18n";

export async function Footer() {
  const { t } = await getDictionary();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500">
        <span>
          © {new Date().getFullYear()} {t.brand}. {t.footer.rights}
        </span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-slate-800">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="hover:text-slate-800">
            {t.footer.terms}
          </Link>
        </div>
      </div>
    </footer>
  );
}
