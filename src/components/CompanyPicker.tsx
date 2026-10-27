"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

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
}: {
  id: string;
  companies: CompanyOption[];
  selected: string[];
  placeholder: string;
  empty: string;
}) {
  const [query, setQuery] = useState("");
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
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="input ps-9"
          autoComplete="off"
        />
      </div>
      <ul className="max-h-60 overflow-y-auto overscroll-contain rounded-md border" role="list">
        {list.length === 0 && <li className="text-muted-foreground px-3 py-3 text-sm">{empty}</li>}
        {list.map((c) => (
          <li key={c.slug}>
            <label className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
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
                className="accent-primary size-4"
              />
              <span className="flex-1 truncate font-medium">
                {c.name}
              </span>
              <span className="text-muted-foreground font-mono text-xs">{c.count}</span>
            </label>
          </li>
        ))}
      </ul>
      {/* Hidden-by-search selections still need to submit. */}
      {[...checked]
        .filter((s) => !list.some((c) => c.slug === s))
        .map((s) => (
          <input key={s} type="hidden" name="company" value={s} />
        ))}
    </div>
  );
}
