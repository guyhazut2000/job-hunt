import { PsNav } from "@/components/problem-solving/PsNav";
import { getLocale } from "@/lib/i18n";
import { systemDesignStrings } from "@/lib/i18n/system-design";

export default async function SystemDesignLayout({ children }: { children: React.ReactNode }) {
  const t = systemDesignStrings(await getLocale());
  const base = "/learn/system-design";
  const items = [
    { href: base, label: t.sections.method },
    { href: `${base}/questions`, label: t.sections.questions },
    { href: `${base}/ai`, label: t.sections.ai },
  ];
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PsNav items={items} label={t.nav} root={base} />
      {children}
      <p data-print-hide className="text-muted-foreground border-t pt-4 text-xs">
        {t.copyright}
      </p>
    </div>
  );
}
