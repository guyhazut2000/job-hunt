import Link from "next/link";
import type { Candidate } from "@/lib/algo/engine";
import { PATTERN_BY_ID } from "@/lib/algo/patterns";
import { tr } from "@/lib/algo/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";

/** Ranked candidate patterns with the reasons that moved them. */
export function CandidateList({
  candidates,
  locale,
  t,
}: {
  candidates: Candidate[];
  locale: Locale;
  t: ProblemSolvingStrings;
}) {
  if (!candidates.length) return <p className="text-muted-foreground text-sm">{t.candidatesEmpty}</p>;
  return (
    <ol className="flex flex-col gap-2.5" data-testid="candidates">
      {candidates.map((c, i) => {
        const p = PATTERN_BY_ID.get(c.pattern)!;
        return (
          <li key={c.pattern} className="bg-background/60 flex flex-col gap-1.5 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/learn/problem-solving/patterns/${p.id}`}
                className="font-bold underline-offset-4 hover:underline"
                dir="ltr"
              >
                <span className="text-muted-foreground me-1.5 font-mono text-sm">{i + 1}.</span>
                {p.name}
              </Link>
              <span dir="ltr" className="text-muted-foreground font-mono text-xs">
                {p.time}
              </span>
            </div>
            <div className="bg-secondary h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(6, c.strength)}%` }} />
            </div>
            <p className="text-foreground/80 text-sm leading-relaxed">{tr(p.summary, locale)}</p>
            {c.reasons.length > 0 && (
              <ul className="text-muted-foreground flex list-disc flex-col gap-0.5 ps-5 text-xs leading-relaxed">
                {[...new Set(c.reasons)].slice(0, 4).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
