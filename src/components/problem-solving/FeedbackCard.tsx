import { Sparkles } from "lucide-react";
import type { AlgoSource, ReasoningFeedback } from "@/lib/algo/feedback";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";
import { cn } from "@/lib/utils";

export function SourceBadge({ source, t }: { source: AlgoSource; t: ProblemSolvingStrings }) {
  const label = source === "ai" ? t.sourceAi : source === "limited" ? t.sourceLimited : t.sourceOffline;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
        source === "ai" ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground/75",
      )}
      data-testid="fb-source"
    >
      {label}
    </span>
  );
}

/** Feedback on the reasoning (not on the pick, which is graded deterministically). */
export function FeedbackCard({
  fb,
  source,
  t,
}: {
  fb: ReasoningFeedback;
  source: AlgoSource;
  t: ProblemSolvingStrings;
}) {
  return (
    <section
      aria-label={t.feedbackTitle}
      className="bg-background/60 flex flex-col gap-3 rounded-xl border p-4"
      data-testid="reasoning-feedback"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 font-bold">
          <Sparkles className="text-primary size-4" aria-hidden />
          {t.feedbackTitle}
        </h3>
        <span className="flex items-center gap-2">
          <SourceBadge source={source} t={t} />
          <span dir="ltr" className="font-mono text-sm font-semibold tabular-nums">
            {fb.score}/100
          </span>
        </span>
      </div>
      <div className="bg-secondary h-1.5 overflow-hidden rounded-full" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            fb.score >= 70 ? "bg-fit" : fb.score >= 40 ? "bg-caution" : "bg-destructive",
          )}
          style={{ width: `${Math.max(4, fb.score)}%` }}
        />
      </div>
      <p dir="auto" className="leading-relaxed [overflow-wrap:anywhere]">
        {fb.summary}
      </p>
      {fb.strengths.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="kicker text-fit">{t.strengths}</h4>
          <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm" dir="auto">
            {fb.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {fb.gaps.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="kicker text-caution">{t.gaps}</h4>
          <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm" dir="auto">
            {fb.gaps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {fb.nextQuestion && (
        <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm" dir="auto">
          <span className="font-semibold">{t.askNext}: </span>
          {fb.nextQuestion}
        </p>
      )}
    </section>
  );
}
