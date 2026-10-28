"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleHelp, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { reviewAnswer } from "@/app/learn/hub-actions";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/i18n/learning";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import { ANSWER_MIN, type FeedbackKind, type StoredFeedback } from "@/lib/learning/feedback";
import type { Stage } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

const VERDICT_TONE: Record<string, string> = {
  strong: "bg-fit-soft text-fit border-fit/30",
  partial: "bg-caution-soft text-caution border-caution/30",
  weak: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Ask for feedback on an answer and keep the latest result. */
export function useAnswerFeedback(opts: {
  skill: string;
  stage: Stage;
  kind: FeedbackKind;
  itemId: string;
  initial?: StoredFeedback;
  t: LearningHubStrings;
}) {
  const [result, setResult] = useState<StoredFeedback | undefined>(opts.initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const check = (answer: string, after?: (r: StoredFeedback) => void) => {
    const text = answer.trim();
    if (text.length < ANSWER_MIN) return setError(fmt(opts.t.fbTooShort, { n: ANSWER_MIN }));
    setError(null);
    start(async () => {
      try {
        const r = await reviewAnswer({
          skill: opts.skill,
          stage: opts.stage,
          kind: opts.kind,
          itemId: opts.itemId,
          answer: text,
        });
        if (!r.ok)
          return setError(r.error === "too_short" ? fmt(opts.t.fbTooShort, { n: ANSWER_MIN }) : opts.t.fbError);
        const next = { answer: text, feedback: r.feedback, source: r.source };
        setResult(next);
        after?.(next);
      } catch {
        setError(opts.t.fbError);
      }
    });
  };
  return { result, error, pending, check };
}

export function FeedbackButton({
  pending,
  hasResult,
  onClick,
  t,
  className,
}: {
  pending: boolean;
  hasResult: boolean;
  onClick: () => void;
  t: LearningHubStrings;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={cn("min-h-11 rounded-full", className)}
      disabled={pending}
      onClick={onClick}
    >
      <Wand2 className={cn("size-4", pending && "motion-safe:animate-pulse")} aria-hidden />
      {pending ? t.fbChecking : hasResult ? t.fbRecheck : t.fbCheck}
    </Button>
  );
}

/** The feedback card: verdict + score, summary, strengths, improvements and a follow-up question. */
export function AnswerFeedbackPanel({
  result,
  t,
  onFollowUp,
}: {
  result: StoredFeedback;
  t: LearningHubStrings;
  onFollowUp?: (text: string) => void;
}) {
  const { feedback: fb, source } = result;
  const sourceLabel = source === "ai" ? t.fbSourceAi : source === "limited" ? t.fbSourceLimited : t.fbSourceOffline;
  return (
    <section
      aria-label={t.fbTitle}
      className="bg-background/60 flex flex-col gap-3 rounded-xl border p-3.5 sm:p-4"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="text-primary size-4" aria-hidden />
          {t.fbTitle}
        </h4>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            VERDICT_TONE[fb.verdict],
          )}
        >
          {t.fbVerdict[fb.verdict]}
          <span dir="ltr" className="font-mono tabular-nums">
            {fmt(t.fbScore, { n: fb.score })}
          </span>
        </span>
      </div>
      <div
        className="bg-secondary h-1.5 overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fb.score}
        aria-label={t.fbTitle}
      >
        <div
          className={cn(
            "h-full rounded-full",
            fb.verdict === "strong" ? "bg-fit" : fb.verdict === "partial" ? "bg-caution" : "bg-destructive",
          )}
          style={{ width: `${Math.max(4, fb.score)}%` }}
        />
      </div>
      <p dir="auto" className="text-[0.95rem] leading-relaxed [overflow-wrap:anywhere]">
        {fb.summary}
      </p>
      {fb.strengths.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h5 className="kicker text-fit">{t.fbStrengths}</h5>
          <ul className="flex flex-col gap-1">
            {fb.strengths.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <CircleCheck className="text-fit mt-0.5 size-4 shrink-0" aria-hidden />
                <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">
                  {x}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fb.improvements.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h5 className="kicker text-caution">{t.fbImprove}</h5>
          <ul className="flex flex-col gap-1">
            {fb.improvements.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <TrendingUp className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
                <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">
                  {x}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fb.followUp && (
        <div className="bg-accent/50 flex flex-col gap-2 rounded-lg p-3">
          <h5 className="kicker">{t.fbFollowUp}</h5>
          <p dir="auto" className="flex items-start gap-2 text-sm leading-relaxed">
            <CircleHelp className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{fb.followUp}</span>
          </p>
          {onFollowUp && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-10 self-start rounded-full"
              onClick={() => onFollowUp(fb.followUp)}
            >
              {t.fbAskTutor}
            </Button>
          )}
        </div>
      )}
      <p className="text-muted-foreground text-[0.7rem]">{sourceLabel}</p>
    </section>
  );
}
