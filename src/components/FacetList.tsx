"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export type FacetItem = [value: string, label: string, count: number];

/**
 * Checkbox list for one filter facet. Long lists show the first `limit` options (plus anything
 * already ticked) with a "show all" toggle, and a search box past `searchFrom` options — so the
 * filter panel stays short instead of growing a tall inner scroll. Every checkbox stays in the
 * DOM (hidden ones too), so the plain GET form still submits ticks made before collapsing.
 */
export function FacetList({
  name,
  items,
  selected,
  limit = 6,
  searchFrom = 10,
  labels,
}: {
  name: string;
  items: FacetItem[];
  selected: readonly string[];
  limit?: number;
  searchFrom?: number;
  labels: { showAll: string; showLess: string; search: string; none: string };
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState(() => new Set(selected));
  const q = query.trim().toLowerCase();
  const collapsible = items.length > limit + 1;

  const visible = useMemo(() => {
    if (q)
      return new Set(
        items.filter(([v, l]) => l.toLowerCase().includes(q) || v.toLowerCase().includes(q)).map(([v]) => v),
      );
    if (open || !collapsible) return new Set(items.map(([v]) => v));
    return new Set(items.filter(([v], i) => i < limit || ticked.has(v)).map(([v]) => v));
  }, [items, q, open, collapsible, limit, ticked]);

  const listId = `${uid}-list`;
  return (
    <div className="flex flex-col gap-1">
      {items.length > searchFrom && (
        <div className="relative mb-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder={labels.search}
            aria-label={labels.search}
            aria-controls={listId}
            className="input min-h-10 ps-9"
            autoComplete="off"
          />
        </div>
      )}
      <ul id={listId} className="flex flex-col" role="list">
        {items.map(([v, l, n]) => (
          <li key={v} hidden={!visible.has(v)}>
            <label className="hover:bg-muted -mx-2 flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-sm">
              <input
                type="checkbox"
                name={name}
                value={v}
                defaultChecked={selected.includes(v)}
                onChange={(e) =>
                  setTicked((s) => {
                    const next = new Set(s);
                    if (e.target.checked) next.add(v);
                    else next.delete(v);
                    return next;
                  })
                }
                className="accent-primary size-4 shrink-0"
              />
              <span className="min-w-0 flex-1">{l}</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">{n}</span>
            </label>
          </li>
        ))}
      </ul>
      {q && visible.size === 0 && <p className="text-muted-foreground px-1 py-2 text-sm">{labels.none}</p>}
      {collapsible && !q && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          className="text-primary hover:text-primary/80 -mx-2 inline-flex min-h-10 items-center gap-1 self-start rounded-md px-2 text-sm font-semibold"
        >
          {open ? labels.showLess : labels.showAll}
          <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
