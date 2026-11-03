"use client";

import { useEffect, useState } from "react";

const KEY = "jh:negotiation-checklist";

/** Pre-call checklist; ticks are kept in localStorage only (nothing personal on the server). */
export function NegotiationChecklist({ items, savedLabel }: { items: string[]; savedLabel: string }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(v)) setDone(items.map((_, i) => v[i] === true));
    } catch {
      // ignore
    }
  }, [items]);
  const toggle = (i: number) =>
    setDone((d) => {
      const next = d.map((x, j) => (j === i ? !x : x));
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // private mode
      }
      return next;
    });
  const count = done.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-2" data-testid="negotiation-checklist">
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm">
              <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} className="mt-0.5 size-5 shrink-0" />
              <span className={done[i] ? "text-muted-foreground line-through" : ""}>{it}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        <bdi dir="ltr">
          {count}/{items.length}
        </bdi>{" "}
        · {savedLabel}
      </p>
    </div>
  );
}
