import Link from "next/link";
import { ArrowLeft, CalendarClock, Puzzle } from "lucide-react";
import { patternStats, reviewSchedule } from "@/lib/algo/engine";
import { patternName } from "@/lib/algo/patterns";
import { practiceAttempts } from "@/lib/algo/server";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/learning";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";

/** /learn/me: weak patterns and due problem reviews from the problem-solving practice. */
export async function ProblemSolvingCard({ userId, locale }: { userId: string; locale: Locale }) {
  const t = problemSolvingStrings(locale);
  const attempts = await practiceAttempts(userId);
  const now = new Date();
  const weak = patternStats(attempts)
    .filter((s) => s.weak)
    .slice(0, 4);
  const due = reviewSchedule(attempts).filter((r) => r.dueAt <= now).length;
  return (
    <section
      aria-labelledby="ps-card"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
      data-testid="ps-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="ps-card" className="inline-flex items-center gap-1.5 font-bold">
          <Puzzle className="text-primary size-4" aria-hidden />
          {t.meCardTitle}
        </h2>
        {due > 0 && (
          <span className="bg-caution-soft text-caution inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
            <CalendarClock className="size-3" aria-hidden />
            {fmt(t.dueReviews, { n: due })}
          </span>
        )}
      </div>
      {attempts.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.meNoAttempts}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">{fmt(t.totalAttempts, { n: attempts.length })}</p>
          {weak.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="kicker">{t.meWeak}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {weak.map((s) => (
                  <li key={s.pattern}>
                    <Link
                      href={`/learn/problem-solving/patterns/${s.pattern}`}
                      dir="ltr"
                      className="bg-caution-soft text-caution inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-semibold"
                    >
                      {patternName(s.pattern)} · {s.accuracy}%
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <Link
        href="/learn/problem-solving/practice"
        className="text-primary inline-flex items-center gap-1 text-sm font-semibold"
      >
        {t.meGo}
        <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
      </Link>
    </section>
  );
}
