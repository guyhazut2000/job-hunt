import { ArrowLeft, ListChecks, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { StartForm } from "@/components/interview/StartForm";
import { aiRemaining } from "@/lib/ai/remaining";
import { db } from "@/lib/db";
import { isStageKind, STAGE_LABELS } from "@/lib/hiring/kinds";
import { getLocale } from "@/lib/i18n";
import { interviewStrings } from "@/lib/i18n/interview";
import { fmt } from "@/lib/i18n/learning";
import { loadInterviewTarget } from "@/lib/interview/server";
import { isMode } from "@/lib/interview/types";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("interview");

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; app?: string; mode?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = interviewStrings(locale);
  const { job, app, mode } = await searchParams;
  const preset = job || app ? await loadInterviewTarget(user.id, { jobId: job, applicationId: app }) : null;
  const [sessions, apps, remaining] = await Promise.all([
    db.interviewSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, company: true, mode: true, status: true, score: true, createdAt: true },
    }),
    preset
      ? []
      : db.application.findMany({
          where: { userId: user.id, status: { notIn: ["REJECTED"] } },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: { id: true, title: true, company: true },
        }),
    aiRemaining(user.id),
  ]);
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="rule-double flex flex-col gap-1 pb-4">
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.title}</h1>
        <p className="text-muted-foreground max-w-[65ch]">{t.lead}</p>
      </header>

      <section className="flex flex-col gap-4" data-testid="interview-new">
        <h2 className="font-heading text-xl font-bold">{t.newSession}</h2>
        {(job || app) && !preset ? (
          <p className="text-muted-foreground">{t.notFound}</p>
        ) : preset ? (
          <div className="flex flex-col gap-4">
            <div className="border-rule flex flex-col gap-3 rounded-xl border p-4" data-testid="interview-context">
              <p className="text-lg font-semibold" dir="auto">
                {fmt(t.forJob, { title: preset.ctx.title, company: preset.ctx.company })}
              </p>
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <ListChecks className="size-4" aria-hidden />
                  {fmt(t.hiring, { company: preset.ctx.company })}
                </p>
                {preset.ctx.stages.length ? (
                  <ol className="flex flex-wrap gap-1.5 text-xs" data-testid="interview-stages">
                    {preset.ctx.stages.map((s, i) => (
                      <li key={i} className="bg-muted rounded-full px-2.5 py-1" dir="auto">
                        {i + 1}. {isStageKind(s.kind) ? STAGE_LABELS[locale][s.kind] : s.title}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground text-xs">{t.hiringNone}</p>
                )}
              </div>
              {preset.ctx.concepts.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold">{t.concepts}</p>
                  <ul className="flex flex-wrap gap-1.5 text-xs">
                    {preset.ctx.concepts.map((c) => (
                      <li key={c} className="bg-primary/10 rounded-full px-2.5 py-1">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preset.jobId && (
                <Link
                  href={`/jobs/${preset.jobId}`}
                  className="text-primary inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold"
                >
                  <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
                  {t.backToJob}
                </Link>
              )}
            </div>
            <StartForm
              preset={{ job: preset.jobId, app: preset.applicationId }}
              defaultMode={isMode(mode) ? mode : "HR"}
              defaultLang={locale}
              t={t}
            />
          </div>
        ) : apps.length ? (
          <StartForm
            targets={apps.map((a) => ({ value: `app:${a.id}`, label: `${a.title} · ${a.company}` }))}
            defaultMode={isMode(mode) ? mode : "HR"}
            defaultLang={locale}
            t={t}
          />
        ) : (
          <p className="text-muted-foreground">{t.noTargets}</p>
        )}
        <p className="text-muted-foreground text-xs" data-testid="interview-remaining">
          {remaining === null ? t.aiOff : fmt(t.remaining, { n: remaining })}
        </p>
      </section>

      <section className="flex flex-col gap-3" data-testid="interview-history">
        <h2 className="font-heading text-xl font-bold">{t.history}</h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">{t.noHistory}</p>
        ) : (
          <ul className="divide-rule flex flex-col divide-y">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/interview/${s.id}`}
                  className="hover:bg-muted/50 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2"
                  data-testid="interview-history-item"
                >
                  <MessagesSquare className="text-muted-foreground size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold" dir="auto">
                      {s.title} · {s.company}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t.modes[isMode(s.mode) ? s.mode : "HR"].name} · {dateFmt.format(s.createdAt)} ·{" "}
                      {t.status[s.status] ?? s.status}
                    </span>
                  </span>
                  {s.score !== null ? (
                    <span className="font-bold tabular-nums">{fmt(t.scoreOf, { n: s.score })}</span>
                  ) : (
                    <span className="text-primary text-sm font-semibold">
                      {s.status === "done" ? t.view : t.continue}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
