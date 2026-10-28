"use client";

import { useState, useTransition } from "react";
import { Check, Circle, Loader } from "lucide-react";
import { setSkillStatus, type LearnStatusInput } from "@/app/learn/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface StatusLabels {
  status: Record<LearnStatusInput, string>;
  statusLabel: string;
  proofLabel: string;
  proofPlaceholder: string;
  save: string;
  saved: string;
  doneAdded: string;
  doneAlready: string;
  invalidUrl: string;
}

const ICONS = { NONE: Circle, LEARNING: Loader, DONE: Check } as const;

/** Segmented not started / learning / done control, with an optional proof link once done. */
export function SkillStatusControl({
  skill,
  initial,
  initialProof,
  labels,
  compact,
}: {
  skill: string;
  initial: LearnStatusInput;
  initialProof?: string | null;
  labels: StatusLabels;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<LearnStatusInput>(initial);
  const [proof, setProof] = useState(initialProof ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: LearnStatusInput, proofUrl = proof) =>
    start(async () => {
      const prev = status;
      setStatus(next);
      const r = await setSkillStatus({ skill, status: next, proofUrl: next === "DONE" ? proofUrl : "" });
      if (!r.ok) {
        setStatus(prev);
        setNote(r.error === "url" ? labels.invalidUrl : null);
        return;
      }
      setNote(next === "DONE" && prev !== "DONE" ? (r.added ? labels.doneAdded : labels.doneAlready) : labels.saved);
    });

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label={labels.statusLabel}
        className={cn("bg-secondary/70 inline-flex w-full gap-1 rounded-xl p-1 sm:w-auto", compact && "sm:w-auto")}
      >
        {(["NONE", "LEARNING", "DONE"] as const).map((s) => {
          const Icon = ICONS[s];
          const on = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => !on && save(s)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-none sm:gap-1.5 sm:px-4",
                on
                  ? s === "DONE"
                    ? "bg-fit-soft text-accent-foreground ring-fit/30 shadow-sm ring-1"
                    : s === "LEARNING"
                      ? "bg-caution-soft text-caution ring-caution/30 shadow-sm ring-1"
                      : "bg-card text-foreground shadow-sm"
                  : "text-foreground/65 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {labels.status[s]}
            </button>
          );
        })}
      </div>
      {status === "DONE" && !compact && (
        <form
          className="flex flex-col gap-1.5 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            save("DONE", proof);
          }}
        >
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`proof-${skill}`} className="text-sm">
              {labels.proofLabel}
            </Label>
            <Input
              id={`proof-${skill}`}
              type="url"
              dir="ltr"
              inputMode="url"
              value={proof}
              placeholder={labels.proofPlaceholder}
              onChange={(e) => setProof(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {labels.save}
          </Button>
        </form>
      )}
      <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
        {note}
      </p>
    </div>
  );
}
