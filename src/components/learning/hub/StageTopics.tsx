"use client";

import { useState, useTransition } from "react";
import { Check, PartyPopper } from "lucide-react";
import { setStageDone, toggleTopic } from "@/app/learn/hub-actions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import type { Stage } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

/** Roadmap topics of one stage as a saved checklist, plus "mark stage complete". */
export function StageTopics({
  skill,
  stage,
  topics,
  initialDone,
  initialStageDone,
  loggedIn,
  t,
}: {
  skill: string;
  stage: Stage;
  topics: string[];
  initialDone: string[];
  initialStageDone: boolean;
  loggedIn: boolean;
  t: LearningHubStrings;
}) {
  const [done, setDone] = useState(() => new Set(initialDone));
  const [stageDone, setStageDoneState] = useState(initialStageDone);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pct = stageDone ? 100 : Math.round((done.size / Math.max(1, topics.length)) * 90);

  const flip = (topic: string) => {
    if (!loggedIn) return;
    const next = new Set(done);
    const on = !next.has(topic);
    if (on) next.add(topic);
    else next.delete(topic);
    setDone(next);
    start(async () => {
      const r = await toggleTopic({ skill, stage, topic, done: on });
      if (!r.ok) setDone(done);
    });
  };

  const finish = () =>
    start(async () => {
      const to = !stageDone;
      setStageDoneState(to);
      const r = await setStageDone({ skill, stage, done: to });
      if (!r.ok) return setStageDoneState(!to);
      setNote(r.skillDone && to ? (r.added ? t.skillCompleted : t.skillCompletedNoAdd) : null);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">{t.topicsTitle}</h2>
        <span className="text-muted-foreground font-mono text-xs tabular-nums" dir="ltr">
          {pct}%
        </span>
      </div>
      <Progress value={pct} aria-label={t.topicsTitle} className="h-1.5" />
      {loggedIn && <p className="text-muted-foreground text-xs">{t.topicsLead}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {topics.map((topic) => {
          const on = done.has(topic) || stageDone;
          return (
            <li key={topic}>
              <label
                className={cn(
                  "hover:bg-secondary/60 flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  on && "border-fit/30 bg-fit-soft/40",
                  !loggedIn && "cursor-default",
                )}
              >
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4 shrink-0"
                  checked={on}
                  disabled={!loggedIn || stageDone}
                  onChange={() => flip(topic)}
                />
                <span dir="ltr" className="min-w-0 text-start break-words">
                  {topic}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {loggedIn && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={stageDone ? "outline" : "default"}
            className="min-h-11 w-full rounded-full sm:w-fit"
            disabled={pending}
            onClick={finish}
          >
            <Check className="size-4" aria-hidden />
            {stageDone ? t.markStageUndo : t.markStageDone}
          </Button>
          <p role="status" aria-live="polite" className="text-fit text-sm font-semibold empty:hidden">
            {note && (
              <span className="inline-flex items-start gap-1.5">
                <PartyPopper className="mt-0.5 size-4 shrink-0" aria-hidden />
                {note}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
