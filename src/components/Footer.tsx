import Link from "next/link";
import { getDictionary } from "@/lib/i18n";

export async function Footer() {
  const { t } = await getDictionary();
  return (
    <footer className="border-foreground/80 mb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] border-t-2 md:mb-0">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm md:px-6">
        <span>
          © {new Date().getFullYear()} <span dir="ltr">{t.brand}</span> · {t.ui.sources}
        </span>
        <div className="flex gap-1">
          <Link href="/privacy" className="hover:text-foreground inline-flex min-h-11 items-center px-2">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="hover:text-foreground inline-flex min-h-11 items-center px-2">
            {t.footer.terms}
          </Link>
        </div>
      </div>
    </footer>
  );
}
