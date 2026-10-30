import { CheckCircle2, Lightbulb, TrendingUp } from "lucide-react";
import type { InterviewStrings } from "@/lib/i18n/interview";
import type { Feedback, PlannedQuestion } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

const tone = (score: number) => (score >= 4 ? "bg-fit" : score >= 3 ? "bg-primary" : "bg-caution");

export function FeedbackView({
  feedback,
  plan,
  score,
  source,
  t,
}: {
  feedback: Feedback;
  plan: PlannedQuestion[];
  score: number | null;
  source: string;
  t: InterviewStrings;
}) {
  return (
    <section className="flex flex-col gap-5" data-testid="interview-feedback">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="kicker">{t.feedback}</p>
          <p className="text-muted-foreground text-xs" data-testid="interview-feedback-source">
            {t.feedbackSource[source] ?? source}
          </p>
        </div>
        {score !== null && (
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">{t.overall}</span>
            <span className="font-heading text-4xl font-black tabular-nums" data-testid="interview-score">
              {score}
              <span className="text-muted-foreground text-lg font-semibold">/100</span>
            </span>
          </div>
        )}
      </div>
      <p className="max-w-[70ch] leading-relaxed" dir="auto">
        {feedback.summary}
      </p>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">{t.dimensions}</h2>
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="interview-dimensions">
          {feedback.dimensions.map((d) => (
            <li key={d.key} className="border-rule flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{d.label}</span>
                <span className="font-bold tabular-nums">{d.score}/5</span>
              </div>
              <div className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={cn("h-full flex-1", n <= d.score ? tone(d.score) : "bg-muted")} />
                ))}
              </div>
              {d.note && (
                <p className="text-muted-foreground text-sm leading-relaxed" dir="auto">
                  {d.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {feedback.improvements.length > 0 && (
        <div className="bg-caution-soft/50 flex flex-col gap-2 rounded-xl p-4" data-testid="interview-improvements">
          <h2 className="font-heading flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="size-5" aria-hidden />
            {t.improvements}
          </h2>
          <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm leading-relaxed">
            {feedback.improvements.map((s, i) => (
              <li key={i} dir="auto">
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">{t.perQuestion}</h2>
        <ol className="flex flex-col gap-3">
          {feedback.perQuestion.map((p) => (
            <li key={p.index} className="border-rule flex flex-col gap-1.5 border-b pb-3 text-sm">
              <p className="leading-relaxed font-semibold whitespace-pre-line" dir="auto">
                {p.index + 1}. {plan[p.index]?.q.split("\n")[0]}
              </p>
              {p.strength && (
                <p className="flex items-start gap-1.5" dir="auto">
                  <CheckCircle2 className="text-fit mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">{t.strength}: </span>
                    {p.strength}
                  </span>
                </p>
              )}
              {p.improve && (
                <p className="flex items-start gap-1.5" dir="auto">
                  <Lightbulb className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">{t.improve}: </span>
                    {p.improve}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
