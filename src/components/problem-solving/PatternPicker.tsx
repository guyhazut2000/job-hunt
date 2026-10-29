"use client";

import { PATTERNS } from "@/lib/algo/patterns";
import { FAMILIES, type PatternId } from "@/lib/algo/types";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";
import { cn } from "@/lib/utils";

export const MAX_PICKS = 3;

export function PatternPicker({
  value,
  onChange,
  t,
}: {
  value: PatternId[];
  onChange: (next: PatternId[]) => void;
  t: ProblemSolvingStrings;
}) {
  const toggle = (id: PatternId) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= MAX_PICKS ? value : [...value, id]);
  return (
    <div className="flex flex-col gap-3" data-testid="pattern-picker">
      {FAMILIES.map((f) => {
        const list = PATTERNS.filter((p) => p.family === f);
        if (!list.length) return null;
        return (
          <div key={f} className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs font-semibold">{t.family[f]}</p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((p) => {
                const on = value.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    dir="ltr"
                    aria-pressed={on}
                    disabled={!on && value.length >= MAX_PICKS}
                    onClick={() => toggle(p.id)}
                    data-pattern={p.id}
                    className={cn(
                      "min-h-10 rounded-full border px-3 text-sm transition-colors disabled:opacity-40",
                      on
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
