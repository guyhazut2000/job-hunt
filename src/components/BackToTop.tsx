"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { BACK_TO_TOP_THRESHOLD, backToTopBehavior, isScrollContainer, shouldShowBackToTop } from "@/lib/ui/back-to-top";
import { cn } from "@/lib/utils";

/**
 * Where the button floats. Bottom offsets keep it clear of the fixed mobile UI:
 * - "default": above the mobile bottom nav (<md), bottom corner from md up.
 * - "action-bar": pages that also have a fixed action bar (job details): above nav + bar (<md),
 *   above the bar (md–lg), bottom corner from lg up (the bar is lg:hidden).
 * All offsets include the iOS safe-area inset.
 */
const PLACEMENT = {
  default:
    "bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1rem)] md:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]",
  "action-bar":
    "bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+5.25rem)] md:bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]",
} as const;

type Props = {
  /** Accessible name / tooltip, e.g. "Back to top". */
  label: string;
  /**
   * Optional id of a scrollable container (drawer/panel). When it exists and actually scrolls,
   * the button tracks and scrolls that element; otherwise it falls back to the window.
   */
  containerId?: string;
  /** Element to move keyboard focus to after jumping up (defaults to the page's <main>). */
  focusId?: string;
  placement?: keyof typeof PLACEMENT;
  threshold?: number;
  className?: string;
};

type Scroller = { top: () => number; scrollTo: (behavior: ScrollBehavior) => void; target: Window | HTMLElement };

function resolveScroller(containerId?: string): Scroller {
  const el = containerId ? document.getElementById(containerId) : null;
  if (el && isScrollContainer(el, getComputedStyle(el).overflowY)) {
    return { target: el, top: () => el.scrollTop, scrollTo: (behavior) => el.scrollTo({ top: 0, behavior }) };
  }
  return {
    target: window,
    top: () => window.scrollY || document.documentElement.scrollTop,
    scrollTo: (behavior) => window.scrollTo({ top: 0, behavior }),
  };
}

export function BackToTop({
  label,
  containerId,
  focusId = "main",
  placement = "default",
  threshold = BACK_TO_TOP_THRESHOLD,
  className,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scroller = resolveScroller(containerId);
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(shouldShowBackToTop(scroller.top(), threshold));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.target.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerId, threshold]);

  const onClick = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resolveScroller(containerId).scrollTo(backToTopBehavior(reduce));
    // The button disappears at the top; hand keyboard focus to the start of the content instead.
    const focusEl = document.getElementById(focusId);
    if (focusEl) {
      if (!focusEl.hasAttribute("tabindex")) focusEl.setAttribute("tabindex", "-1");
      focusEl.focus({ preventScroll: true });
    }
  }, [containerId, focusId]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      data-visible={visible}
      className={cn(
        "bg-card text-foreground fixed end-4 z-30 inline-flex size-12 items-center justify-center rounded-full border shadow-lg md:end-6",
        "hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        "transition-[opacity,transform,visibility] duration-200 motion-reduce:transition-none",
        visible ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-2 opacity-0",
        PLACEMENT[placement],
        className,
      )}
    >
      <ArrowUp className="size-5" aria-hidden />
    </button>
  );
}
