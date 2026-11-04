"use client";

import { Children, createElement, useEffect, useRef, useState, type ReactNode } from "react";
import { fillD, type DensityStrings } from "@/lib/i18n/density";
import { countToInclude, nextBatch, revealMore } from "@/lib/ui/show-more";
import { cn } from "@/lib/utils";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex="0"]';

/** Move keyboard focus to the first newly revealed item, so "show more" never strands the user. */
export function focusItem(el: Element | null | undefined) {
  if (!(el instanceof HTMLElement)) return;
  const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
  if (target) target.focus({ preventScroll: false });
  else {
    el.tabIndex = -1;
    el.focus();
  }
}

/**
 * Renders the first `initial` children, then "הצג עוד N" in steps of `step`, with a live
 * "מוצגים X מתוך Y" count. Deep links (`#id` in `anchorIds`) reveal their item on load.
 * docs/ui-data-density.md
 */
export function ShowMoreList({
  children,
  initial,
  step = initial,
  as = "ul",
  className,
  s,
  testId,
  anchorIds,
  label,
  revealIndex,
}: {
  children: ReactNode;
  initial: number;
  step?: number;
  as?: "ul" | "ol" | "div";
  className?: string;
  s: DensityStrings;
  testId?: string;
  /** DOM ids of the children in order, so a `#hash` pointing at a hidden item reveals it. */
  anchorIds?: string[];
  /** Accessible name for the list (e.g. the section heading). */
  label?: string;
  /** Index that must be visible from the first render (e.g. a `?contact=` deep link). */
  revealIndex?: number;
}) {
  const all = Children.toArray(children);
  const total = all.length;
  const [shown, setShown] = useState(() =>
    revealIndex !== undefined && revealIndex >= 0 ? countToInclude(revealIndex, initial, step) : initial,
  );
  const ref = useRef<HTMLElement>(null);
  const focusFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!anchorIds?.length) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const i = id ? anchorIds.indexOf(id) : -1;
    if (i < initial) return;
    setShown(countToInclude(i, initial, step));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    // Only on first load: later hash changes are in-page jumps the user made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (focusFrom.current === null) return;
    focusItem(ref.current?.children[focusFrom.current]);
    focusFrom.current = null;
  }, [shown]);

  const count = Math.min(shown, total);
  const list = createElement(as, { ref, className, "data-testid": testId, "aria-label": label }, all.slice(0, count));
  if (total <= initial) return list;
  return (
    <>
      {list}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1" data-testid={testId ? `${testId}-more` : undefined}>
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {fillD(s.showing, { shown: count, total })}
        </p>
        {count < total ? (
          <button
            type="button"
            className={moreButtonClass}
            onClick={() => {
              focusFrom.current = count;
              setShown(revealMore(count, total, step));
            }}
          >
            {fillD(s.showMore, { n: nextBatch(count, total, step) })}
          </button>
        ) : (
          <button
            type="button"
            className={moreButtonClass}
            onClick={() => {
              setShown(initial);
              ref.current?.scrollIntoView({ block: "nearest" });
            }}
          >
            {s.showLess}
          </button>
        )}
      </div>
    </>
  );
}

export const moreButtonClass = cn(
  "bg-card text-foreground hover:bg-muted inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors sm:min-h-9",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
);
