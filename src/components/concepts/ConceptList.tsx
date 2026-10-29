"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, MessageSquare, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  allTags,
  CONCEPT_CATEGORIES,
  CONCEPT_STATUSES,
  filterConcepts,
  type ConceptFilter,
  type ConceptListItem,
} from "@/lib/concepts/core";
import type { ConceptStrings } from "@/lib/i18n/concepts";
import { fmt } from "@/lib/i18n/learning";
import { cn } from "@/lib/utils";
import { ConfidenceDots, StatusBadge } from "./ConceptBits";

const selectCls = "border-input bg-background h-10 min-w-0 rounded-lg border px-2.5 text-sm";

export function ConceptList({ items, t }: { items: ConceptListItem[]; t: ConceptStrings }) {
  const [f, setF] = useState<ConceptFilter>({ q: "", status: "", category: "", kind: "", tag: "" });
  const tags = useMemo(() => allTags(items), [items]);
  const cats = useMemo(() => CONCEPT_CATEGORIES.filter((c) => items.some((i) => i.category === c)), [items]);
  const shown = useMemo(() => filterConcepts(items, f), [items, f]);
  const active = !!(f.q || f.status || f.category || f.kind || f.tag);
  const set = (patch: Partial<ConceptFilter>) => setF((x) => ({ ...x, ...patch }));

  return (
    <div className="flex flex-col gap-4" data-testid="concept-list">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 sm:flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="h-10 ps-9"
            type="search"
            data-testid="concept-search"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <select
            aria-label={t.filterStatus}
            value={f.status}
            onChange={(e) => set({ status: e.target.value as ConceptFilter["status"] })}
            className={selectCls}
          >
            <option value="">{`${t.filterStatus}: ${t.filterAll}`}</option>
            {CONCEPT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>
          <select
            aria-label={t.filterCategory}
            value={f.category}
            onChange={(e) => set({ category: e.target.value })}
            className={selectCls}
          >
            <option value="">{`${t.filterCategory}: ${t.filterAll}`}</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {t.category[c]}
              </option>
            ))}
          </select>
          <select
            aria-label={t.filterKind}
            value={f.kind}
            onChange={(e) => set({ kind: e.target.value as ConceptFilter["kind"] })}
            className={selectCls}
          >
            <option value="">{`${t.filterKind}: ${t.filterAll}`}</option>
            <option value="TECH">{t.kindTech}</option>
            <option value="COMPANY">{t.kindCompany}</option>
          </select>
          {tags.length > 0 && (
            <select
              aria-label={t.filterTag}
              value={f.tag}
              onChange={(e) => set({ tag: e.target.value })}
              className={selectCls}
            >
              <option value="">{`${t.filterTag}: ${t.filterAll}`}</option>
              {tags.map((x) => (
                <option key={x} value={x}>
                  #{x}
                </option>
              ))}
            </select>
          )}
        </div>
        {active && (
          <button
            type="button"
            onClick={() => setF({ q: "", status: "", category: "", kind: "", tag: "" })}
            className="text-primary inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline"
          >
            <X className="size-4" aria-hidden />
            {t.clearFilters}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center">{t.noMatches}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <li key={c.id} className="min-w-0">
              <Link
                href={`/learn/concepts/${c.id}`}
                className="bg-card hover:border-primary/40 flex h-full flex-col gap-2 rounded-xl border p-4 transition-colors"
                data-testid="concept-card"
              >
                <span className="flex items-start justify-between gap-2">
                  <span dir="auto" className="min-w-0 font-bold break-words">
                    {c.name}
                  </span>
                  <StatusBadge status={c.status} t={t} />
                </span>
                {c.companyName && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                    <Building2 className="size-3.5" aria-hidden />
                    {c.companyName}
                  </span>
                )}
                {c.summary && (
                  <span className="text-foreground/75 line-clamp-2 text-sm leading-relaxed">{c.summary}</span>
                )}
                <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                  {c.category && (
                    <span className="bg-secondary rounded-full px-2 py-0.5 font-semibold">
                      {t.category[c.category as keyof typeof t.category] ?? c.category}
                    </span>
                  )}
                  <ConfidenceDots value={c.confidence} label={fmt(t.confidenceOf, { n: c.confidence })} />
                  {c.messages > 0 && (
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <MessageSquare className="size-3.5" aria-hidden />
                      {fmt(t.messagesCount, { n: c.messages })}
                    </span>
                  )}
                  {c.tags.slice(0, 3).map((x) => (
                    <span key={x} className={cn("text-muted-foreground")}>
                      #{x}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
