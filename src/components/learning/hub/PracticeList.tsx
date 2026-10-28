"use client";

import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { useState, useTransition } from "react";
import { Check, Lightbulb, MessageCircleQuestion, Target } from "lucide-react";
import { savePractice } from "@/app/learn/hub-actions";
import { AnswerFeedbackPanel, FeedbackButton, useAnswerFeedback } from "@/components/learning/hub/AnswerFeedbackPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmt } from "@/lib/i18n/learning";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import type { Exercise } from "@/lib/learning/content";
import type { StoredFeedback } from "@/lib/learning/feedback";
import type { PracticeState } from "@/lib/learning/progress";
import type { Stage } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<string, string> = {
  easy: "bg-fit-soft text-fit",
  medium: "bg-accent text-accent-foreground",
  hard: "bg-caution-soft text-caution",
};

function ExerciseCard({
  ex,
  n,
  skill,
  stage,
  initial,
  prior,
  loggedIn,
  t,
  onAskTutor,
  onDone,
}: {
  ex: Exercise & { id: string };
  n: number;
  skill: string;
  stage: Stage;
  initial?: { done: boolean; notes?: string };
  prior?: StoredFeedback;
  loggedIn: boolean;
  t: LearningHubStrings;
  onAskTutor: (text: string) => void;
  onDone: (done: boolean) => void;
}) {
  const [done, setDone] = useState(!!initial?.done);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(initial?.notes ?? "");
  const [checks, setChecks] = useState<boolean[]>(() => ex.checklist.map(() => !!initial?.done));
  const [hints, setHints] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fb = useAnswerFeedback({ skill, stage, kind: "exercise", itemId: ex.id, initial: prior, t });

  const persist = (nextDone: boolean, nextNotes?: string) =>
    start(async () => {
      const r = await savePractice({ skill, stage, exerciseId: ex.id, done: nextDone, notes: nextNotes });
      if (r.ok) {
        if (nextNotes !== undefined) setSavedNotes(nextNotes);
        setStatus(t.savedWork);
      }
    });

  return (
    <article
      aria-labelledby={`${ex.id}-title`}
      className={cn("bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4 sm:p-5", done && "border-fit/35")}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{fmt(t.exercise, { n })}</span>
          <h3 id={`${ex.id}-title`} dir="auto" className="leading-snug font-bold">
            {ex.title}
          </h3>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {done && (
            <span className="bg-fit-soft text-fit inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
              <Check className="size-3.5" aria-hidden />
              {t.done}
            </span>
          )}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", LEVEL_TONE[ex.level])}>
            {t.levels[ex.level]}
          </span>
        </span>
      </header>

      <p className="flex items-start gap-2 text-[0.95rem] leading-relaxed" dir="auto">
        <Target className="text-primary mt-1 size-4 shrink-0" aria-label={t.goal} />
        {ex.goal}
      </p>

      <section className="flex flex-col gap-2">
        <h4 className="kicker">{t.steps}</h4>
        <ol className="flex flex-col gap-2">
          {ex.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[0.95rem] leading-relaxed">
              <span className="bg-secondary text-foreground/80 grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                {i + 1}
              </span>
              <span dir="auto" className="min-w-0 [overflow-wrap:anywhere] break-words">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-fit-soft/40 border-fit/20 flex flex-col gap-1 rounded-lg border p-3">
        <h4 className="kicker text-fit">{t.expected}</h4>
        <p dir="auto" className="text-sm leading-relaxed [overflow-wrap:anywhere]">
          {ex.expected}
        </p>
      </section>

      {ex.hints.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {ex.hints.map((_, i) => (
              <Button
                key={i}
                type="button"
                size="sm"
                variant={i < hints ? "secondary" : "outline"}
                className="min-h-10 rounded-full"
                aria-expanded={i < hints}
                disabled={i > hints}
                onClick={() => setHints(Math.max(hints, i + 1))}
              >
                <Lightbulb className="size-3.5" aria-hidden />
                {fmt(t.showHint, { n: i + 1 })}
              </Button>
            ))}
          </div>
          {hints > 0 && (
            <ul className="flex flex-col gap-1.5" aria-live="polite">
              {ex.hints.slice(0, hints).map((h, i) => (
                <li key={i} dir="auto" className="bg-caution-soft/45 rounded-lg px-3 py-2 text-sm leading-relaxed">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="kicker mb-1.5">{t.checklist}</legend>
        {ex.checklist.map((c, i) => (
          <label key={i} className="flex min-h-10 cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4 shrink-0"
              checked={checks[i]}
              onChange={() => setChecks(checks.map((v, j) => (j === i ? !v : v)))}
            />
            <span dir="auto" className={cn("min-w-0", checks[i] && "text-muted-foreground line-through")}>
              {c}
            </span>
          </label>
        ))}
      </fieldset>

      {loggedIn && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-end justify-between gap-2">
            <label htmlFor={`${ex.id}-notes`} className="text-sm font-semibold">
              {t.myWork}
            </label>
            <VoiceInputButton targetId={`${ex.id}-notes`} size="sm" testId="practice-voice" />
          </div>
          <Textarea
            id={`${ex.id}-notes`}
            dir="auto"
            value={notes}
            maxLength={4000}
            rows={3}
            placeholder={t.myWorkPlaceholder}
            onChange={(e) => {
              setNotes(e.target.value);
              setStatus(null);
            }}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={done ? "outline" : "default"}
              className="min-h-11 rounded-full"
              disabled={pending}
              onClick={() => {
                const next = !done;
                setDone(next);
                onDone(next);
                if (next) setChecks(ex.checklist.map(() => true));
                persist(next, notes !== savedNotes ? notes : undefined);
              }}
            >
              <Check className="size-4" aria-hidden />
              {done ? t.done : t.markDone}
            </Button>
            {notes !== savedNotes && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full"
                disabled={pending}
                onClick={() => persist(done, notes)}
              >
                {t.saveWork}
              </Button>
            )}
            <FeedbackButton
              pending={fb.pending}
              hasResult={!!fb.result}
              t={t}
              onClick={() => fb.check(notes, (r) => setSavedNotes(r.answer))}
            />
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full"
              onClick={() => onAskTutor(`${ex.title}\n\n${notes.trim()}`.slice(0, 1900))}
            >
              <MessageCircleQuestion className="size-4" aria-hidden />
              {t.askTutor}
            </Button>
            <span role="status" aria-live="polite" className="text-fit text-xs font-semibold">
              {status}
            </span>
          </div>
          {fb.error && (
            <p role="alert" className="text-destructive text-sm">
              {fb.error}
            </p>
          )}
          {fb.result && (
            <AnswerFeedbackPanel result={fb.result} t={t} onFollowUp={(q) => onAskTutor(`${ex.title}\n\n${q}`)} />
          )}
        </div>
      )}
    </article>
  );
}

export function PracticeList({
  exercises,
  skill,
  stage,
  practice,
  feedback = {},
  loggedIn,
  t,
  onAskTutor,
}: {
  exercises: (Exercise & { id: string })[];
  skill: string;
  stage: Stage;
  practice: PracticeState;
  feedback?: Record<string, StoredFeedback>;
  loggedIn: boolean;
  t: LearningHubStrings;
  onAskTutor: (text: string) => void;
}) {
  const [doneCount, setDoneCount] = useState(() => exercises.filter((e) => practice[e.id]?.done).length);
  return (
    <div className="flex flex-col gap-4">
      {loggedIn && (
        <p className="text-muted-foreground text-sm">
          {fmt(t.practiceDone, { n: doneCount, total: exercises.length })}
        </p>
      )}
      {exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.id}
          ex={ex}
          n={i + 1}
          skill={skill}
          stage={stage}
          initial={practice[ex.id]}
          prior={feedback[ex.id]}
          loggedIn={loggedIn}
          t={t}
          onAskTutor={onAskTutor}
          onDone={(d) => setDoneCount((c) => c + (d ? 1 : -1))}
        />
      ))}
    </div>
  );
}
