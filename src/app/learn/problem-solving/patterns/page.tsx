import Link from "next/link";
import { PageHead } from "@/components/problem-solving/PageHead";
import { PATTERNS } from "@/lib/algo/patterns";
import { PROBLEMS } from "@/lib/algo/problems";
import { FAMILIES, tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { localizedTitle } from "@/lib/i18n/titles";

export const generateMetadata = localizedTitle("psPatterns");

export default async function PatternsPage() {
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker={t.title} title={t.patternsTitle} lead={t.patternsLead} />
      {FAMILIES.map((f) => {
        const list = PATTERNS.filter((p) => p.family === f);
        if (!list.length) return null;
        return (
          <section key={f} aria-labelledby={`fam-${f}`} className="flex flex-col gap-3">
            <h2 id={`fam-${f}`} className="kicker">
              {t.family[f]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/learn/problem-solving/patterns/${p.id}`}
                    className="bg-card hover:bg-muted flex h-full flex-col gap-2 rounded-xl border p-4 transition-colors"
                    data-testid="pattern-card"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span dir="ltr" className="font-bold">
                        {p.name}
                      </span>
                      <span dir="ltr" className="text-muted-foreground font-mono text-xs">
                        {p.time}
                      </span>
                    </span>
                    <span className="text-foreground/80 text-sm leading-relaxed">{tr(p.summary, locale)}</span>
                    <span className="text-muted-foreground mt-auto text-xs">
                      {t.signals}: {tr(p.signals[0], locale)}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {PROBLEMS.filter((x) => x.patterns.includes(p.id)).length} · {t.examples}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
