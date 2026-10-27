"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { collapseLimit, needsCollapse } from "@/lib/ui/collapsible";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  moreLabel: string;
  lessLabel: string;
  /** Classes for the text block itself (typography, dir, etc.). */
  className?: string;
};

/**
 * Long text clamped to ~260px (mobile) / ~320px (md+) with a fade and a "show more" toggle.
 * SSR renders the clamped state (no button, no fade) so there is no hydration mismatch; the client
 * measures the real content height with a ResizeObserver and only then adds the fade + button.
 * The full text always stays in the DOM (SEO, screen readers, find-in-page).
 */
export function CollapsibleText({ children, moreLabel, lessLabel, className }: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => setOverflows(needsCollapse(inner.scrollHeight, collapseLimit(window.innerWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const clamped = !expanded;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) {
      // Collapsing removes a lot of height: bring the section start back into view if it's above the fold.
      const wrap = wrapRef.current;
      if (wrap && wrap.getBoundingClientRect().top < 0) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        wrap.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    }
  };

  return (
    <div ref={wrapRef} className="flex scroll-mt-(--header-h) flex-col items-start gap-2">
      <div
        id={id}
        className={cn(
          "relative w-full",
          clamped && "max-h-[260px] overflow-hidden md:max-h-[320px]",
          clamped &&
            overflows &&
            // Fade via mask, not an overlay: works on any background (paper texture, cards, dark mode).
            "[mask-image:linear-gradient(to_bottom,#000_calc(100%-5rem),transparent)]",
        )}
      >
        <div ref={innerRef} className={className}>
          {children}
        </div>
      </div>
      {overflows && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={id}
          className="text-primary hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold outline-none focus-visible:ring-3"
        >
          {expanded ? lessLabel : moreLabel}
          <ChevronDown
            className={cn("size-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
