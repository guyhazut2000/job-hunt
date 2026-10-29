"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Eye, EyeOff, RotateCcw, Wand2, X } from "lucide-react";
import { submitAttempt, type AttemptResponse } from "@/app/learn/problem-solving/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import type { GuideAnswers } from "@/lib/algo/checklist";
import { scoreGuide } from "@/lib/algo/engine";
import { PATTERN_BY_ID } from "@/lib/algo/patterns";
import type { PatternId } from "@/lib/algo/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";
import { cn } from "@/lib/utils";
import { CandidateList } from "./CandidateList";
import { ChecklistQuestions } from "./ChecklistQuestions";
import { FeedbackCard } from "./FeedbackCard";
import { PatternPicker } from "./PatternPicker";

const REASONING_MAX = 2000;

const VERDICT_TONE = {
  correct: "bg-fit-soft text-fit border-fit/30",
  partial: "bg-caution-soft text-caution border-caution/30",
  miss: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

type Ok = Extract<AttemptResponse, { ok: true }>;

export function PracticeRunner({
  problemId,
  nextId,
  locale,
  t,
  history,
}: {
  problemId: string;
  nextId: string;
  locale: Locale;
  t: ProblemSolvingStrings;
  history: { id: string; result: string; picked: string[]; at: string }[];
}) {
  const [answers, setAnswers] = useState<GuideAnswers>({});
  const [picked, setPicked] = useState<PatternId[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [reveal, setReveal] = useState(false);
  const [res, setRes] = useState<Ok | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const candidates = useMemo(() => (reveal ? scoreGuide(answers, locale, 3) : []), [answers, locale, reveal]);
  const name = (id: string) => PATTERN_BY_ID.get(id as PatternId)?.name ?? id;

  const submit = () => {
    if (!picked.length) return setError(t.pickOne);
    setError(null);
    start(async () => {
      try {
        const r = await submitAttempt({ problemId, picked, answers, reasoning });
        if (!r.ok) return setError(r.error === "limit" ? t.limitReached : r.error === "no_pick" ? t.pickOne : t.error);
        setRes(r);
      } catch {
        setError(t.error);
      }
    });
  };

  const retry = () => {
    setRes(null);
    setPicked([]);
    setReasoning("");
    setAnswers({});
    setReveal(false);
  };

  if (res) {
    const r = res.reveal;
    return (
      <section aria-labelledby="result" className="flex flex-col gap-4" aria-live="polite">
        <div
          className={cn("flex flex-col gap-2 rounded-xl border p-4", VERDICT_TONE[res.result])}
          data-testid="verdict"
        >
          <h2 id="result" className="text-xl font-black">
            {t.verdict[res.result]}
          </h2>
          <p className="text-foreground text-sm">
            <span className="font-semibold">{t.expected}: </span>
            <span dir="ltr">{r.patterns.map(name).join(" / ")}</span>
            {r.alsoOk.length > 0 && (
              <>
                {" · "}
                <span className="font-semibold">{t.alsoOk}: </span>
                <span dir="ltr">{r.alsoOk.map(name).join(", ")}</span>
              </>
            )}
          </p>
          <p className="text-foreground/85 text-sm leading-relaxed">
            <span className="font-semibold">{t.whyExpected}: </span>
            {r.why}
          </p>
        </div>
        <FeedbackCard fb={res.feedback} source={res.source} t={t} />
        {r.keys.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="kicker">{t.yourChecklist}</h3>
            <ul className="flex flex-col divide-y rounded-xl border text-sm" data-testid="key-checks">
              {r.keys.map((k) => (
                <li key={k.question} className="flex items-start gap-2 px-3 py-2">
                  {k.ok ? (
                    <Check className="text-fit mt-0.5 size-4 shrink-0" aria-label="ok" />
                  ) : (
                    <X className="text-destructive mt-0.5 size-4 shrink-0" aria-label="mismatch" />
                  )}
                  <span className="flex flex-col">
                    <span>
                      <span className="text-muted-foreground">{t.shouldBe}: </span>
                      <span className="font-semibold">{k.expected}</span>
                    </span>
                    {!k.ok && (
                      <span className="text-muted-foreground text-xs">
                        {t.youSaid}: {k.given === "—" ? t.notAnswered : k.given}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link href={`/learn/problem-solving/practice/${nextId}`}>
              {t.nextProblem}
              <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
            </Link>
          </Button>
          <Button type="button" variant="secondary" className="rounded-full" onClick={retry}>
            <RotateCcw className="size-4" aria-hidden />
            {t.tryAgain}
          </Button>
          {r.leetcode && (
            <Button asChild variant="ghost" className="rounded-full">
              <a href={`https://leetcode.com/problems/${r.leetcode}/`} target="_blank" rel="noopener noreferrer">
                {t.tryOnLeetcode}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="s2" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="s2" className="text-lg font-black">
            {t.step2}
          </h2>
          <p className="text-muted-foreground text-sm">{t.step2Lead}</p>
        </div>
        <ChecklistQuestions locale={locale} value={answers} onChange={setAnswers} compact />
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit rounded-full"
            onClick={() => setReveal((v) => !v)}
            data-testid="reveal-guide"
          >
            {reveal ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {reveal ? t.hideGuide : t.revealGuide}
          </Button>
          {reveal && <CandidateList candidates={candidates} locale={locale} t={t} />}
        </div>
      </section>
      <section aria-labelledby="s3" className="flex flex-col gap-3">
        <h2 id="s3" className="text-lg font-black">
          {t.step3}
        </h2>
        <PatternPicker value={picked} onChange={setPicked} t={t} />
      </section>
      <section aria-labelledby="s4" className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <label id="s4" htmlFor="ps-reasoning" className="text-lg font-black">
            {t.step4}
          </label>
          <VoiceInputButton targetId="ps-reasoning" size="sm" testId="ps-voice" />
        </div>
        <Textarea
          id="ps-reasoning"
          dir="auto"
          rows={4}
          maxLength={REASONING_MAX}
          value={reasoning}
          placeholder={t.reasoningPlaceholder}
          onChange={(e) => setReasoning(e.target.value)}
        />
      </section>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        type="button"
        className="min-h-12 w-full rounded-full sm:w-fit sm:px-8"
        disabled={pending}
        onClick={submit}
        data-testid="ps-submit"
      >
        <Wand2 className={cn("size-4", pending && "motion-safe:animate-pulse")} aria-hidden />
        {pending ? t.checking : t.submit}
      </Button>
      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t.history}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-semibold",
                    VERDICT_TONE[h.result as keyof typeof VERDICT_TONE],
                  )}
                >
                  {t.lastResult[h.result as "correct" | "partial" | "miss"] ?? h.result}
                </span>
                <span dir="ltr" className="text-foreground/80">
                  {h.picked.map(name).join(", ")}
                </span>
                <time className="text-muted-foreground text-xs" dateTime={h.at}>
                  {new Date(h.at).toLocaleDateString(locale === "he" ? "he-IL" : "en-GB")}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
