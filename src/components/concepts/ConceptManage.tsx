"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import { deleteConcept, updateConcept } from "@/app/learn/concepts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONCEPT_CATEGORIES,
  CONCEPT_STATUSES,
  NOTES_MAX,
  cleanTags,
  type ConceptCategory,
  type ConceptStatus,
} from "@/lib/concepts/core";
import type { ConceptStrings } from "@/lib/i18n/concepts";
import { fmt } from "@/lib/i18n/learning";
import { cn } from "@/lib/utils";

export interface ManageInit {
  status: ConceptStatus;
  confidence: number;
  notes: string;
  tags: string[];
  category: ConceptCategory | null;
}

export function ConceptManage({ id, init, t }: { id: string; init: ManageInit; t: ConceptStrings }) {
  const router = useRouter();
  const [status, setStatus] = useState(init.status);
  const [confidence, setConfidence] = useState(init.confidence);
  const [notes, setNotes] = useState(init.notes);
  const [tags, setTags] = useState(init.tags.join(", "));
  const [category, setCategory] = useState<ConceptCategory | "">(init.category ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = (patch: Parameters<typeof updateConcept>[0]) =>
    start(async () => {
      setSaved(false);
      const r = await updateConcept(patch);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      }
    });

  return (
    <section
      aria-labelledby="manage"
      className="bg-card flex flex-col gap-4 rounded-2xl border p-4"
      data-testid="concept-manage"
    >
      <h2 id="manage" className="kicker">
        {t.manageTitle}
      </h2>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t.statusLabel}</span>
        <div role="radiogroup" aria-label={t.statusLabel} className="bg-secondary grid grid-cols-3 rounded-full p-1">
          {CONCEPT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => {
                setStatus(s);
                save({ id, status: s, notes, tags: cleanTags(tags) });
              }}
              className={cn(
                "min-h-9 rounded-full px-2 text-sm font-semibold transition-colors",
                status === s ? "bg-background shadow-sm" : "text-foreground/70 hover:text-foreground",
              )}
            >
              {t.status[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {t.confidenceLabel}{" "}
          <span className="text-muted-foreground font-normal">({fmt(t.confidenceOf, { n: confidence })})</span>
        </span>
        <div role="radiogroup" aria-label={t.confidenceLabel} className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={confidence === n}
              aria-label={fmt(t.confidenceOf, { n })}
              onClick={() => {
                setConfidence(n);
                save({ id, confidence: n });
              }}
              className={cn(
                "grid size-10 place-items-center rounded-full border text-sm font-bold tabular-nums transition-colors",
                n <= confidence
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-secondary",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.categoryLabel}
        <select
          value={category}
          onChange={(e) => {
            const v = e.target.value as ConceptCategory | "";
            setCategory(v);
            save({ id, category: v || null });
          }}
          className="border-input bg-background h-10 rounded-lg border px-2.5 font-normal"
        >
          <option value="">—</option>
          {CONCEPT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.category[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.tagsLabel}
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={() => save({ id, tags: cleanTags(tags) })}
          placeholder={t.tagsPlaceholder}
          dir="auto"
          className="h-10 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.notesLabel}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={NOTES_MAX}
          placeholder={t.notesPlaceholder}
          dir="auto"
          rows={4}
          className="font-normal"
          data-testid="concept-notes"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={pending}
          onClick={() => save({ id, notes, tags: cleanTags(tags) })}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : saved ? (
            <Check className="size-4" aria-hidden />
          ) : null}
          {saved && !pending ? t.saved : t.save}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (!window.confirm(t.deleteConfirm)) return;
            start(async () => {
              await deleteConcept(id);
              router.push("/learn/concepts");
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          {t.delete}
        </Button>
      </div>
    </section>
  );
}
