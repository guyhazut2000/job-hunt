"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { updateTransitionList } from "@/app/closing/actions";
import type { CheckItem } from "@/lib/closing/transition";
import type { ClosingStrings } from "@/lib/i18n/closing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Editable checklist (handover / first day) stored on the offer's closing row. */
export function TransitionList({
  s,
  offerId,
  list,
  items,
}: {
  s: ClosingStrings;
  offerId: string;
  list: "handover" | "firstDay";
  items: CheckItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const run = (input: Omit<Parameters<typeof updateTransitionList>[0], "offerId" | "list">) =>
    start(async () => {
      await updateTransitionList({ offerId, list, ...input });
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2" data-testid={`transition-${list}`}>
      <ul className="flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0"
              checked={it.done}
              disabled={pending}
              onChange={(e) => run({ op: "toggle", itemId: it.id, done: e.target.checked })}
              aria-label={it.text}
              data-testid={`transition-${list}-${it.id}`}
            />
            <span
              dir="auto"
              className={it.done ? "text-muted-foreground min-w-0 flex-1 line-through" : "min-w-0 flex-1"}
            >
              {it.text}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0"
              disabled={pending}
              onClick={() => run({ op: "remove", itemId: it.id })}
              aria-label={`${s.remove}: ${it.text}`}
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          run({ op: "add", text: t });
        }}
      >
        <Input
          dir="auto"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder={s.tAddItem}
          aria-label={s.tAddItem}
          className="h-8 min-w-0 flex-1"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <Plus className="size-4" aria-hidden />
          {s.add}
        </Button>
      </form>
    </div>
  );
}
