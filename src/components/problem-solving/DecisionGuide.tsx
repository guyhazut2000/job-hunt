"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE, type GuideAnswers } from "@/lib/algo/checklist";
import { scoreGuide, TARGET_BY_SIZE } from "@/lib/algo/engine";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/learning";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";
import { CandidateList } from "./CandidateList";
import { ChecklistQuestions } from "./ChecklistQuestions";

/** Interactive checklist → ranked candidate patterns, recomputed on every answer. */
export function DecisionGuide({
  locale,
  t,
  initial = {},
}: {
  locale: Locale;
  t: ProblemSolvingStrings;
  initial?: GuideAnswers;
}) {
  const [answers, setAnswers] = useState<GuideAnswers>(initial);
  const candidates = useMemo(() => scoreGuide(answers, locale), [answers, locale]);
  const n = Object.keys(answers).length;
  const target = answers.size ? TARGET_BY_SIZE[answers.size] : null;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <ChecklistQuestions locale={locale} value={answers} onChange={setAnswers} />
      <aside
        aria-live="polite"
        className="bg-card flex flex-col gap-3 rounded-xl border p-4 lg:sticky lg:top-20"
        aria-label={t.candidates}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{t.candidates}</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={!n}
            onClick={() => setAnswers({})}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t.reset}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{fmt(t.answeredOf, { n, total: GUIDE.length })}</p>
        {target && (
          <p className="bg-fit-soft text-fit rounded-lg px-3 py-2 text-sm font-semibold">
            {t.targetComplexity}:{" "}
            <span dir="ltr" className="font-mono">
              {target}
            </span>
          </p>
        )}
        <CandidateList candidates={candidates} locale={locale} t={t} />
      </aside>
    </div>
  );
}
