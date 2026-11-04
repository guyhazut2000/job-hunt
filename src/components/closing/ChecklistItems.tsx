"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { saveChecklistItem } from "@/app/closing/actions";
import type { ChecklistState, ContractItem, Lang } from "@/lib/closing/checklist";
import type { ClosingStrings } from "@/lib/i18n/closing";
import { cn } from "@/lib/utils";

type Status = "todo" | "ok" | "concern";

/** The contract clause checklist: per item explanation, what to check, legal minimum, sources, status + note. */
export function ChecklistItems({
  s,
  lang,
  offerId,
  items,
  state,
  scanFound,
}: {
  s: ClosingStrings;
  lang: Lang;
  offerId: string;
  items: ContractItem[];
  state: ChecklistState;
  scanFound: Record<string, string | null>;
}) {
  return (
    <ol className="flex flex-col gap-3" data-testid="contract-checklist">
      {items.map((it) => (
        <Item
          key={it.id}
          s={s}
          lang={lang}
          offerId={offerId}
          item={it}
          initial={state[it.id] ?? { status: "todo", note: "" }}
          quote={scanFound[it.id] ?? null}
        />
      ))}
    </ol>
  );
}

function Item({
  s,
  lang,
  offerId,
  item,
  initial,
  quote,
}: {
  s: ClosingStrings;
  lang: Lang;
  offerId: string;
  item: ContractItem;
  initial: { status: Status; note: string };
  quote: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial.status);
  const [note, setNote] = useState(initial.note);
  const [savedNote, setSavedNote] = useState(initial.note);
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);

  const save = (patch: { status?: Status; note?: string }) =>
    start(async () => {
      const r = await saveChecklistItem({ offerId, itemId: item.id, ...patch });
      setErr(!r.ok);
      if (r.ok) {
        if (patch.note !== undefined) setSavedNote(patch.note);
        router.refresh();
      }
    });

  const tone =
    status === "ok" ? "border-emerald-600/40" : status === "concern" ? "border-amber-600/60" : "border-border";

  return (
    <li className={cn("bg-card rounded-lg border-2 p-3", tone)} data-testid={`clause-${item.id}`} data-status={status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-heading min-w-0 text-base font-bold">{item.title[lang]}</h3>
        <div className="flex flex-wrap gap-1" role="group" aria-label={item.title[lang]}>
          {(["ok", "concern", "todo"] as const).map((st) => (
            <button
              key={st}
              type="button"
              disabled={pending}
              aria-pressed={status === st}
              data-testid={`clause-${item.id}-${st}`}
              onClick={() => {
                setStatus(st);
                save({ status: st });
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                status === st
                  ? st === "ok"
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : st === "concern"
                      ? "border-amber-600 bg-amber-500 text-black"
                      : "bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              {s.cStatus[st]}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm">
        <span className="font-semibold">{s.cExplain}: </span>
        {item.explain[lang]}
      </p>
      <p className="mt-1 text-sm">
        <span className="font-semibold">{s.cLook}: </span>
        {item.look[lang]}
      </p>
      <p className="mt-1 text-sm" data-testid={`clause-${item.id}-minimum`}>
        <span className="font-semibold">{s.cMinimum}: </span>
        {item.minimum ? item.minimum[lang] : <span className="text-muted-foreground">{s.cNoMinimum}</span>}
      </p>
      {quote && (
        <blockquote dir="auto" className="bg-muted/40 mt-2 border-s-4 p-2 text-sm italic">
          “{quote}”
        </blockquote>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">{s.cSources}:</span>
        {item.sources.map((src) => (
          <a
            key={src.url}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            <bdi>{src.label[lang]}</bdi>
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ))}
      </div>
      <label className="mt-2 flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{s.cNote}</span>
        <textarea
          dir="auto"
          rows={1}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== savedNote && save({ note })}
          className="bg-background w-full rounded-md border p-1.5 text-sm"
          data-testid={`clause-${item.id}-note`}
        />
      </label>
      {err && <p className="text-destructive mt-1 text-xs">{s.error}</p>}
    </li>
  );
}
