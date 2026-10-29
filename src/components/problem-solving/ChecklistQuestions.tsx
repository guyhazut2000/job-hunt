"use client";

import { GUIDE, type GuideAnswers } from "@/lib/algo/checklist";
import { tr } from "@/lib/algo/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/** The fixed checklist as option chips. Click a chosen option again to clear it. */
export function ChecklistQuestions({
  locale,
  value,
  onChange,
  compact = false,
}: {
  locale: Locale;
  value: GuideAnswers;
  onChange: (next: GuideAnswers) => void;
  compact?: boolean;
}) {
  const set = (q: string, o: string) => {
    const next = { ...value };
    if (next[q] === o) delete next[q];
    else next[q] = o;
    onChange(next);
  };
  return (
    <ol className="flex flex-col gap-3">
      {GUIDE.map((q, i) => (
        <li key={q.id} className="bg-card flex flex-col gap-2 rounded-xl border p-3.5 sm:p-4" data-testid={`q-${q.id}`}>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">
              <span className="text-muted-foreground me-1.5 font-mono text-sm">{i + 1}.</span>
              {tr(q.q, locale)}
            </legend>
            {!compact && <p className="text-muted-foreground text-sm leading-relaxed">{tr(q.hint, locale)}</p>}
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((o) => {
                const on = value[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    data-option={o.id}
                    onClick={() => set(q.id, o.id)}
                    className={cn(
                      "min-h-10 rounded-full border px-3 text-sm transition-colors",
                      on
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {tr(o.label, locale)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}
