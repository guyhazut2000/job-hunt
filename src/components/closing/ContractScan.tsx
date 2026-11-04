"use client";

import { useActionState } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { runContractScan, type ScanState } from "@/app/closing/actions";
import type { ScanResult } from "@/lib/closing/analysis";
import { MAX_CONTRACT_CHARS } from "@/lib/closing/analysis";
import type { ContractItem, Lang } from "@/lib/closing/checklist";
import type { ClosingStrings } from "@/lib/i18n/closing";
import { fillC } from "@/lib/i18n/closing";
import { Button } from "@/components/ui/button";
import { fmtWhen } from "./ui";

/** Optional paste-the-contract check. The pasted text is sent once and never stored; only verbatim quotes are kept. */
export function ContractScan({
  s,
  lang,
  offerId,
  items,
  last,
}: {
  s: ClosingStrings;
  lang: Lang;
  offerId: string;
  items: ContractItem[];
  last: ScanResult | null;
}) {
  const [state, action, pending] = useActionState<ScanState, FormData>(runContractScan, undefined);
  const result = state && "ok" in state ? state.result : last;
  const title = (id: string) => items.find((i) => i.id === id)?.title[lang] ?? id;
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="offerId" value={offerId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{s.sPaste}</span>
          <textarea
            name="text"
            dir="auto"
            rows={6}
            maxLength={MAX_CONTRACT_CHARS}
            className="bg-background w-full rounded-md border p-2 text-sm"
            data-testid="scan-text"
          />
        </label>
        <div>
          <Button type="submit" size="sm" disabled={pending} data-testid="scan-run">
            {pending ? s.sRunning : s.sRun}
          </Button>
        </div>
        {state && "error" in state && (
          <p className="text-destructive text-sm" role="alert">
            {state.error === "short" ? s.sTooShort : s.error}
          </p>
        )}
      </form>
      {result && (
        <div className="flex flex-col gap-2" data-testid="scan-result" data-source={result.source}>
          <p className="text-muted-foreground text-xs">
            {result.source === "ai" ? s.sSourceAi : result.source === "limited" ? s.sSourceLimited : s.sSourceHeuristic}{" "}
            · {fillC(s.sAt, { when: fmtWhen(result.at, lang), chars: result.chars })}
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {result.items.map((it) => (
              <li key={it.id} className="flex min-w-0 items-start gap-2 text-sm">
                {it.found ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-label={s.sFound} />
                ) : (
                  <CircleDashed className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-label={s.sMissing} />
                )}
                <span className="min-w-0">
                  <span className="font-medium">{title(it.id)}</span>
                  {!it.found && <span className="text-muted-foreground"> · {s.sMissing}</span>}
                  {it.quote && (
                    <span dir="auto" className="text-muted-foreground block truncate text-xs" title={it.quote}>
                      “{it.quote}”
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
