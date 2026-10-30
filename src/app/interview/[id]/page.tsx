import { ArrowLeft, Brain, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteInterviewAction } from "@/app/interview/actions";
import { FeedbackView } from "@/components/interview/FeedbackView";
import { InterviewChat, type ChatMessage } from "@/components/interview/InterviewChat";
import { StartForm } from "@/components/interview/StartForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AiLimitReason } from "@/lib/ai/errors";
import { aiRemaining } from "@/lib/ai/remaining";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { getLocale } from "@/lib/i18n";
import { interviewStrings } from "@/lib/i18n/interview";
import { fmt } from "@/lib/i18n/learning";
import { loadSession, readFeedback, readPlan } from "@/lib/interview/server";
import { isMode } from "@/lib/interview/types";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/i18n/titles";

const LIMITS: AiLimitReason[] = ["user_daily", "global_daily", "global_minute", "provider_quota"];

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("interview");

export default async function InterviewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/interview/${id}`);
  const locale = await getLocale();
  const t = interviewStrings(locale);
  const sp = await searchParams;
  const limit = LIMITS.find((l) => l === sp.limit);
  const [s, remaining] = await Promise.all([loadSession(user.id, id), aiRemaining(user.id)]);
  if (!s) notFound();
  const plan = readPlan(s.plan);
  const feedback = readFeedback(s.feedback);
  const mode = isMode(s.mode) ? s.mode : "HR";
  const lang = s.language === "en" ? "en" : "he";
  const messages: ChatMessage[] = s.messages.map((m) => ({
    id: m.id,
    role: m.role as ChatMessage["role"],
    kind: m.kind as ChatMessage["kind"],
    content: m.content,
    questionIndex: m.questionIndex,
  }));
  const done = s.status === "done";
  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{t.title}</p>
        <h1 className="font-heading text-title font-black" dir="auto">
          {fmt(t.forJob, { title: s.title, company: s.company })}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{t.modes[mode].name}</Badge>
          <Badge variant="outline" data-testid="interview-source">
            {t.source[s.source] ?? s.source}
          </Badge>
          <Badge variant="outline">{lang === "he" ? t.langHe : t.langEn}</Badge>
          <span className="text-muted-foreground">{t.status[s.status] ?? s.status}</span>
        </div>
        {limit && (
          <p role="status" className="bg-caution-soft rounded-lg px-3 py-2 text-sm">
            {aiLimitMessage(limit, locale)}
          </p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {done && feedback ? (
            <>
              <FeedbackView
                feedback={feedback}
                plan={plan}
                score={s.score}
                source={s.feedbackSource ?? "offline"}
                t={t}
              />
              <details className="border-rule rounded-xl border p-3" data-testid="interview-transcript">
                <summary className="min-h-11 cursor-pointer content-center font-semibold">{t.transcript}</summary>
                <ol className="mt-3 flex flex-col gap-2 text-sm">
                  {messages.map((m) => (
                    <li key={m.id} className={m.role === "candidate" ? "ps-4" : "font-semibold"} dir="auto">
                      <span className="text-muted-foreground text-xs">
                        {m.role === "candidate" ? t.you : t.interviewer}:{" "}
                      </span>
                      <span className="whitespace-pre-line">{m.kind === "skip" ? t.skipped : m.content}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <InterviewChat
              id={s.id}
              messages={messages}
              total={plan.length}
              questionIndex={s.questionIndex}
              focus={plan[s.questionIndex]?.focus ?? ""}
              lang={lang}
              t={t}
            />
          )}
        </div>

        <aside className="flex flex-col gap-5" data-print-hide>
          <p className="text-muted-foreground text-xs" data-testid="interview-remaining">
            {remaining === null ? t.aiOff : fmt(t.remaining, { n: remaining })}
          </p>
          {mode === "PROBLEM" && (
            <Link
              href="/learn/problem-solving"
              className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
            >
              <Brain className="size-4" aria-hidden />
              {t.problemLink}
            </Link>
          )}
          {done && (s.jobId || s.applicationId) && (
            <div className="flex flex-col gap-2" data-testid="interview-again">
              <p className="text-sm font-semibold">{t.again}</p>
              <StartForm
                preset={{ job: s.jobId, app: s.applicationId }}
                defaultMode={mode}
                defaultLang={lang}
                compact
                t={t}
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            {s.jobId && (
              <Link
                href={`/jobs/${s.jobId}`}
                className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
              >
                <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
                {t.backToJob}
              </Link>
            )}
            <Link
              href="/interview"
              className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
              {t.backToList}
            </Link>
          </div>
          <form action={deleteInterviewAction}>
            <input type="hidden" name="id" value={s.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-destructive min-h-11"
              data-testid="interview-delete"
            >
              <Trash2 className="size-4" aria-hidden />
              {t.delete}
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
