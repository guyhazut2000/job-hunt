import Link from "next/link";
import { ExternalLink, UsersRound } from "lucide-react";
import { ShowMoreList } from "@/components/density/ShowMoreList";
import { ManagerAnswerCard } from "@/components/manager/ManagerAnswerCard";
import { CopyButton } from "@/components/outreach/CopyButton";
import { loadCvSource } from "@/lib/cv-templates/server";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { densityStrings } from "@/lib/i18n/density";
import { fillM, managerStrings } from "@/lib/i18n/manager";
import { localizedTitle } from "@/lib/i18n/titles";
import { ASK_MANAGER, MANAGER_SOURCES, QUESTIONS, type Level } from "@/lib/manager/bank";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("prepManager");

const LEVELS = ["all", "senior", "staff"] as const;
const RANK: Record<Level, number> = { all: 0, senior: 1, staff: 2 };

/** Hiring-manager round (#119): question bank, STAR builder with seniority signals, questions to ask back. */
export default async function ManagerPrepPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const user = await requireUser("/prep/manager");
  const locale = await getLocale();
  const lang = locale === "en" ? "en" : "he";
  const s = managerStrings(locale);
  const sp = await searchParams;
  const level = (LEVELS as readonly string[]).includes(sp.level ?? "") ? (sp.level as Level) : "all";
  const [answers, cv] = await Promise.all([
    db.managerAnswer.findMany({ where: { userId: user.id } }),
    loadCvSource(user.id),
  ]);
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  // "Senior" shows questions for every level up to senior; "Staff+" adds the staff questions.
  const list = level === "all" ? QUESTIONS : QUESTIONS.filter((q) => RANK[q.level] <= RANK[level]);
  const answered = QUESTIONS.filter((q) => byQ.has(q.id)).length;
  const roles = cv.content.experience.filter((e) => e.title || e.org).slice(0, 6);

  return (
    <div className="flex flex-col gap-6" data-testid="manager-page">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{s.kicker}</p>
        <h1 className="font-heading text-title flex items-center gap-2 font-black">
          <UsersRound className="text-primary size-7 shrink-0" aria-hidden />
          {s.title}
        </h1>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">{s.lead}</p>
        <p className="text-muted-foreground text-xs">{s.notCompany}</p>
        <p className="text-sm font-semibold" data-testid="mgr-progress">
          {fillM(s.answered, { n: answered, total: QUESTIONS.length })}
        </p>
      </header>

      {roles.length > 0 && (
        <section className="bg-card flex flex-col gap-2 rounded-xl border p-4" data-testid="mgr-experience">
          <h2 className="text-sm font-bold">{s.yourExperience}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {roles.map((r, i) => (
              <li key={i} className="bg-muted rounded-full px-2.5 py-0.5 text-xs">
                <bdi>{[r.title, r.org].filter(Boolean).join(" · ")}</bdi>
              </li>
            ))}
          </ul>
          <Link href="/learn/problem-solving/stories" className="w-fit text-sm underline underline-offset-2">
            {s.storiesLink}
          </Link>
        </section>
      )}

      <nav aria-label={s.levelFilter} className="flex flex-wrap gap-2" data-testid="mgr-levels">
        {LEVELS.map((l) => (
          <Link
            key={l}
            href={l === "all" ? "/prep/manager" : `/prep/manager?level=${l}`}
            aria-current={l === level ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold",
              l === level ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {s.levels[l]}
          </Link>
        ))}
      </nav>

      <ShowMoreList
        key={level}
        initial={6}
        step={6}
        s={densityStrings(locale)}
        testId="mgr-questions"
        label={s.title}
        className="flex flex-col gap-3"
        anchorIds={list.map((q) => q.id)}
      >
        {list.map((q) => {
          const a = byQ.get(q.id);
          const src = MANAGER_SOURCES[q.source];
          return (
            <li key={q.id} id={q.id} className="bg-card min-w-0 rounded-xl border">
              <details className="group p-4" data-testid={`mgr-q-${q.id}`}>
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold" dir="auto">
                    {q.q[lang]}
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    {a && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        ✓
                      </span>
                    )}
                    {q.level !== "all" && (
                      <span className="bg-muted rounded-full px-2 py-0.5 text-xs">{s.levels[q.level]}</span>
                    )}
                  </span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-sm">
                    <span className="font-semibold">{s.probes}: </span>
                    {q.probes[lang]}
                  </p>
                  <ManagerAnswerCard
                    questionId={q.id}
                    signals={q.signals}
                    s={s}
                    lang={lang}
                    initial={
                      a
                        ? {
                            questionId: a.questionId,
                            situation: a.situation,
                            task: a.task,
                            action: a.action,
                            result: a.result,
                            polished: a.polishedLang === lang ? a.polished : null,
                            polishedSource: a.polishedSource,
                          }
                        : null
                    }
                  />
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground inline-flex w-fit items-center gap-1 text-xs underline underline-offset-2"
                  >
                    {s.source}: <bdi dir="ltr">{src.label}</bdi>
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
              </details>
            </li>
          );
        })}
      </ShowMoreList>

      <section className="bg-card flex flex-col gap-3 rounded-xl border p-4" data-testid="mgr-ask">
        <h2 className="font-heading text-lg font-bold">{s.ask}</h2>
        <p className="text-muted-foreground -mt-1 text-sm">{s.askLead}</p>
        {ASK_MANAGER.map((g) => (
          <div key={g.group.en}>
            <h3 className="text-sm font-bold">{g.group[lang]}</h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              {g.questions.map((qq) => (
                <li key={qq} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <bdi dir="ltr" className="min-w-0 flex-1 break-words">
                    {qq}
                  </bdi>
                  <CopyButton text={qq} label={s.copy} copiedLabel={s.copied} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <footer className="flex flex-col gap-2 border-t pt-4 text-sm">
        <h2 className="font-bold">{s.sources}</h2>
        <ul className="flex flex-col gap-1">
          {Object.values(MANAGER_SOURCES).map((src) => (
            <li key={src.id}>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                <bdi dir="ltr">{src.label}</bdi>
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <h2 className="mt-2 font-bold">{s.related}</h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/interview" className="underline underline-offset-2">
            {s.relInterview}
          </Link>
          <Link href="/learn/problem-solving/stories" className="underline underline-offset-2">
            {s.storiesLink}
          </Link>
        </p>
      </footer>
    </div>
  );
}
