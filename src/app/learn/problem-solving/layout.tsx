import { PsNav } from "@/components/problem-solving/PsNav";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";

export default async function ProblemSolvingLayout({ children }: { children: React.ReactNode }) {
  const t = problemSolvingStrings(await getLocale());
  const base = "/learn/problem-solving";
  const items = [
    { href: base, label: t.sections.guide },
    { href: `${base}/practice`, label: t.sections.practice },
    { href: `${base}/patterns`, label: t.sections.patterns },
    { href: `${base}/data-structures`, label: t.sections.structures },
    { href: `${base}/interview`, label: t.sections.interview },
    { href: `${base}/analyze`, label: t.sections.analyze },
    { href: `${base}/checklist`, label: t.sections.checklist },
  ];
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PsNav items={items} label={t.nav} />
      {children}
      <p data-print-hide className="text-muted-foreground border-t pt-4 text-xs">
        {t.copyright}
      </p>
    </div>
  );
}
