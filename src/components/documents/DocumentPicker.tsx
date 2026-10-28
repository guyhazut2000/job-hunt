"use client";

import { FileText, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import {
  defaultSelection,
  filterAttachable,
  toggleSelection,
  type AttachableDocument,
  type PickerRules,
} from "@/lib/documents/picker";
import { formatBytes } from "@/lib/documents/validate";
import type { DocumentStrings } from "@/lib/i18n/documents";
import { fill } from "./fmt";

/**
 * Reusable attachment picker for the apply flow. Feed it `getAttachableDocuments(userId, types)`.
 * Works controlled (`value` + `onChange`) or uncontrolled; inside a <form> it submits one hidden
 * `name` input per selected ref ("doc:<id>" / "cv:<id>"). Re-check on the server with
 * `sanitizeSelection`. See docs/documents.md.
 */
export function DocumentPicker({
  t,
  docs,
  rules = {},
  name = "documents",
  value,
  onChange,
  showManageLink = true,
}: {
  t: DocumentStrings;
  docs: AttachableDocument[];
  rules?: PickerRules;
  name?: string;
  value?: string[];
  onChange?: (refs: string[]) => void;
  showManageLink?: boolean;
}) {
  const [inner, setInner] = useState<string[]>(() => defaultSelection(docs, rules));
  const [error, setError] = useState<string | null>(null);
  const selected = value ?? inner;
  const offered = useMemo(() => filterAttachable(docs, rules), [docs, rules]);
  const groups = DOCUMENT_TYPES.map((k) => ({ k, items: offered.filter((d) => d.type === k) })).filter(
    (g) => g.items.length,
  );

  function toggle(ref: string) {
    const res = toggleSelection(selected, ref, offered, rules);
    setError(
      res.error === "maxTotal"
        ? fill(t.picker.maxTotal, { n: rules.maxTotal ?? "" })
        : res.error === "maxBytes"
          ? t.picker.maxBytes
          : null,
    );
    if (!res.error) {
      if (value === undefined) setInner(res.selected);
      onChange?.(res.selected);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex w-full flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-lg font-bold">{t.picker.title}</span>
        <span className="text-muted-foreground text-xs" aria-live="polite">
          {fill(t.picker.selected, { n: selected.length })}
        </span>
      </legend>
      {!offered.length && <p className="text-muted-foreground text-sm">{t.picker.none}</p>}
      {groups.map((g) => {
        const single = rules.maxPerType?.[g.k] === 1;
        return (
          <div key={g.k} className="flex flex-col gap-1.5">
            <p className="kicker">{t.types[g.k]}</p>
            <ul className="flex flex-col gap-1.5">
              {g.items.map((d) => {
                const on = selected.includes(d.ref);
                return (
                  <li key={d.ref}>
                    <label
                      className={`bg-card hover:bg-muted flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 ${on ? "border-foreground" : ""}`}
                    >
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={single ? `${name}-${g.k}` : undefined}
                        className="accent-foreground size-4 shrink-0"
                        checked={on}
                        onChange={() => toggle(d.ref)}
                        onClick={(e) => {
                          // radios can't be unchecked natively; allow it for optional types
                          if (single && on) {
                            e.preventDefault();
                            toggle(d.ref);
                          }
                        }}
                      />
                      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" dir="auto">
                          {d.title}
                        </span>
                        <span className="text-muted-foreground block truncate font-mono text-xs">
                          <bdi>{d.fileName}</bdi> · {formatBytes(d.sizeBytes)}
                        </span>
                      </span>
                      {d.isDefault && <Star className="text-foreground size-3.5 shrink-0" aria-label={t.default} />}
                      {d.expired && (
                        <Badge variant="destructive" className="shrink-0">
                          {t.picker.expired}
                        </Badge>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {selected.map((r) => (
        <input key={r} type="hidden" name={name} value={r} />
      ))}
      {error && (
        <p role="alert" className="text-destructive text-sm font-semibold">
          {error}
        </p>
      )}
      {showManageLink && (
        <Link href="/documents" className="text-primary self-start text-sm font-semibold underline underline-offset-4">
          {t.picker.manage}
        </Link>
      )}
    </fieldset>
  );
}
