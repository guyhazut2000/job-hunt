import Link from "next/link";
import { ArrowLeft, CalendarClock, Check, CircleAlert, Target } from "lucide-react";
import { auth } from "@/auth";
import { PageHead } from "@/components/problem-solving/PageHead";
import { Button } from "@/components/ui/button";
import { nextProblem, patternStats, reviewSchedule } from "@/lib/algo/engine";
import { PATTERN_BY_ID } from "@/lib/algo/patterns";
import { PROBLEMS } from "@/lib/algo/problems";
import { practiceAttempts } from "@/lib/algo/server";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/learning";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice" };

const RESULT_TONE: Record<string, string> = {
  correct: "bg-fit-soft text-fit",
  partial: "bg-caution-soft text-caution",
  miss: "bg-destructive/10 text-destructive",
};

export default async function PracticePage() {
  const [locale, session] = await Promise.all([getLocale(), auth()]);
  const t = problemSolvingStrings(locale);
  const userId = session?.user?.id;
  const attempts = userId ? await practiceAttempts(userId) : [];
  const now = new Date();
  const next = nextProblem(attempts, now);
  const stats = patternStats(attempts);
  const reviews = reviewSchedule(attempts);
  const reviewBy = new Map(reviews.map((r) => [r.problemId, r]));
  const due = reviews.filter((r) => r.dueAt <= now).length;
  const graded = attempts.length;
  const overall = graded
    ? Math.round(
        (attempts.reduce((s, a) => s + (a.result === "correct" ? 1 : a.result === "partial" ? 0.5 : 0), 0) / graded) *
          100,
      )
    : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker={t.title} title={t.practiceTitle} lead={t.practiceLead} />

      {!userId ? (
        <aside className="bg-card flex flex-col items-start gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{t.loginToPractice}</p>
          <Button asChild className="rounded-full px-5">
            <Link href="/login?next=/learn/problem-solving/practice">{t.login}</Link>
          </Button>
        </aside>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Link
            href={`/learn/problem-solving/practice/${next.problem.id}`}
            className="group bg-primary text-primary-foreground flex min-h-24 flex-col justify-between gap-3 rounded-2xl p-5 shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
            data-testid="next-problem"
          >
            <span className="flex items-center gap-2 text-sm font-semibold opacity-90">
              <Target className="size-4" aria-hidden />
              {t.nextUp} · {t.nextReason[next.reason]}
            </span>
            <span className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span dir="ltr" className="text-start text-xl font-black rtl:text-end">
                  {next.problem.title}
                </span>
                <span className="text-primary-foreground/85 line-clamp-2 text-sm">
                  {tr(next.problem.statement, locale)}
                </span>
              </span>
              <ArrowLeft className="size-5 shrink-0 ltr:rotate-180" aria-hidden />
            </span>
          </Link>
          <section aria-labelledby="stats" className="bg-card flex flex-col gap-3 rounded-2xl border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="stats" className="font-bold">
                {t.statsTitle}
              </h2>
              <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                <span>{fmt(t.totalAttempts, { n: graded })}</span>
                {overall !== null && (
                  <span>
                    {t.overall}: {overall}%
                  </span>
                )}
                {due > 0 && (
                  <span className="text-caution inline-flex items-center gap-1 font-semibold">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {fmt(t.dueReviews, { n: due })}
                  </span>
                )}
              </p>
            </div>
            {stats.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.statsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="pattern-stats">
                {stats.slice(0, 8).map((s) => (
                  <li key={s.pattern} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/learn/problem-solving/patterns/${s.pattern}`}
                        dir="ltr"
                        className="font-semibold hover:underline"
                      >
                        {PATTERN_BY_ID.get(s.pattern)!.name}
                      </Link>
                      <span className="flex items-center gap-2 text-xs">
                        {s.weak && (
                          <span className="bg-caution-soft text-caution inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                            <CircleAlert className="size-3" aria-hidden />
                            {t.weak}
                          </span>
                        )}
                        <span className="text-muted-foreground tabular-nums">
                          {fmt(t.accuracy, { n: s.accuracy })} · {fmt(t.attemptsN, { n: s.attempts })}
                        </span>
                      </span>
                    </div>
                    <div className="bg-secondary h-1.5 overflow-hidden rounded-full" aria-hidden>
                      <div
                        className={cn("h-full rounded-full", s.weak ? "bg-caution" : "bg-fit")}
                        style={{ width: `${Math.max(4, s.accuracy)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section aria-labelledby="all" className="flex flex-col gap-3">
        <h2 id="all" className="text-xl font-black">
          {t.allProblems} <span className="text-muted-foreground font-mono text-sm">({PROBLEMS.length})</span>
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="problem-list">
          {PROBLEMS.map((p) => {
            const r = reviewBy.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/learn/problem-solving/practice/${p.id}`}
                  className="bg-card hover:bg-muted flex h-full flex-col gap-1.5 rounded-xl border p-3.5 transition-colors"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span dir="ltr" className="font-bold">
                      {p.title}
                    </span>
                    {r && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                          RESULT_TONE[r.lastResult],
                        )}
                      >
                        {r.lastResult === "correct" && <Check className="size-3" aria-hidden />}
                        {r.dueAt <= now ? t.due : t.lastResult[r.lastResult as "correct" | "partial" | "miss"]}
                      </span>
                    )}
                  </span>
                  <span className="text-foreground/75 line-clamp-2 text-sm">{tr(p.statement, locale)}</span>
                  <span className="text-muted-foreground text-xs">{t.difficulty[p.difficulty]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
