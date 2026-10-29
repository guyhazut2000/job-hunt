"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { analyzeProblem, type AnalyzeResponse } from "@/app/learn/problem-solving/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { optionLabel } from "@/lib/algo/engine";
import { QUESTION_BY_ID } from "@/lib/algo/checklist";
import { PATTERN_BY_ID } from "@/lib/algo/patterns";
import { tr } from "@/lib/algo/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/learning";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./FeedbackCard";

const MIN = 20;
const MAX = 4000;

type Ok = Extract<AnalyzeResponse, { ok: true }>;

export function AnalyzeForm({ locale, t }: { locale: Locale; t: ProblemSolvingStrings }) {
  const [text, setText] = useState("");
  const [res, setRes] = useState<Ok | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    if (text.trim().length < MIN) return setError(fmt(t.tooShort, { n: MIN }));
    setError(null);
    start(async () => {
      try {
        const r = await analyzeProblem({ text });
        if (!r.ok)
          return setError(
            r.error === "limit" ? t.limitReached : r.error === "too_short" ? fmt(t.tooShort, { n: MIN }) : t.error,
          );
        setRes(r);
      } catch {
        setError(t.error);
      }
    });
  };

  const w = res?.walkthrough;
  const guideHref = w
    ? `/learn/problem-solving?${new URLSearchParams(Object.entries(w.answers).filter((e): e is [string, string] => !!e[1])).toString()}`
    : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor="ps-problem" className="font-bold">
            {t.analyzeLabel}
          </label>
          <VoiceInputButton targetId="ps-problem" size="sm" testId="ps-analyze-voice" />
        </div>
        <Textarea
          id="ps-problem"
          dir="auto"
          rows={6}
          maxLength={MAX}
          value={text}
          placeholder={t.analyzePlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button
          type="button"
          className="min-h-12 w-full rounded-full sm:w-fit sm:px-8"
          disabled={pending}
          onClick={run}
          data-testid="ps-analyze"
        >
          <ScanSearch className={cn("size-4", pending && "motion-safe:animate-pulse")} aria-hidden />
          {pending ? t.analyzing : t.analyze}
        </Button>
      </div>

      {w && res && (
        <section aria-live="polite" className="flex flex-col gap-5" data-testid="walkthrough">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black">{t.candidates}</h2>
            <SourceBadge source={res.source} t={t} />
          </div>
          <ol className="flex flex-col gap-2.5">
            {w.candidates.map((c, i) => {
              const p = PATTERN_BY_ID.get(c.pattern)!;
              return (
                <li key={c.pattern} className="bg-card flex flex-col gap-1 rounded-xl border p-3.5">
                  <Link
                    href={`/learn/problem-solving/patterns/${p.id}`}
                    dir="ltr"
                    className="font-bold hover:underline"
                  >
                    <span className="text-muted-foreground me-1.5 font-mono text-sm">{i + 1}.</span>
                    {p.name}
                    <span className="text-muted-foreground ms-2 font-mono text-xs">{p.time}</span>
                  </Link>
                  <p dir="auto" className="text-foreground/80 text-sm leading-relaxed">
                    {c.why}
                  </p>
                </li>
              );
            })}
          </ol>
          {w.targetComplexity && (
            <p className="bg-fit-soft text-fit w-fit rounded-lg px-3 py-2 text-sm font-semibold">
              {t.targetComplexity}:{" "}
              <span dir="ltr" className="font-mono">
                {w.targetComplexity}
              </span>
            </p>
          )}
          {Object.keys(w.answers).length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="kicker">{t.walkAnswers}</h3>
              <ul className="flex flex-col divide-y rounded-xl border text-sm">
                {Object.entries(w.answers).map(([q, o]) => {
                  const question = QUESTION_BY_ID.get(q);
                  if (!question || !o) return null;
                  return (
                    <li key={q} className="flex flex-col px-3 py-2">
                      <span>
                        <span className="text-muted-foreground">{tr(question.q, locale)} </span>
                        <span className="font-semibold">{optionLabel(q, o, locale)}</span>
                      </span>
                      {w.because[q] && (
                        <span dir="auto" className="text-muted-foreground text-xs">
                          {w.because[q]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {w.clarify.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="kicker">{t.clarify}</h3>
                <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm" dir="auto">
                  {w.clarify.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            )}
            {w.pitfalls.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="kicker text-caution">{t.walkPitfalls}</h3>
                <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm" dir="auto">
                  {w.pitfalls.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <Button asChild variant="secondary" className="w-fit rounded-full">
            <Link href={guideHref}>
              {t.openInGuide}
              <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
}
