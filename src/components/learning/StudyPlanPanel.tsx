"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { generatePersonalStudyPlan, type StudyPlanActionState } from "@/app/learn/gaps/actions";
import { Button } from "@/components/ui/button";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { gapsStrings } from "@/lib/i18n/gaps";
import { fmt } from "@/lib/i18n/learning";
import type { PersonalStudyPlan } from "@/lib/learning/study-plan";

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-fit rounded-full" data-testid="personal-plan-generate">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Rules plan up front; "Improve with AI" replaces it when the guarded call validates. */
export function StudyPlanPanel({ locale, baseline }: { locale: "he" | "en"; baseline: PersonalStudyPlan }) {
  const s = gapsStrings(locale);
  const [state, action] = useActionState(generatePersonalStudyPlan, null as StudyPlanActionState | null);
  const plan = state?.ok ? state.plan : baseline;
  const [copiedBullet, setCopiedBullet] = useState<string | null>(null);
  const copied = copiedBullet === plan.cvBullet;
  const source = plan.source === "ai" ? s.personalAi : s.personalRules;

  return (
    <section
      id="personal-plan"
      aria-labelledby="personal-plan-title"
      data-testid="personal-study-plan"
      className="flex scroll-mt-20 flex-col gap-3"
    >
      <h2 id="personal-plan-title" className="font-heading text-xl font-bold">
        {s.personalTitle}
      </h2>
      <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
        {fmt(s.personalLead, { hours: plan.hoursPerWeek })}
      </p>
      <form action={action}>
        <Submit label={s.personalGenerate} pending={s.personalPending} />
      </form>
      {state && !state.ok ? (
        <p role="alert" className="text-sm">
          {s.personalEmpty}
        </p>
      ) : null}
      {plan.limitReason ? (
        <p role="status" className="text-sm">
          {aiLimitMessage(plan.limitReason, locale)}
        </p>
      ) : null}
      <p className="text-xs font-semibold" data-testid="personal-plan-source">
        {source}
      </p>
      <ol className="grid gap-3">
        {plan.weeks.map((week) => (
          <li key={week.week} className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
            <p className="font-heading font-bold">
              {fmt(s.personalWeek, { n: week.week })}
              <span className="text-muted-foreground ms-2 text-sm font-normal">
                {fmt(s.personalHours, { h: week.hours })}
              </span>
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {week.skillIds.map((id, i) => (
                <li key={id}>
                  {/^[a-z0-9-]+$/.test(id) ? (
                    <Link href={`/learn/${id}`} className="text-primary font-semibold underline">
                      <bdi>{week.labels[i] ?? id}</bdi>
                    </Link>
                  ) : (
                    <bdi>{week.labels[i] ?? id}</bdi>
                  )}
                </li>
              ))}
            </ul>
            {week.goals.length ? (
              <ul className="text-muted-foreground list-disc ps-5 text-sm">
                {week.goals.map((goal) => (
                  <li key={goal}>
                    <bdi>{goal}</bdi>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      {plan.questions.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-lg font-bold">{s.personalQuestions}</h3>
          <ol className="flex list-decimal flex-col gap-3 ps-5">
            {plan.questions.map((q, i) => (
              <li key={`${q.skillId}-${i}`} className="text-sm">
                <p>
                  <bdi>{q.question}</bdi>
                </p>
                {q.hints.length ? (
                  <details className="text-muted-foreground mt-1 text-xs">
                    <summary className="cursor-pointer">{s.personalHints}</summary>
                    <ul className="mt-1 list-disc ps-5">
                      {q.hints.map((hint, h) => (
                        <li key={h}>
                          <bdi>{hint}</bdi>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {plan.cvBullet ? (
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-4">
          <h3 className="font-heading font-bold">{s.personalBullet}</h3>
          <p dir="auto" className="text-sm leading-relaxed">
            {plan.cvBullet}
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-fit rounded-full"
            onClick={() => {
              void navigator.clipboard.writeText(plan.cvBullet).then(
                () => setCopiedBullet(plan.cvBullet),
                () => setCopiedBullet(null),
              );
            }}
          >
            {copied ? s.personalCopied : s.personalCopy}
          </Button>
          <span role="status" className="sr-only">
            {copied ? s.personalCopied : ""}
          </span>
        </div>
      ) : null}
    </section>
  );
}
