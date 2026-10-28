"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { LearnCategory } from "@/lib/learning/types";
import { matchesQuery } from "@/lib/learning/ui";
import { cn } from "@/lib/utils";
import { CATEGORY_ICON, SkillCard, type LearnStatus, type SkillCardData } from "./SkillVisuals";

export interface ExplorerSkill extends SkillCardData {
  aliases: string[];
}

export interface ExplorerLabels {
  searchLabel: string;
  searchPlaceholder: string;
  filterLabel: string;
  filterAll: string;
  clearFilters: string;
  noResults: string;
  resultsCount: string;
  hoursPill: string;
  demandPill: string;
  status: Record<LearnStatus, string>;
}

/** Search box + category chips over the full skill grid. Filtering is client-side (81 nodes). */
export function LearnExplorer({
  skills,
  categories,
  labels,
}: {
  skills: ExplorerSkill[];
  categories: { id: LearnCategory; label: string; count: number }[];
  labels: ExplorerLabels;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<LearnCategory | null>(null);
  const q = useDeferredValue(query);

  const shown = useMemo(
    () => skills.filter((s) => (!cat || s.category === cat) && matchesQuery(q, s)),
    [skills, cat, q],
  );
  const filtered = !!cat || q.trim() !== "";

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : "bg-card text-foreground/80 hover:border-foreground/30 hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <label htmlFor="learn-search" className="sr-only">
            {labels.searchLabel}
          </label>
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            id="learn-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            autoComplete="off"
            className="input h-12 rounded-full ps-10 pe-10 text-base shadow-[0_1px_0_var(--border)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={labels.clearFilters}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Chips scroll sideways on phones instead of wrapping into a tall block. */}
        <div
          role="group"
          aria-label={labels.filterLabel}
          className="scroll-chips -mx-4 flex gap-2 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:[mask-image:none] sm:px-0"
        >
          <button type="button" aria-pressed={!cat} onClick={() => setCat(null)} className={chip(!cat)}>
            {labels.filterAll}
          </button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICON[c.id];
            const on = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCat(on ? null : c.id)}
                className={chip(on)}
              >
                <Icon className="size-4" aria-hidden />
                {c.label}
                <span className={cn("font-mono text-xs", on ? "text-background/70" : "text-muted-foreground")}>
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground flex min-h-6 items-center justify-between gap-2 text-sm" aria-live="polite">
        <span>{labels.resultsCount.replace("{n}", String(shown.length))}</span>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCat(null);
            }}
            className="text-primary min-h-10 font-semibold hover:underline"
          >
            {labels.clearFilters}
          </button>
        )}
      </div>

      {shown.length ? (
        <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((s) => (
            <li key={s.id} className="min-w-0">
              <SkillCard skill={s} labels={labels} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-card/60 flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Search className="text-muted-foreground size-6" aria-hidden />
          <p className="text-foreground/80 max-w-sm">{labels.noResults}</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCat(null);
            }}
            className="btn-ghost rounded-full"
          >
            {labels.clearFilters}
          </button>
        </div>
      )}
    </div>
  );
}
