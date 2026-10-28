"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A vertical scroll area with a thin themed scrollbar and soft top/bottom fades that only
 * appear when there's more content in that direction. When the content fits, nothing scrolls
 * and no fades or scrollbar show. Sets data-scroll-more on the scroller so sticky footers
 * inside can draw their own top shadow (see `.filter-footer`).
 */
export function ScrollFade({
  className,
  fadeColor,
  bottomFade = true,
  children,
  ...rest
}: React.ComponentProps<"div"> & { fadeColor?: string; bottomFade?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setTop(el.scrollTop > 2);
      setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    // <details> toggles and "show more" change the content height without resizing the scroller.
    const mo = new MutationObserver(update);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "hidden"] });
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const style = fadeColor ? ({ "--fade-color": fadeColor } as React.CSSProperties) : undefined;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={style}>
      <div aria-hidden className="scroll-fade-edge" data-side="top" data-on={top || undefined} />
      <div
        ref={ref}
        data-scroll-top={top || undefined}
        data-scroll-more={more || undefined}
        className={cn(
          "scroll-thin min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
      {bottomFade && <div aria-hidden className="scroll-fade-edge" data-side="bottom" data-on={more || undefined} />}
    </div>
  );
}
