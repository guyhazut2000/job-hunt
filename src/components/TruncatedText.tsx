"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Highlight } from "./Highlight";

const CLAMP = { 1: "truncate", 2: "line-clamp-2", 3: "line-clamp-3" } as const;
const LONG_PRESS_MS = 450;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Text clamped with an ellipsis that reveals the full value in a tooltip — but only when it is
 * actually cut off. Opens on hover, on keyboard focus of the surrounding link/button, and on
 * touch long-press (a long-press doesn't also trigger the link).
 */
export function TruncatedText({
  text,
  lines = 1,
  className,
  side = "top",
  highlight,
}: {
  text: string;
  /** Search terms to mark inside the text. */
  highlight?: string[];
  lines?: 1 | 2 | 3;
  className?: string;
  side?: "top" | "bottom";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const truncatedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swallowClick = useRef(false);
  const pointerType = useRef("mouse");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const t = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    truncatedRef.current = t;
    setTruncated(t);
    if (!t) setOpen(false);
  }, []);

  useIsoLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, text]);

  // Keyboard: the focusable element is usually the surrounding link, not this span.
  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>("a,button,[tabindex]");
    if (!host) return;
    const onFocus = () => {
      if (truncatedRef.current && host.matches(":focus-visible")) setOpen(true);
    };
    const onBlur = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    host.addEventListener("focus", onFocus);
    host.addEventListener("blur", onBlur);
    host.addEventListener("keydown", onKey);
    return () => {
      host.removeEventListener("focus", onFocus);
      host.removeEventListener("blur", onBlur);
      host.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cancelPress = () => clearTimeout(timer.current);

  return (
    <Tooltip open={truncated && open} onOpenChange={(o) => setOpen(o && truncatedRef.current)}>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          dir="auto"
          className={cn(
            lines === 1 ? "block" : "break-words",
            CLAMP[lines],
            truncated && "[-webkit-touch-callout:none]",
            className,
          )}
          onPointerDown={(e) => {
            pointerType.current = e.pointerType;
            if (e.pointerType === "mouse" || !truncatedRef.current) return;
            cancelPress();
            timer.current = setTimeout(() => {
              swallowClick.current = true;
              setOpen(true);
            }, LONG_PRESS_MS);
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onContextMenu={(e) => {
            // Long-press on touch opens the tooltip instead of the native link menu.
            if (truncatedRef.current && pointerType.current !== "mouse") e.preventDefault();
          }}
          onClickCapture={(e) => {
            if (!swallowClick.current) return;
            swallowClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Highlight text={text} terms={highlight} />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-[min(20rem,calc(100vw-2rem))] text-sm break-words">
        <span dir="auto">{text}</span>
      </TooltipContent>
    </Tooltip>
  );
}
