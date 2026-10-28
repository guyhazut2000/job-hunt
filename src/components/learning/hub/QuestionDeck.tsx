"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { rateQuestion } from "@/app/learn/hub-actions";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/i18n/learning";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import type { Question } from "@/lib/learning/content";
import type { Rating } from "@/lib/learning/progress";
import type { Stage } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

export interface PriorRating {
  rating: Rating;
  dueAt: string;
}

function whenLabel(dueAt: string, t: LearningHubStrings): string {
  const days = Math.round((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  const when = days <= 0 ? t.now : days === 1 ? t.tomorrow : fmt(t.inDays, { n: days });
  return fmt(t.nextReviewIn, { when });
}

const RATINGS: { r: Rating; key: "rateKnew" | "ratePartly" | "rateMissed"; tone: string }[] = [
  { r: "KNEW", key: "rateKnew", tone: "border-fit/40 text-fit hover:bg-fit-soft data-[on=true]:bg-fit-soft" },
  {
    r: "PARTLY",
    key: "ratePartly",
    tone: "border-caution/40 text-caution hover:bg-caution-soft data-[on=true]:bg-caution-soft",
  },
  {
    r: "MISSED",
    key: "rateMissed",
    tone: "border-destructive/40 text-destructive hover:bg-destructive/10 data-[on=true]:bg-destructive/10",
  },
];

function QuestionCard({
  q,
  n,
  skill,
  stage,
  prior,
  loggedIn,
  t,
  onRated,
}: {
  q: Question & { id: string };
  n: number;
  skill: string;
  stage: Stage;
  prior?: PriorRating;
  loggedIn: boolean;
  t: LearningHubStrings;
  onRated: (first: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rated, setRated] = useState<PriorRating | undefined>(prior);
  const [pending, start] = useTransition();
  const answerId = `${q.id}-answer`;

  const rate = (rating: Rating) =>
    start(async () => {
      const r = await rateQuestion({ skill, stage, questionId: q.id, question: q.q, answer: q.a, rating });
      if (r.ok && r.dueAt) {
        onRated(!rated);
        setRated({ rating, dueAt: r.dueAt });
      }
    });

  return (
    <li className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p dir="auto" className="min-w-0 leading-relaxed font-semibold [overflow-wrap:anywhere]">
          <span className="text-muted-foreground me-1.5 font-mono text-sm">{n}.</span>
          {q.q}
        </p>
        <span className="bg-secondary text-foreground/75 shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
          {t.kinds[q.kind]}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full rounded-full sm:w-fit"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen(!open)}
      >
        {open ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        {open ? t.hide : t.reveal}
      </Button>
      <div id={answerId} hidden={!open} className="flex flex-col gap-3">
        <p
          dir="auto"
          className="bg-accent/50 rounded-lg p-3 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-line"
        >
          {q.a}
        </p>
        {loggedIn && (
          <div className="flex flex-col gap-2">
            <div role="group" aria-label={t.reveal} className="grid grid-cols-3 gap-2">
              {RATINGS.map(({ r, key, tone }) => (
                <button
                  key={r}
                  type="button"
                  disabled={pending}
                  data-on={rated?.rating === r}
                  aria-pressed={rated?.rating === r}
                  onClick={() => rate(r)}
                  className={cn(
                    "min-h-11 rounded-full border px-2 text-sm font-semibold transition-colors disabled:opacity-60",
                    tone,
                  )}
                >
                  {t[key]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-muted-foreground text-xs empty:hidden">
        {rated && `${t.rated[rated.rating]} · ${whenLabel(rated.dueAt, t)}`}
      </p>
    </li>
  );
}

export function QuestionDeck({
  questions,
  skill,
  stage,
  priors,
  loggedIn,
  t,
}: {
  questions: (Question & { id: string })[];
  skill: string;
  stage: Stage;
  priors: Record<string, PriorRating>;
  loggedIn: boolean;
  t: LearningHubStrings;
}) {
  const [ratedCount, setRatedCount] = useState(() => questions.filter((q) => priors[q.id]).length);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">{t.qaLead}</p>
      {loggedIn && (
        <p className="text-sm font-semibold">{fmt(t.qaProgress, { n: ratedCount, total: questions.length })}</p>
      )}
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            n={i + 1}
            skill={skill}
            stage={stage}
            prior={priors[q.id]}
            loggedIn={loggedIn}
            t={t}
            onRated={(first) => first && setRatedCount((c) => c + 1)}
          />
        ))}
      </ol>
    </div>
  );
}
