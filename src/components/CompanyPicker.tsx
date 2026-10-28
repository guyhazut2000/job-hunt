"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

const PAGE = 8;

export interface CompanyOption {
  slug: string;
  name: string;
  count: number;
}

/** Searchable multi-select of companies. Plain checkboxes named `company`, so it submits with the GET form. */
export function CompanyPicker({
  id,
  companies,
  selected,
  placeholder,
  empty,
  moreLabel,
  lessLabel,
}: {
  id: string;
  companies: CompanyOption[];
  selected: string[];
  placeholder: string;
  empty: string;
  /** "Show {n} more" template. */
  moreLabel: string;
  lessLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [checked, setChecked] = useState(() => new Set(selected));
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q))
      .sort((a, b) => Number(checked.has(b.slug)) - Number(checked.has(a.slug)) || a.name.localeCompare(b.name, "en"));
    // Keep the order stable while the user ticks boxes; re-sort only when the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, query]);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="input ps-9"
          autoComplete="off"
        />
      </div>
      <ul className="flex flex-col" role="list">
        {list.length === 0 && <li className="text-muted-foreground px-1 py-2 text-sm">{empty}</li>}
        {list.slice(0, shown).map((c) => (
          <li key={c.slug}>
            <label className="hover:bg-muted -mx-2 flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-sm">
              <input
                type="checkbox"
                name="company"
                value={c.slug}
                checked={checked.has(c.slug)}
                onChange={(e) =>
                  setChecked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(c.slug);
                    else n.delete(c.slug);
                    return n;
                  })
                }
                className="accent-primary size-4 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">{c.count}</span>
            </label>
          </li>
        ))}
      </ul>
      {(list.length > shown || shown > PAGE) && (
        <div className="flex flex-wrap gap-x-3">
          {list.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + 20)}
              className="text-primary hover:text-primary/80 -mx-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold"
            >
              {moreLabel.replace("{n}", String(Math.min(20, list.length - shown)))}
              <ChevronDown aria-hidden className="size-4" />
            </button>
          )}
          {shown > PAGE && (
            <button
              type="button"
              onClick={() => setShown(PAGE)}
              className="text-muted-foreground hover:text-foreground -mx-2 inline-flex min-h-10 items-center rounded-md px-2 text-sm font-semibold"
            >
              {lessLabel}
            </button>
          )}
        </div>
      )}
      {/* Hidden-by-search selections still need to submit. */}
      {[...checked]
        .filter((s) => !list.slice(0, shown).some((c) => c.slug === s))
        .map((s) => (
          <input key={s} type="hidden" name="company" value={s} />
        ))}
    </div>
  );
}
