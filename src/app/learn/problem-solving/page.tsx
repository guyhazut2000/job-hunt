import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ComplexityTable } from "@/components/problem-solving/ComplexityTable";
import { DecisionGuide } from "@/components/problem-solving/DecisionGuide";
import { PageHead } from "@/components/problem-solving/PageHead";
import { cleanAnswers } from "@/lib/algo/checklist";
import { DATA_STRUCTURES } from "@/lib/algo/data-structures";
import { PATTERNS } from "@/lib/algo/patterns";
import { PROBLEMS } from "@/lib/algo/problems";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { localizedTitle } from "@/lib/i18n/titles";

export const generateMetadata = localizedTitle("problemSolving");

export default async function ProblemSolvingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  const initial = cleanAnswers(await searchParams);
  const base = "/learn/problem-solving";
  const cards = [
    { href: `${base}/practice`, title: t.sections.practice, n: PROBLEMS.length },
    { href: `${base}/patterns`, title: t.sections.patterns, n: PATTERNS.length },
    { href: `${base}/data-structures`, title: t.sections.structures, n: DATA_STRUCTURES.length },
    { href: `${base}/analyze`, title: t.sections.analyze, n: null },
  ];
  return (
    <div className="flex flex-col gap-10">
      <PageHead kicker={t.kicker} title={t.title} lead={t.lead}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="bg-card hover:bg-muted flex min-h-16 items-center justify-between gap-2 rounded-xl border px-3.5 py-3 transition-colors"
              >
                <span className="flex flex-col">
                  <span className="font-bold">{c.title}</span>
                  {c.n !== null && <span className="text-muted-foreground font-mono text-xs tabular-nums">{c.n}</span>}
                </span>
                <ArrowLeft className="size-4 shrink-0 ltr:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </PageHead>
      <section aria-labelledby="guide" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="guide" className="text-2xl font-black">
            {t.guideTitle}
          </h2>
          <p className="text-foreground/75 text-sm leading-relaxed">{t.guideLead}</p>
        </div>
        <DecisionGuide key={JSON.stringify(initial)} locale={locale} t={t} initial={initial} />
      </section>
      <section aria-labelledby="complexity" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="complexity" className="text-2xl font-black">
            {t.complexityTitle}
          </h2>
          <p className="text-foreground/75 text-sm">{t.complexityLead}</p>
        </div>
        <ComplexityTable locale={locale} t={t} />
      </section>
    </div>
  );
}
