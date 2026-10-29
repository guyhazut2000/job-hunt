import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { PracticeRunner } from "@/components/problem-solving/PracticeRunner";
import { Button } from "@/components/ui/button";
import { nextProblem } from "@/lib/algo/engine";
import { PROBLEM_BY_ID } from "@/lib/algo/problems";
import { practiceAttempts } from "@/lib/algo/server";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = PROBLEM_BY_ID.get((await params).id);
  return { title: p ? p.title : "Practice" };
}

export default async function PracticeProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const problem = PROBLEM_BY_ID.get((await params).id);
  if (!problem) notFound();
  const [locale, session] = await Promise.all([getLocale(), auth()]);
  const t = problemSolvingStrings(locale);
  const userId = session?.user?.id;
  const attempts = userId ? await practiceAttempts(userId) : [];
  const mine = attempts
    .filter((a) => a.problemId === problem.id)
    .slice(-5)
    .reverse();
  const next = nextProblem(attempts, new Date(), problem.id).problem.id;

  return (
    <article className="flex flex-col gap-6">
      <Link
        href="/learn/problem-solving/practice"
        className="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.backToPractice}
      </Link>
      <section aria-labelledby="statement" className="flex flex-col gap-3">
        <p className="kicker">
          {t.step1} · {t.difficulty[problem.difficulty]}
        </p>
        <h1 id="statement" dir="ltr" className="text-title text-start font-black rtl:text-end">
          {problem.title}
        </h1>
        <p className="max-w-[70ch] text-lg leading-relaxed" data-testid="statement">
          {tr(problem.statement, locale)}
        </p>
        <p className="text-muted-foreground text-sm">
          {t.constraints}:{" "}
          <span dir="ltr" className="font-mono">
            {problem.constraints}
          </span>
        </p>
      </section>
      {userId ? (
        <PracticeRunner
          key={problem.id}
          problemId={problem.id}
          nextId={next}
          locale={locale}
          t={t}
          history={mine.map((a) => ({ id: a.id, result: a.result, picked: a.picked, at: a.createdAt.toISOString() }))}
        />
      ) : (
        <aside className="bg-card flex flex-col items-start gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{t.loginToPractice}</p>
          <Button asChild className="rounded-full px-5">
            <Link href={`/login?next=/learn/problem-solving/practice/${problem.id}`}>{t.login}</Link>
          </Button>
        </aside>
      )}
    </article>
  );
}
