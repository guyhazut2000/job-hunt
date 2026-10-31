"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SHEET_H, SHEET_W } from "./CvPreview";

/** Scales an A4-width sheet to the container width (thumbnails and the live preview). */
export function ScaledSheet({
  children,
  maxHeight,
  label,
}: {
  children: ReactNode;
  maxHeight?: number;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / SHEET_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = Math.min(maxHeight ?? Infinity, SHEET_H * scale);
  return (
    <div
      ref={box}
      role={label ? "img" : undefined}
      aria-label={label}
      className="relative w-full overflow-hidden rounded-md border bg-white shadow-sm"
      style={{ height: h }}
    >
      <div
        aria-hidden={label ? true : undefined}
        style={{
          width: SHEET_W,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
